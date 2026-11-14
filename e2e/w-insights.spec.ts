import { expect, test } from "./fixtures";

// the day twenty days before today, the way the tracker keeps dates
function daysAgo(days: number): string {
  const then = new Date(Date.now() - days * 86_400_000);
  return `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, "0")}-${String(then.getDate()).padStart(2, "0")}`;
}

test("the report explains its score, shows what an applicant system reads, and says who can apply", async ({ page }) => {
  await page.goto("/scans/sample");
  // where the number comes from, and what would raise it
  await page.getByText(/^Why \d+%\?$/).click();
  await expect(page.getByRole("table", { name: "Where the match rate comes from" })).toContainText("Hard skills");
  await expect(page.getByText("Each number is your resume scored again with that one thing fixed.")).toBeVisible();
  // the resume as a form
  await page.getByRole("tab", { name: "What the ATS sees" }).click();
  await expect(page.getByRole("heading", { name: "What the applicant system sees" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Job 1" })).toBeVisible();

  // a posting with rules about who can apply gets them checked at the top
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill("Riley Chen\nPortland, OR | riley.chen@example.com | (503) 555-0177\n\nWork Experience\nFrontend Engineer, Lakeside Outfitters\nMar 2022 - Present\n• Rebuilt the checkout in React and TypeScript, cutting drop off by 18%\n\nEducation\nB.S. Computer Science, State University, 2021\n");
  await page.getByLabel("2. Paste the job description").fill("Flight Software Engineer at Northwind Aerospace\n\nRequirements\n3+ years of experience with TypeScript and React\nMust be a U.S. citizen.\nWe are unable to sponsor visas for this role.\nThis is an onsite role in Costa Mesa, CA.\n");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  const rules = page.getByRole("region", { name: "Can you apply?" });
  await expect(rules).toContainText("This role asks for US citizenship");
  await expect(rules).toContainText('"Must be a U.S. citizen."');
  await expect(rules).toContainText("does not sponsor visas");
  await expect(rules).toContainText("expects you in person");

  // every saved resume scored against this job in one press, and a better one can be switched to
  await page.getByRole("button", { name: "Which of my resumes fits best?" }).click();
  const mine = page.getByRole("region", { name: "Your resumes for this job" });
  await expect(mine.getByRole("listitem").first()).toContainText("%");
  await expect(mine).toContainText("(this scan)");
  const other = mine.getByRole("button", { name: "Use it" }).first();
  if (await other.count()) {
    const before = page.url();
    await other.click();
    await expect(page).not.toHaveURL(before);
    await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  }
});

test("the results page adds the tracker up and offers a follow up note for an application gone quiet", async ({ page, request, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/extension");
  await page.getByRole("button", { name: /Connect (extension|again)/ }).click();
  const code = await page.getByLabel("Connection code").inputValue();
  const { token } = JSON.parse(Buffer.from(code, "base64").toString()) as { token: string };
  const headers = { Authorization: `Bearer ${token}` };

  // an application sent twenty days ago and not answered since
  const job = await (await request.post("/api/ext/jobs", { headers, data: { title: "Quiet Pipeline Engineer", company: "Stillwater", url: "https://jobs.lever.co/stillwater/55", description: "Frontend Engineer\n\nRequirements\nTypeScript and React and clear written communication\n" } })).json();
  await request.post("/api/ext/applications", { headers, data: { jobId: job.jobId, ats: "Lever", applyUrl: "https://jobs.lever.co/stillwater/55/apply", status: "applied", fieldsFilled: 8, fieldsNeedingAttention: 0, today: daysAgo(20) } });

  await page.goto("/tracker");
  await page.getByRole("link", { name: "See your results" }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole("heading", { name: "Applications per week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By match score" })).toBeVisible();
  const quiet = page.getByRole("region", { name: "Worth a follow up" }).getByRole("listitem").filter({ hasText: "Quiet Pipeline Engineer" });
  await expect(quiet).toContainText("Stillwater, sent 20 days ago");
  await quiet.getByRole("button", { name: "Copy a follow up note" }).click();
  await expect(quiet.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("I applied for the Quiet Pipeline Engineer role at Stillwater");

  // the dashboard brings it up too
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Worth a follow up" })).toContainText("Quiet Pipeline Engineer");
});
