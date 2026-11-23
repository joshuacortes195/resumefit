import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/ai/crypto";
import { encryptionSecret } from "@/lib/ai/secret";
import { DECLINE, SEALED_KEYS, type Profile, type QaEntry, type SealedAnswers } from "@/lib/profile";

export type ProfileRow = typeof schema.profiles.$inferSelect;

// the locked answers with nothing filled in. the self-identification ones start on "decline"
const BLANK_SEALED: SealedAnswers = {
  workAuthorization: null,
  needsSponsorship: null,
  eeoGender: DECLINE,
  eeoRace: DECLINE,
  eeoVeteran: DECLINE,
  eeoDisability: DECLINE,
  eeoHispanic: DECLINE,
  preferredName: null,
  pronouns: null,
  streetAddress: null,
  over18: null,
  howHeard: null,
  noticePeriod: null,
  school: null,
  degree: null,
  major: null,
  graduationMonth: null,
  graduationYear: null,
  gpa: null,
  gpaNeverFill: false,
  // sending is something a person switches on, never the starting point
  autoSend: "off",
  dailySendCap: 10,
};

// where the locked answers are kept, one bundle per person
const sealedKey = (userId: string) => `application:${userId}`;

// thrown when there is no secret to lock the answers with, so they are never stored in the open
export class NoSecretError extends Error {
  constructor() {
    super("These answers are locked before they are saved, and this copy of the app has no ENCRYPTION_KEY set to lock them with.");
  }
}

// reads the bundle of locked answers. saved says whether the person has ever saved the form
async function getSealed(userId: string): Promise<{ answers: Partial<SealedAnswers>; saved: boolean }> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, sealedKey(userId))).limit(1);
  if (!row) return { answers: {}, saved: false };
  const value = row.value as { sealed?: unknown } | null;
  // an older version of the app kept a few of these in the open, those are still read until the form is saved again
  if (typeof value?.sealed !== "string") return { answers: (value ?? {}) as Partial<SealedAnswers>, saved: true };
  const secret = encryptionSecret();
  const opened = secret ? decrypt(value.sealed, secret) : null;
  if (opened === null) {
    // the secret changed or is missing. the answers cannot be read, so the form shows blank and saving writes a fresh bundle
    console.error("application answers could not be unlocked, showing them as blank");
    return { answers: {}, saved: true };
  }
  return { answers: JSON.parse(opened) as Partial<SealedAnswers>, saved: true };
}

// saved answers are kept as one locked string with this in front, so a locked bank is easy to tell from an old open one
export const QA_PREFIX = "enc:v1:";

// locks the saved answers for the qa_bank column
export function sealQaBank(entries: QaEntry[], secret: string): string {
  return QA_PREFIX + encrypt(JSON.stringify(entries), secret);
}

// reads the qa_bank column back. legacy says it was still an open list from before answers were locked
export function openQaBank(stored: unknown): { entries: QaEntry[]; legacy: boolean } {
  if (Array.isArray(stored)) return { entries: stored as QaEntry[], legacy: stored.length > 0 };
  if (typeof stored !== "string" || !stored.startsWith(QA_PREFIX)) return { entries: [], legacy: false };
  const secret = encryptionSecret();
  const opened = secret ? decrypt(stored.slice(QA_PREFIX.length), secret) : null;
  if (opened === null) {
    // the secret changed or is missing, so the saved answers show as empty instead of breaking the page
    console.error("saved answers could not be unlocked, showing them as empty");
    return { entries: [], legacy: false };
  }
  return { entries: JSON.parse(opened) as QaEntry[], legacy: false };
}

// writes the saved answers locked. with no secret to lock them with nothing is written, so they never sit in the open
async function writeQaBank(userId: string, entries: QaEntry[]): Promise<void> {
  const secret = encryptionSecret();
  if (!secret) return;
  const qaBank = sealQaBank(entries, secret);
  const db = await getDb();
  await db.insert(schema.profiles).values({ userId, qaBank }).onConflictDoUpdate({ target: schema.profiles.userId, set: { qaBank } });
}

