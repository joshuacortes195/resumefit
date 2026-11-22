import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { getDb } from "@/db";

// the public key of the hosted database can reach any table that is not locked, so every table has to be.
// a new table needs its own "enable row level security" line in its migration, and this fails until it has one
it("locks every table to the app's own connection", async () => {
  const db = await getDb();
  const result = (await db.execute(sql`
    select c.relname as name, c.relrowsecurity as locked
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  `)) as unknown as { rows: { name: string; locked: boolean }[] };
  const tables = result.rows;
  expect(tables.length).toBeGreaterThanOrEqual(17);
  expect(tables.filter((table) => !table.locked).map((table) => table.name)).toEqual([]);
  // and nobody was given a way in around the lock
  const policies = (await db.execute(sql`select count(*)::int as total from pg_policies where schemaname = 'public'`)) as unknown as { rows: { total: number }[] };
  expect(policies.rows[0]?.total).toBe(0);
});

// the lock only covers tables. a view or a function that runs as its owner reads the tables with the owner's rights,
// so one added to the public schema would hand every row to anyone with the public key. none should ever be added there
it("has no views or owner run functions that would get around the lock", async () => {
  const db = await getDb();
  const views = (await db.execute(sql`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  `)) as unknown as { rows: { name: string }[] };
  expect(views.rows.map((row) => row.name)).toEqual([]);
  const functions = (await db.execute(sql`
    select p.proname as name
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  `)) as unknown as { rows: { name: string }[] };
  expect(functions.rows.map((row) => row.name)).toEqual([]);
});
