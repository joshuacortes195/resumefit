import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { DECLINE, profileSchema, type ProfileInput } from "@/lib/profile";
import { applicationAnswered, getProfile, profileReady, saveAnswer, saveProfile } from "./profile";

// a filled in form, the way the page sends it
const FORM: ProfileInput = {
  fullName: "Jordan Lee",
  email: "jordan.lee@example.com",
  phone: "(512) 555-0142",
  city: "Austin",
  state: "TX",
  country: "United States",
  zip: "78701",
  linkedinUrl: "https://linkedin.com/in/jordanlee",
  githubUrl: "",
  portfolioUrl: "",
  otherLinks: [],
  yearsExperience: "4",
  workAuthorization: "US citizen",
  needsSponsorship: "no",
  willingToRelocate: "yes",
  desiredSalaryMin: "",
  desiredSalaryMax: "",
  earliestStartDate: "2027-06-01",
  jobTypes: ["Internship"],
  preferredIndustries: [],
  remotePreference: "",
  eeoGender: "Female",
  eeoRace: "Asian",
  eeoVeteran: "I am not a protected veteran",
  eeoDisability: DECLINE,
  qaBank: [{ question: "Why do you want this role?", answer: "I like building tools people use every day." }],
  preferredName: "Jo",
  pronouns: "She/her",
  streetAddress: "1 Main St",
  over18: "yes",
  howHeard: "LinkedIn",
  noticePeriod: "",
  school: "State University",
  degree: "Bachelor's degree",
  major: "Computer Science",
  graduationMonth: "May",
  graduationYear: "2027",
  gpa: "3.8",
  gpaNeverFill: true,
  autoSend: "off",
  dailySendCap: "10",
  eeoHispanic: "No",
};

describe("application profile", () => {
  it("starts blank, with every self-identification answer on decline", async () => {
    const user = await getCurrentUser();
    const profile = await getProfile(user.id);
    expect(profile.fullName).toBeNull();
    expect([profile.eeoGender, profile.eeoRace, profile.eeoVeteran, profile.eeoDisability, profile.eeoHispanic]).toEqual([DECLINE, DECLINE, DECLINE, DECLINE, DECLINE]);
    // sending is never on until the person switches it on
    expect([profile.autoSend, profile.dailySendCap]).toEqual(["off", 10]);
    expect(profileSchema.safeParse({ ...FORM, dailySendCap: "26" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...FORM, dailySendCap: "0" }).success).toBe(false);
    expect(profileSchema.parse({ ...FORM, autoSend: "all", dailySendCap: "25" })).toMatchObject({ autoSend: "all", dailySendCap: 25 });
    expect(profileReady(profile)).toBe(false);
    expect(await applicationAnswered(user.id)).toBe(false);
  });

  it("gives back what was saved", async () => {
    const user = await getCurrentUser();
    await saveProfile(user.id, profileSchema.parse(FORM));
    const profile = await getProfile(user.id);
    expect(profile).toMatchObject({ fullName: "Jordan Lee", workAuthorization: "US citizen", needsSponsorship: false, eeoGender: "Female", eeoRace: "Asian", school: "State University", graduationMonth: "May", graduationYear: "2027", gpa: "3.8", gpaNeverFill: true, yearsExperience: 4 });
    expect(profile.qaBank).toHaveLength(1);
    expect(profileReady(profile)).toBe(true);
    expect(await applicationAnswered(user.id)).toBe(true);
  });

  it("stores nothing about work authorization, sponsorship, school or self-identification in the open", async () => {
    const user = await getCurrentUser();
    await saveProfile(user.id, profileSchema.parse(FORM));
    const db = await getDb();
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
    const [bundle] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, `application:${user.id}`));
    // the old columns are wiped
    expect(row).toMatchObject({ workAuthorization: null, needsSponsorship: null, eeoGender: DECLINE, eeoRace: DECLINE, eeoVeteran: DECLINE, eeoDisability: DECLINE });
    // and the bundle is one sealed string with none of the answers readable in it
    const stored = JSON.stringify([row, bundle]);
    expect(Object.keys(bundle?.value as object)).toEqual(["sealed"]);
    for (const secret of ["Female", "Asian", "protected veteran", "US citizen", "State University", "Computer Science", "3.8", "She/her", "1 Main St"]) expect(stored).not.toContain(secret);
  });

  it("still reads answers an older version left in the open, and locks them on the next save", async () => {
    const user = await getCurrentUser();
    const db = await getDb();
    await db.update(schema.profiles).set({ eeoGender: "Male", workAuthorization: "Work visa", needsSponsorship: true }).where(eq(schema.profiles.userId, user.id));
    await db.update(schema.appSettings).set({ value: { school: "Old College", eeoHispanic: "Yes" } }).where(eq(schema.appSettings.key, `application:${user.id}`));
    const before = await getProfile(user.id);
    expect(before).toMatchObject({ eeoGender: "Male", workAuthorization: "Work visa", needsSponsorship: true, school: "Old College", eeoHispanic: "Yes" });
    await saveProfile(user.id, before);
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
    expect(row).toMatchObject({ eeoGender: DECLINE, workAuthorization: null, needsSponsorship: null });
    expect(await getProfile(user.id)).toMatchObject({ eeoGender: "Male", workAuthorization: "Work visa", school: "Old College" });
  });

  it("keeps one saved answer per question", async () => {
    const user = await getCurrentUser();
    await saveAnswer(user.id, { question: "Why do you want this role?", answer: "A newer answer." });
    await saveAnswer(user.id, { question: "What are you proudest of?", answer: "Shipping a tool my team still uses." });
    const { qaBank } = await getProfile(user.id);
    expect(qaBank.map((entry) => entry.question)).toEqual(["Why do you want this role?", "What are you proudest of?"]);
    expect(qaBank[0]?.answer).toBe("A newer answer.");
  });
});
