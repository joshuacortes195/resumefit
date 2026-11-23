import { inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isOwnerEmail } from "@/lib/data/users";

// what we need from the sign in service's admin api, so the tests can hand in a pretend one
export type AuthAdmin = {
  listUsers(params: { page: number; perPage: number }): Promise<{ data: { users: { id: string; email?: string; created_at: string }[]; nextPage?: number | null }; error: unknown }>;
  deleteUser(id: string): Promise<{ error: unknown }>;
};

// a sign in record only counts as junk once it has sat a week without ever getting into the app
export const JUNK_AFTER_DAYS = 7;
// the most one press of the button removes, so a run stays short and a mistake stays small
export const JUNK_PER_RUN = 500;
// how many records are read per page, and how many pages at most
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

// who must never be touched: the admin pressing the button
type Keep = { id: string; email: string };

// lowercase and trimmed, so two ways of writing one email match
const norm = (email: string | undefined) => (email ?? "").trim().toLowerCase();

// everyone who is in the app, by id and by email
async function appMembers(): Promise<{ ids: Set<string>; emails: Set<string> }> {
  const db = await getDb();
  const rows = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users);
  return { ids: new Set(rows.map((row) => row.id)), emails: new Set(rows.map((row) => norm(row.email))) };
}

// goes through every page of sign in records and picks the ones that never got into the app and are over a week old.
// stops once it has found limit of them
async function findJunk(admin: AuthAdmin, keep: Keep, limit: number, now: number): Promise<{ id: string; email: string }[]> {
  const members = await appMembers();
  const cutoff = now - JUNK_AFTER_DAYS * 86_400_000;
  const found: { id: string; email: string }[] = [];
  let page = 1;
  for (let read = 0; read < MAX_PAGES; read++) {
    const { data, error } = await admin.listUsers({ page, perPage: PAGE_SIZE });
    // a page that cannot be read stops everything, nothing is guessed
    if (error) throw new Error("Could not read the sign in records.");
    for (const person of data.users) {
      const created = Date.parse(person.created_at);
      const email = norm(person.email);
      // anything new, undated, in the app, the admin or the owner email is left alone
      if (!Number.isFinite(created) || created > cutoff) continue;
      if (members.ids.has(person.id) || (email && members.emails.has(email))) continue;
      if (person.id === keep.id || (email && (email === norm(keep.email) || isOwnerEmail(email)))) continue;
      found.push({ id: person.id, email });
      if (found.length >= limit) return found;
    }
    // the last page, or a next page that would go backwards, ends the walk
    const next = data.nextPage ?? null;
    if (!next || next <= page || data.users.length === 0) break;
    page = next;
  }
  return found;
}

// how many junk sign in records there are, for the admin page
export async function countJunkSignIns(admin: AuthAdmin, keep: Keep, now = Date.now()): Promise<number> {
  return (await findJunk(admin, keep, PAGE_SIZE * MAX_PAGES, now)).length;
}

// deletes up to one run's worth of junk sign in records. everything is listed first and deleted after,
// so deleting does not shift the pages still being read
export async function deleteJunkSignIns(admin: AuthAdmin, keep: Keep, now = Date.now()): Promise<{ deleted: number; failed: number }> {
  const junk = await findJunk(admin, keep, JUNK_PER_RUN, now);
  if (junk.length === 0) return { deleted: 0, failed: 0 };
  // checked against the app once more right before deleting, in case someone got in while the list was read
  const db = await getDb();
  const emails = junk.map((person) => person.email).filter(Boolean);
  const joined = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(
      or(
        inArray(
          schema.users.id,
          junk.map((person) => person.id),
        ),
        emails.length ? inArray(sql`lower(${schema.users.email})`, emails) : undefined,
      ),
    );
  const stay = new Set([...joined.map((row) => row.id), ...joined.map((row) => norm(row.email))]);
  let deleted = 0;
  let failed = 0;
  for (const person of junk) {
    if (stay.has(person.id) || (person.email && stay.has(person.email))) continue;
    const { error } = await admin.deleteUser(person.id);
    if (error) failed++;
    else deleted++;
  }
  return { deleted, failed };
}
