import { expect, test } from "@playwright/test";

const JD = `Support Specialist at Harbor Freight Co

Requirements
2+ years of customer service experience
Strong written communication
Experience with Zendesk and troubleshooting
`;

const RESUME = `Riley Chen
Portland, OR | riley.chen@example.com | (503) 555-0177

Summary
Support specialist who solves customer problems quickly and kindly.

Work Experience
Support Specialist, Lakeside Outfitters
Mar 2022 - Present
• Answered 60 tickets a day in Zendesk
• Wrote 25 help articles that cut repeat questions by 30%

Education
B.A. Communications, State University, 2021
`;

test("fill in the profile, connect the extension and follow an application through", async ({ page, request, baseURL }) => {
  // a resume to work with
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);

  // the profile autofill reads from
  await page.goto("/settings");
  await page.getByLabel("Full name", { exact: true }).fill("Riley Chen");
  await page.getByLabel("Email", { exact: true }).fill("riley.chen@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("(503) 555-0177");
  await page.getByLabel("City", { exact: true }).fill("Portland");
  await page.getByLabel("Will you need visa sponsorship?").selectOption("no");
  await page.getByLabel("Desired salary, lowest").fill("not a number");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Use a plain number, like 85000.")).toBeVisible();
  await page.getByLabel("Desired salary, lowest").fill("52000");
  // demographic answers start on decline
  await expect(page.getByRole("combobox", { name: /^Gender/ })).toHaveValue("Decline to self-identify");
  await page.getByRole("button", { name: "Add an answer" }).click();
  await page.getByRole("textbox", { name: "Question 1" }).fill("Why do you want to work here?");
  await page.getByRole("textbox", { name: "Answer 1" }).fill("I like helping people get unstuck.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // connect: with no extension to reach, the page gives a code to paste
  await page.goto("/extension");
  await expect(page.getByText("The extension is not connected yet.")).toBeVisible();
  await page.getByRole("button", { name: "Connect extension" }).click();
  const code = await page.getByLabel("Connection code").inputValue();
  const { apiBase, token } = JSON.parse(Buffer.from(code, "base64").toString()) as { apiBase: string; token: string };
  expect(apiBase).toBe(baseURL);

  // from here on we are the extension, calling in with that key
  const headers = { Authorization: `Bearer ${token}` };
  const me = await (await request.get("/api/ext/me", { headers })).json();
  expect(me.profile).toMatchObject({ fullName: "Riley Chen", needsSponsorship: false, desiredSalaryMin: 52000, eeoRace: "Decline to self-identify" });
  expect(me.profileReady).toBe(true);
  expect(me.current).toEqual({ title: "Support Specialist", company: "Lakeside Outfitters" });

  // no key, a made up key and the key of a disconnected extension are all turned away
  expect((await request.get("/api/ext/me")).status()).toBe(401);
  expect((await request.get("/api/ext/me", { headers: { Authorization: "Bearer rf_made_up" } })).status()).toBe(401);

  // save the job from the posting, saving it twice gives the same card
  const job = { title: "Support Specialist", company: "Harbor Freight Co", url: "https://jobs.example.com/harbor/77", description: JD };
  const saved = await (await request.post("/api/ext/jobs", { headers, data: job })).json();
  expect(saved.alreadySaved).toBe(false);
  expect((await (await request.post("/api/ext/jobs", { headers, data: job })).json()).jobId).toBe(saved.jobId);

  // scan it from the panel
  const scan = await (await request.post("/api/ext/scan", { headers, data: { jdText: JD, title: job.title, company: job.company, url: job.url, jobId: saved.jobId } })).json();
  expect(scan.matchRate).toBeGreaterThan(0);
  expect(scan.matchRate).toBeLessThanOrEqual(100);
  expect(scan.scanId).toMatch(/^[0-9a-f-]{36}$/);

  // the resume file to attach comes back as a real pdf
  const file = await (await request.get(`/api/ext/resumes/${me.resumes[0].id}`, { headers })).json();
  expect(Buffer.from(file.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");

  // a question we have a saved answer for uses it, a new one gets a draft to review
  const known = await (await request.post("/api/ext/answer", { headers, data: { question: "Why do you want to work at Harbor Freight Co?", jdText: JD } })).json();
  expect(known).toMatchObject({ source: "saved", answer: "I like helping people get unstuck." });
  const fresh = await (await request.post("/api/ext/answer", { headers, data: { question: "Describe a time you calmed down an upset customer.", jdText: JD } })).json();
  expect(fresh.source).toBe("ai");
  await request.post("/api/ext/qa", { headers, data: { question: "Describe a time you calmed down an upset customer.", answer: "I listened first, then fixed the order." } });

  // the autofill run is logged, then marked as applied once the person has submitted
  const report = { jobId: saved.jobId, ats: "Greenhouse", applyUrl: job.url, fieldsFilled: 9, fieldsNeedingAttention: 2 };
  await request.post("/api/ext/applications", { headers, data: { ...report, status: "needs_review" } });
  await page.goto("/auto-apply");
  await expect(page.getByText("The extension is connected.")).toBeVisible();
  await page.getByRole("tab", { name: "All Applications" }).click();
  await expect(page.getByRole("row", { name: /Support Specialist/ })).toContainText("Needs review");
  await expect(page.getByRole("row", { name: /Support Specialist/ })).toContainText("9 filled, 2 to check");

  await request.post("/api/ext/applications", { headers, data: { ...report, status: "applied", fieldsNeedingAttention: 0, today: "2026-10-08" } });
  await page.reload();
  await page.getByRole("tab", { name: "All Applications" }).click();
  await expect(page.getByRole("row", { name: /Support Specialist/ })).toContainText("Applied");
  // one row for the page, not one per report
  await expect(page.getByRole("row", { name: /Support Specialist/ })).toHaveCount(1);

  // the tracker moved the card to applied with the date
  await page.goto("/tracker");
  await expect(page.getByRole("region", { name: "Applied", exact: true }).getByText("Support Specialist")).toBeVisible();
  await page.getByRole("link", { name: /Support Specialist/ }).click();
  await expect(page.getByLabel("Date applied")).toHaveValue("2026-10-08");

  // the saved answer is in the profile now
  await page.goto("/settings");
  await expect(page.getByRole("textbox", { name: "Question 2" })).toHaveValue("Describe a time you calmed down an upset customer.");

  // the first Auto Apply explains itself before opening anything
  await page.goto("/auto-apply");
  await page.getByRole("button", { name: "Auto Apply" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("You always submit.");
  // answer for the made up job site ourselves, so the test never touches the real internet
  await page.context().route("https://jobs.example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Apply here</h1>" }));
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "I understand, open the application" }).click();
  const opened = await popup;
  await opened.waitForURL(/jobs\.example\.com/);
  expect(opened.url()).toBe("https://jobs.example.com/harbor/77");

  // disconnecting cuts the key off straight away
  await page.goto("/extension");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Disconnected.")).toBeVisible();
  expect((await request.get("/api/ext/me", { headers })).status()).toBe(401);
});
