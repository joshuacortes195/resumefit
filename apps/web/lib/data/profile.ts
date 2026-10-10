import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DECLINE, EXTRA_KEYS, type Profile, type ProfileExtras, type QaEntry } from "@/lib/profile";

export type ProfileRow = typeof schema.profiles.$inferSelect;

// the newer answers with nothing filled in
const BLANK_EXTRAS: ProfileExtras = { preferredName: null, pronouns: null, streetAddress: null, over18: null, howHeard: null, noticePeriod: null, school: null, degree: null, major: null, graduationYear: null, gpa: null, eeoHispanic: DECLINE };

// where the newer answers are kept, one bundle per person
const extrasKey = (userId: string) => `application:${userId}`;

// reads the bundle of newer answers, blank when it was never saved
async function getExtras(userId: string): Promise<{ extras: ProfileExtras; saved: boolean }> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, extrasKey(userId))).limit(1);
  return { extras: { ...BLANK_EXTRAS, ...((row?.value as Partial<ProfileExtras> | undefined) ?? {}) }, saved: row !== undefined };
}

// true once the application form has been saved with the self-identification questions on it
export async function applicationAnswered(userId: string): Promise<boolean> {
  return (await getExtras(userId)).saved;
}

// a profile with nothing filled in, demographic answers start on "decline"
const BLANK: Profile = {
  ...BLANK_EXTRAS,
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
  workAuthorization: null,
  needsSponsorship: null,
  willingToRelocate: null,
  desiredSalaryMin: null,
  desiredSalaryMax: null,
  earliestStartDate: null,
  jobTypes: [],
  preferredIndustries: [],
  remotePreference: null,
  eeoGender: DECLINE,
  eeoRace: DECLINE,
  eeoVeteran: DECLINE,
  eeoDisability: DECLINE,
  qaBank: [],
};

// the saved profile, or a blank one for someone who has not filled it in
export async function getProfile(userId: string): Promise<Profile> {
  const db = await getDb();
  const [[row], { extras }] = await Promise.all([db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1), getExtras(userId)]);
  if (!row) return { ...BLANK, ...extras };
  return {
    ...extras,
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
    workAuthorization: row.workAuthorization,
    needsSponsorship: row.needsSponsorship,
    willingToRelocate: row.willingToRelocate,
    desiredSalaryMin: row.desiredSalaryMin,
    desiredSalaryMax: row.desiredSalaryMax,
    earliestStartDate: row.earliestStartDate,
    jobTypes: row.jobTypes as Profile["jobTypes"],
    preferredIndustries: row.preferredIndustries,
    remotePreference: row.remotePreference,
    eeoGender: row.eeoGender as Profile["eeoGender"],
    eeoRace: row.eeoRace as Profile["eeoRace"],
    eeoVeteran: row.eeoVeteran as Profile["eeoVeteran"],
    eeoDisability: row.eeoDisability as Profile["eeoDisability"],
    qaBank: (row.qaBank as QaEntry[]) ?? [],
  };
}

// saves the whole profile form
export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const db = await getDb();
  // the first set of answers has columns of its own, the newer ones are saved together as one bundle
  const extras = Object.fromEntries(EXTRA_KEYS.map((key) => [key, profile[key]]));
  const columns = Object.fromEntries(Object.entries(profile).filter(([key]) => !(EXTRA_KEYS as readonly string[]).includes(key))) as Omit<Profile, keyof ProfileExtras>;
  await db.insert(schema.profiles).values({ userId, ...columns }).onConflictDoUpdate({ target: schema.profiles.userId, set: columns });
  await db.insert(schema.appSettings).values({ key: extrasKey(userId), value: extras }).onConflictDoUpdate({ target: schema.appSettings.key, set: { value: extras } });
}

// adds an answer to the question bank, replacing an older answer to the same question
export async function saveAnswer(userId: string, entry: QaEntry): Promise<void> {
  const profile = await getProfile(userId);
  const same = (question: string) => question.trim().toLowerCase() === entry.question.trim().toLowerCase();
  const qaBank = [...profile.qaBank.filter((saved) => !same(saved.question)), entry].slice(-100);
  const db = await getDb();
  await db.insert(schema.profiles).values({ userId, qaBank }).onConflictDoUpdate({ target: schema.profiles.userId, set: { qaBank } });
}

// true once enough is filled in for autofill to be useful
export function profileReady(profile: Profile): boolean {
  return Boolean(profile.fullName && profile.email && profile.phone);
}
