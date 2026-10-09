import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { remainingToday } from "@/lib/ai/limits";
import { deleteAccount, exportAccount } from "./account";
import { createInvite, listUsers, newInviteCode } from "./admin";
import { createJob } from "./jobs";
import { saveResume } from "./resumes";
import { createScan } from "./scans";
import { dailyCaps, featureFlags, saveDailyCaps, saveFeatureFlags } from "./settings";

// makes a person with a resume, a scan and a job
async function seedPerson(email: string) {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email });
  const resume = await saveResume(id, { name: "My resume", text: `Pat Doe\npat@example.com\n\nWork Experience\nAnalyst, Acme\n• Did things for ${email}\n`, file: { bytes: new TextEncoder().encode("%PDF-fake"), type: "pdf" } });
  await createScan(id, { resumeId: resume.id, resumeText: resume.rawText ?? "", layout: null, jdText: "Data Analyst\nSQL and Tableau, with clear communication across the whole team." });
  await createJob(id, { title: "Data Analyst", company: "Acme" });
  return { id, resume };
}

describe("account export and delete", () => {
  it("exports only that person's data, with their files", async () => {
    const pat = await seedPerson("pat@example.com");
    await seedPerson("someone.else@example.com");

    const zip = await JSZip.loadAsync(await exportAccount(pat.id));
    const data = JSON.parse((await zip.file("data.json")?.async("string")) ?? "{}");
    expect(data.account.email).toBe("pat@example.com");
    expect(data.resumes).toHaveLength(1);
    expect(data.scans).toHaveLength(1);
    expect(data.jobs).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("someone.else@example.com");
    expect(await zip.file("files/My resume.pdf")?.async("string")).toBe("%PDF-fake");
  });

  it("deletes the person, everything of theirs, and nobody else's", async () => {
    const gone = await seedPerson("gone@example.com");
    const stays = await seedPerson("stays@example.com");
    await deleteAccount(gone.id);

    const db = await getDb();
    for (const table of [schema.resumes, schema.scans, schema.jobs]) {
      expect(await db.select().from(table).where(eq(table.userId, gone.id))).toHaveLength(0);
      expect((await db.select().from(table).where(eq(table.userId, stays.id))).length).toBeGreaterThan(0);
    }
    expect((await listUsers()).some((user) => user.email === "gone@example.com")).toBe(false);
    // the export of a deleted account is empty rather than an error
    expect(JSON.parse((await (await JSZip.loadAsync(await exportAccount(gone.id))).file("data.json")?.async("string")) ?? "{}").account).toBeNull();
  });
});

describe("admin settings", () => {
  it("makes invite codes without look alike characters", async () => {
    for (let round = 0; round < 20; round++) expect(newInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const db = await getDb();
    const [admin] = await db.insert(schema.users).values({ email: `admin-${randomUUID()}@example.com`, isAdmin: true }).returning();
    const code = await createInvite(admin?.id ?? "", 3, 7);
    const [saved] = await db.select().from(schema.inviteCodes).where(eq(schema.inviteCodes.code, code));
    expect(saved).toMatchObject({ maxUses: 3, uses: 0 });
    expect(saved?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it("lets the caps and switches be changed, and uses the changed caps", async () => {
    expect((await featureFlags()).findJobs).toBe(false);
    await saveFeatureFlags({ findJobs: true, interviewVoice: false });
    expect(await featureFlags()).toEqual({ findJobs: true, interviewVoice: false });

    const person = await seedPerson(`caps-${randomUUID()}@example.com`);
    expect(await remainingToday(person.id, "cover-letter")).toBe(10);
    await saveDailyCaps({ "cover-letter": 3 });
    expect((await dailyCaps())["cover-letter"]).toBe(3);
    expect(await remainingToday(person.id, "cover-letter")).toBe(3);
    // reading job descriptions has no cap and cannot be given one
    await saveDailyCaps({ "cover-letter": 10, "jd-extraction": 5 } as never);
    expect((await dailyCaps())["jd-extraction"]).toBeNull();
  });
});
