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

test("connect the extension, then save and scan a job the way it does", async ({ page, request, baseURL }) => {
  // a resume to scan against
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);

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
  expect(me.user.email).toBeTruthy();
  expect(me.resumes.length).toBeGreaterThan(0);
  // only what scanning needs is handed over
  expect(Object.keys(me).sort()).toEqual(["resumes", "user"]);

  // no key and a made up key are turned away
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

  expect(scan.jobId).toBe(saved.jobId);

  // scanning from the application page, at a different address, still lands on the same card
  const again = await (await request.post("/api/ext/scan", { headers, data: { jdText: JD, title: "support specialist", company: "Harbor Freight Co", url: "https://apply.example.com/harbor/77/form" } })).json();
  expect(again).toMatchObject({ jobId: saved.jobId, addedToTracker: false });

  // a job that was never saved gets a card of its own when it is scanned, with the score on it
  const fresh = await (await request.post("/api/ext/scan", { headers, data: { jdText: JD, title: "Help Desk Agent", company: "Pier Nine", url: "https://jobs.example.com/pier/3" } })).json();
  expect(fresh.addedToTracker).toBe(true);
  await page.goto("/tracker");
  const card = page.getByRole("region", { name: "Saved", exact: true }).getByRole("listitem").filter({ hasText: "Help Desk Agent" });
  await expect(card.getByRole("meter", { name: "Match rate" })).toHaveAttribute("aria-valuenow", String(fresh.matchRate));
  // the dashboard shows the same ring where the logo used to be
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Saved jobs" }).getByRole("listitem").filter({ hasText: "Help Desk Agent" }).getByRole("meter", { name: "Match rate" })).toHaveAttribute("aria-valuenow", String(fresh.matchRate));

  // the saved job is on the tracker, and the scan opens as a full report
  await page.goto("/tracker");
  await expect(page.getByRole("region", { name: "Saved", exact: true }).getByText("Support Specialist")).toBeVisible();
  await page.goto(`/scans/${scan.scanId}`);
  await expect(page.getByRole("tab", { name: "Resume report" })).toBeVisible();

  // the things the extension used to do for applications are gone
  for (const path of ["answer", "applications", "qa", "match"]) expect((await request.post(`/api/ext/${path}`, { headers, data: {} })).status()).toBe(404);
  expect((await page.goto("/auto-apply"))?.status()).toBe(404);

  // a linkedin profile the extension read is waiting in the optimizer, already filled in
  await request.post("/api/ext/linkedin", { headers, data: { headline: "Support Specialist | Zendesk", about: "I help people get unstuck.", experience: "Support Specialist\nHarbor Freight Co", skills: ["Zendesk", "Excel"], url: "linkedin.com/in/sam" } });
  await page.goto("/linkedin");
  await expect(page.getByText("Imported from your LinkedIn profile")).toBeVisible();
  await expect(page.getByLabel("Headline")).toHaveValue("Support Specialist | Zendesk");

  // disconnecting cuts the key off straight away
  await page.goto("/extension");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Disconnected.")).toBeVisible();
  expect((await request.get("/api/ext/me", { headers })).status()).toBe(401);
});
