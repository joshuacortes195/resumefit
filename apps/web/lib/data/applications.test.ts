import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { deleteAccount, exportAccount } from "./account";
import { applicationForJob, listApplications, recordApplication, type ApplicationDetails } from "./applications";
import { createJob } from "./jobs";
import { getProfile, saveProfile } from "./profile";

// makes a person with one job on their tracker
async function person() {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email: `apply-${id}@example.com` });
  const job = await createJob(id, { title: "Data Analyst", company: "Acme", url: "https://careers.acme.example/jobs/7" });
  return { id, job };
}

const DETAILS: ApplicationDetails = {
  answers: [
    { label: "Email", value: "pat@example.com", status: "filled" },
    { label: "Are you legally authorized to work in the United States?", value: "Yes", status: "filled" },
    { label: "Why do you want to work here?", value: "I like the work.", status: "review" },
  ],
  resumeId: null,
  resumeName: "My resume",
  coverLetter: true,
  appliedAt: null,
};

describe("auto apply runs", () => {
  it("keeps one row per job, updated as the run moves along", async () => {
    const { id, job } = await person();
    const first = await recordApplication(id, { jobId: job.id, ats: "Greenhouse", applyUrl: "https://boards.greenhouse.io/acme/jobs/7", status: "needs_review", fieldsFilled: 9, fieldsNeedingAttention: 2, details: DETAILS });
    // the same job, reported again from the form's address once it was sent
    const second = await recordApplication(id, { jobId: job.id, ats: "Greenhouse", applyUrl: "https://boards.greenhouse.io/acme/jobs/7#app", status: "applied", fieldsFilled: 11, fieldsNeedingAttention: 0 });
    expect(second).toBe(first);
    const runs = await listApplications(id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "applied", fieldsFilled: 11, jobTitle: "Data Analyst", company: "Acme" });
    // a report that came without the answers keeps the copy from before
    expect((await applicationForJob(id, job.id))?.details?.answers).toHaveLength(3);
  });

  it("stores the answers locked, and only shows them to their owner", async () => {
    const { id, job } = await person();
    const other = await person();
    await recordApplication(id, { jobId: job.id, ats: null, applyUrl: "https://careers.acme.example/apply/7", status: "needs_review", fieldsFilled: 3, fieldsNeedingAttention: 1, details: DETAILS });
    const db = await getDb();
    const [row] = await db.select().from(schema.applications).where(eq(schema.applications.userId, id));
    expect(Object.keys(row?.aiAnswers as object)).toEqual(["sealed"]);
    expect(JSON.stringify(row)).not.toContain("legally authorized");
    expect(JSON.stringify(row)).not.toContain("I like the work.");
    // someone else asking about the same job id gets nothing
    expect(await applicationForJob(other.id, job.id)).toBeNull();
    expect(await listApplications(other.id)).toHaveLength(0);
    expect((await applicationForJob(id, job.id))?.details).toMatchObject({ resumeName: "My resume", coverLetter: true });
  });

  it("hands the answers back readable in the export, and removes them with the account", async () => {
    const { id, job } = await person();
    await recordApplication(id, { jobId: job.id, ats: null, applyUrl: "https://careers.acme.example/apply/7", status: "applied", fieldsFilled: 3, fieldsNeedingAttention: 0, details: DETAILS });
    await saveProfile(id, { ...(await getProfile(id)), school: "State University", eeoGender: "Female" });
    const zip = await JSZip.loadAsync(await exportAccount(id));
    const data = JSON.parse((await zip.file("data.json")?.async("string")) ?? "{}");
    expect(data.applications[0].details.answers[2].value).toBe("I like the work.");
    expect(data.application).toMatchObject({ school: "State University", eeoGender: "Female" });
    expect(JSON.stringify(data)).not.toContain("sealed");

    await deleteAccount(id);
    const db = await getDb();
    expect(await db.select().from(schema.applications).where(eq(schema.applications.userId, id))).toHaveLength(0);
    expect(await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, `application:${id}`))).toHaveLength(0);
  });
});
