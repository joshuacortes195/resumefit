import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DECLINE, type Profile, type QaEntry } from "@/lib/profile";

export type ProfileRow = typeof schema.profiles.$inferSelect;

// a profile with nothing filled in, demographic answers start on "decline"
const BLANK: Profile = {
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
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  if (!row) return BLANK;
  return {
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
  await db.insert(schema.profiles).values({ userId, ...profile }).onConflictDoUpdate({ target: schema.profiles.userId, set: profile });
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