// true once the application profile has been saved, which is when declining the self-identification questions counts as an answer
export async function applicationAnswered(userId: string): Promise<boolean> {
  return (await getSealed(userId)).saved;
}

// a profile with nothing filled in
const BLANK: Profile = {
  ...BLANK_SEALED,
  fullName: null,
  email: null,
  phone: null,
  city: null,
  state: null,
  country: null,
  zip: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  otherLinks: [],
  yearsExperience: null,
  willingToRelocate: null,
  desiredSalaryMin: null,
  desiredSalaryMax: null,
  earliestStartDate: null,
  jobTypes: [],
  preferredIndustries: [],
  remotePreference: null,
  qaBank: [],
};

// the saved profile, or a blank one for someone who has not filled it in
export async function getProfile(userId: string): Promise<Profile> {
  const db = await getDb();
  const [[row], { answers }] = await Promise.all([db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1), getSealed(userId)]);
  if (!row) return { ...BLANK, ...answers };
  const bank = openQaBank(row.qaBank);
  // an open bank from before answers were locked gets locked now, the first time it is read
  if (bank.legacy) await writeQaBank(userId, bank.entries);
  return {
    ...BLANK_SEALED,
    // rows written before these answers were locked still have them in their old columns
    workAuthorization: row.workAuthorization,
    needsSponsorship: row.needsSponsorship,
    eeoGender: row.eeoGender as Profile["eeoGender"],
    eeoRace: row.eeoRace as Profile["eeoRace"],
    eeoVeteran: row.eeoVeteran as Profile["eeoVeteran"],
    eeoDisability: row.eeoDisability as Profile["eeoDisability"],
    // the locked bundle wins over anything left in a column
    ...answers,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    country: row.country,
    zip: row.zip,
    linkedinUrl: row.linkedinUrl,
    githubUrl: row.githubUrl,
    portfolioUrl: row.portfolioUrl,
    otherLinks: row.otherLinks,
    yearsExperience: row.yearsExperience,
    willingToRelocate: row.willingToRelocate,
    desiredSalaryMin: row.desiredSalaryMin,
    desiredSalaryMax: row.desiredSalaryMax,
    earliestStartDate: row.earliestStartDate,
    jobTypes: row.jobTypes as Profile["jobTypes"],
    preferredIndustries: row.preferredIndustries,
    remotePreference: row.remotePreference,
    qaBank: bank.entries,
  };
}

// saves the whole application profile
export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const secret = encryptionSecret();
  if (!secret) throw new NoSecretError();
  const db = await getDb();
  const sealedNames = SEALED_KEYS as readonly string[];
  // the locked answers go into one sealed bundle, everything else has a column of its own
  const answers = Object.fromEntries(SEALED_KEYS.map((key) => [key, profile[key]]));
  const open = Object.fromEntries(Object.entries(profile).filter(([key]) => !sealedNames.includes(key))) as Omit<Profile, keyof SealedAnswers>;
  // the old columns for the locked answers are wiped and the saved answers are locked too, so nothing about them is left readable in the table
  const columns = { ...open, qaBank: sealQaBank(profile.qaBank, secret), workAuthorization: null, needsSponsorship: null, eeoGender: DECLINE, eeoRace: DECLINE, eeoVeteran: DECLINE, eeoDisability: DECLINE };
  const value = { sealed: encrypt(JSON.stringify(answers), secret) };
  await db.insert(schema.profiles).values({ userId, ...columns }).onConflictDoUpdate({ target: schema.profiles.userId, set: columns });
  await db.insert(schema.appSettings).values({ key: sealedKey(userId), value }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value } });
}

// adds an answer to the saved answers, replacing an older answer to the same question
export async function saveAnswer(userId: string, entry: QaEntry): Promise<void> {
  const profile = await getProfile(userId);
  const same = (question: string) => question.trim().toLowerCase() === entry.question.trim().toLowerCase();
  await writeQaBank(userId, [...profile.qaBank.filter((saved) => !same(saved.question)), entry].slice(-100));
}

// true once enough is filled in for Auto Apply to be useful
export function profileReady(profile: Profile): boolean {
  return Boolean(profile.fullName && profile.email && profile.phone);
}
