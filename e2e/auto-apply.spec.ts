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

  // before the extension is set up, the page says plainly that it is needed, and the button explains instead of opening anything
  await page.goto("/auto-apply");
  await expect(page.getByRole("heading", { name: "Auto Apply needs the ResumeFit Chrome extension" })).toBeVisible();

  // the one application autofill reads from, reached from Auto Apply
  await page.getByRole("link", { name: "Fill in my application" }).click();
  await expect(page).toHaveURL(/\/auto-apply\/application$/);
  // going back with nothing changed just goes back
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/auto-apply$/);
  await page.goto("/auto-apply/application");
  await expect(page.getByText("Going back does not save your changes.")).toBeVisible();
  // saved answers are not part of the form any more
  await expect(page.getByRole("button", { name: "Add an answer" })).toHaveCount(0);
  await page.getByLabel("Full name", { exact: true }).fill("Riley Chen");
  await page.getByLabel("Email", { exact: true }).fill("riley.chen@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("(503) 555-0177");
  await page.getByLabel("City", { exact: true }).fill("Portland");
  await page.getByLabel("Will you need visa sponsorship?").selectOption("no");
  await page.getByLabel("Desired salary, lowest").fill("not a number");
  // back with changes warns that they will be lost, and staying keeps them
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("dialog")).toContainText("Your changes have not been saved");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Portland");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page.getByText("Use a plain number, like 85000.")).toBeVisible();
  await page.getByLabel("Desired salary, lowest").fill("52000");
  // the rest of the one application: school, and the question forms ask apart from race
  await page.getByLabel("School", { exact: true }).fill("State University");
  await page.getByRole("combobox", { name: "Degree" }).selectOption("Bachelor's degree");
  await page.getByLabel("Are you 18 or older?").selectOption("yes");
  await expect(page.getByLabel("Are you Hispanic or Latino?")).toHaveValue("Decline to self-identify");
  await page.getByLabel("Are you Hispanic or Latino?").selectOption("No");
  // demographic answers start on decline
  await expect(page.getByRole("combobox", { name: /^Gender/ })).toHaveValue("Decline to self-identify");
  // finished saves and goes back to Auto Apply
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page).toHaveURL(/\/auto-apply$/);

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
  expect(me.profile).toMatchObject({ school: "State University", degree: "Bachelor's degree", over18: true, eeoHispanic: "No", pronouns: null });
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

  // an answer saved from the panel is reused, a new question gets a draft to review
  await request.post("/api/ext/qa", { headers, data: { question: "Why do you want to work here?", answer: "I like helping people get unstuck." } });
  const known = await (await request.post("/api/ext/answer", { headers, data: { question: "Why do you want to work at Harbor Freight Co?", jdText: JD } })).json();
  expect(known).toMatchObject({ source: "saved", answer: "I like helping people get unstuck." });
  const fresh = await (await request.post("/api/ext/answer", { headers, data: { question: "Describe a time you calmed down an upset customer.", jdText: JD } })).json();
  expect(fresh.source).toBe("ai");
  await request.post("/api/ext/qa", { headers, data: { question: "Describe a time you calmed down an upset customer.", answer: "I listened first, then fixed the order." } });

  // questions the extension did not recognize are matched to saved answers by name. what is not saved or not known is dropped
  const matched = await (
    await request.post("/api/ext/match", {
      headers,
      data: {
        fields: [
          { id: "rf-1", label: "Which town do you call home?" },
          { id: "rf-2", label: "What did you study?" },
          { id: "rf-3", label: "Can you lift 50 pounds?", options: ["Yes", "No"] },
        ],
        // nothing is saved for major, so that match is not allowed through
        keys: ["city", "phone", "not-a-real-answer"],
      },
    })
  ).json();
  expect(matched).toEqual({ matches: [{ id: "rf-1", key: "city" }] });

  // the autofill run is logged, then marked as applied once the person has submitted
  const report = { jobId: saved.jobId, ats: "Greenhouse", applyUrl: job.url, fieldsFilled: 9, fieldsNeedingAttention: 2 };
  await request.post("/api/ext/applications", { headers, data: { ...report, status: "needs_review" } });
  await page.goto("/auto-apply");
  await expect(page.getByText("The extension is connected.")).toBeVisible();
  // the checklist for the one application shows what is done and what is left
  const checklist = page.getByRole("region", { name: "Your one application" });
  await expect(checklist.getByRole("listitem").filter({ hasText: "Education" })).toContainText("done");
  await expect(checklist.getByRole("listitem").filter({ hasText: "Self-identification" })).toContainText("done");
  await expect(checklist.getByRole("listitem").filter({ hasText: "Links" })).toContainText("not filled in yet");
  await expect(checklist.getByRole("link", { name: "Finish my application" })).toBeVisible();
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

  // saving the application again keeps the answers saved from the panel
  await page.goto("/auto-apply/application");
  await page.getByLabel("City", { exact: true }).fill("Salem");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page).toHaveURL(/\/auto-apply$/);
  expect(await (await request.post("/api/ext/answer", { headers, data: { question: "Describe a time you calmed down an upset customer.", jdText: JD } })).json()).toMatchObject({ source: "saved" });

  // a linkedin profile the extension read is waiting in the optimizer, already filled in
  await request.post("/api/ext/linkedin", { headers, data: { headline: "Support Specialist | Zendesk", about: "I help people get unstuck.", experience: "Support Specialist\nHarbor Freight Co", skills: ["Zendesk", "Excel"], url: "linkedin.com/in/sam" } });
  await page.goto("/linkedin");
  await expect(page.getByText("Imported from your LinkedIn profile")).toBeVisible();
  await expect(page.getByLabel("Headline")).toHaveValue("Support Specialist | Zendesk");
  await expect(page.getByLabel("Skills")).toHaveValue("Zendesk, Excel");

  // the first Auto Apply explains itself before opening anything
  await page.goto("/auto-apply");
  // the card shows how its application went, and its button now reads Open again
  const tracked = page.getByRole("region", { name: "From your tracker" });
  await expect(tracked.getByRole("listitem").filter({ hasText: "Support Specialist" })).toContainText("Applied");
  await tracked.getByRole("button", { name: "Open again" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("You always submit.");
  // answer for the made up job site ourselves, so the test never touches the real internet
  await page.context().route("https://jobs.example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Apply here</h1>" }));
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "I understand, open the application" }).click();
  const opened = await popup;
  await opened.waitForURL(/jobs\.example\.com/);
  expect(opened.url()).toBe("https://jobs.example.com/harbor/77");

  // submit for me is off until it is switched on, and the rules are shown first
  await page.goto("/auto-apply");
  expect((await (await request.get("/api/ext/me", { headers })).json()).autoSubmit).toBe(false);
  const submitSwitch = page.getByRole("switch", { name: "Submit for me" });
  await expect(submitSwitch).toHaveAttribute("aria-checked", "false");
  await submitSwitch.click();
  await expect(page.getByRole("dialog")).toContainText("There is no captcha");
  await page.getByRole("button", { name: "Keep it off" }).click();
  await expect(submitSwitch).toHaveAttribute("aria-checked", "false");
  await submitSwitch.click();
  await page.getByRole("button", { name: "Turn it on" }).click();
  await expect(submitSwitch).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await (await request.get("/api/ext/me", { headers })).json()).autoSubmit).toBe(true);
  // and it stays on after a reload, then goes off in one click
  await page.reload();
  await expect(submitSwitch).toHaveAttribute("aria-checked", "true");
  await submitSwitch.click();
  await expect.poll(async () => (await (await request.get("/api/ext/me", { headers })).json()).autoSubmit).toBe(false);

  // disconnecting cuts the key off straight away
  await page.goto("/extension");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Disconnected.")).toBeVisible();
  expect((await request.get("/api/ext/me", { headers })).status()).toBe(401);
});
