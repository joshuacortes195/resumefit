import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { expect, test } from "./fixtures";

// where the built extension lives, and a saved application form to fill in
const EXTENSION = path.join(__dirname, "../apps/extension/dist");
const FORM = readFileSync(path.join(__dirname, "../apps/extension/test/fixtures/greenhouse.html"), "utf8");

const JD = `Frontend Engineer at Brightside Labs

Requirements
3+ years of experience with TypeScript and React
Clear written communication
`;

const RESUME = `Riley Chen
Portland, OR | riley.chen@example.com | (503) 555-0177

Summary
Frontend engineer who builds fast, accessible web apps.

Work Experience
Frontend Engineer, Lakeside Outfitters
Mar 2022 - Present
• Rebuilt the checkout in React and TypeScript, cutting drop off by 18%
• Wrote 40 unit tests for the cart

Education
B.S. Computer Science, State University, 2021
`;

test("fill in the application profile, then let the extension fill a form and stop before submit", async ({ page, request, baseURL }) => {
  test.setTimeout(180_000);

  // a resume to attach
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);

  // the application profile, reached from settings
  await page.goto("/settings");
  await page.getByRole("link", { name: "Edit application profile" }).click();
  await expect(page).toHaveURL(/\/settings\/application$/);
  // self-identification starts on decline
  await expect(page.getByRole("combobox", { name: /^Gender/ })).toHaveValue("Decline to self-identify");
  await page.getByLabel("Full legal name").fill("Riley Chen");
  await page.getByLabel("Email", { exact: true }).fill("riley.chen@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("(503) 555-0177");
  await page.getByLabel("City", { exact: true }).fill("Portland");
  await page.getByLabel("LinkedIn", { exact: true }).fill("https://linkedin.com/in/rileychen");
  await page.getByLabel("Work authorization").selectOption("US citizen");
  await page.getByLabel("Will you need visa sponsorship?").selectOption("no");
  await page.getByLabel("School", { exact: true }).fill("State University");
  await page.getByLabel("Graduation month").selectOption("May");
  await page.getByLabel("Graduation year").fill("2021");
  await page.getByLabel("GPA", { exact: true }).fill("3.7");
  await page.getByLabel("Never fill in my GPA").check();
  await page.getByRole("combobox", { name: "Veteran status" }).selectOption("I am not a protected veteran");
  // a saved answer needs both halves
  await page.getByRole("button", { name: "Add an answer" }).click();
  await page.getByLabel("Question 1", { exact: true }).fill("Why do you want to work here?");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page.getByText("Each saved answer needs a question and an answer.")).toBeVisible();
  await page.getByLabel("Answer 1", { exact: true }).fill("I like building tools people use every day.");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  // and it is all still there on the way back in
  await page.goto("/settings/application");
  await expect(page.getByLabel("School", { exact: true })).toHaveValue("State University");
  await expect(page.getByLabel("Never fill in my GPA")).toBeChecked();
  await expect(page.getByLabel("Question 1", { exact: true })).toHaveValue("Why do you want to work here?");

  // connect: with no extension to reach, the page gives a code to paste
  await page.goto("/extension");
  await page.getByRole("button", { name: /Connect (extension|again)/ }).click();
  const code = await page.getByLabel("Connection code").inputValue();
  const { token } = JSON.parse(Buffer.from(code, "base64").toString()) as { apiBase: string; token: string };
  const headers = { Authorization: `Bearer ${token}` };

  // the profile the extension gets, and the files it can attach
  const me = await (await request.get("/api/ext/me", { headers })).json();
  expect(me).toMatchObject({ autoApply: true, profileReady: true });
  // the newest job on the base resume, whichever resume that is by now, answers the current title question
  expect(typeof me.current.title).toBe("string");
  expect(me.profile).toMatchObject({ fullName: "Riley Chen", workAuthorization: "US citizen", needsSponsorship: false, school: "State University", graduationMonth: "May", gpaNeverFill: true, eeoGender: "Decline to self-identify" });
  const resumeId = me.resumes[0].id as string;
  const file = await (await request.get(`/api/ext/resumes/${resumeId}/file`, { headers })).json();
  expect(Buffer.from(file.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  // no key, a made up id and someone else's kind of id all get nothing
  expect((await request.get(`/api/ext/resumes/${resumeId}/file`)).status()).toBe(401);
  expect((await request.get("/api/ext/resumes/not-an-id/file", { headers })).status()).toBe(404);
  expect((await request.get("/api/ext/resumes/00000000-0000-4000-8000-000000000000/file", { headers })).status()).toBe(404);

  // a job on the tracker, with a cover letter saved on it
  const job = await (await request.post("/api/ext/jobs", { headers, data: { title: "Checkout Platform Engineer", company: "Brightside Labs", url: "https://boards.greenhouse.io/brightside/jobs/42", description: JD } })).json();
  expect((await request.get(`/api/ext/cover-letter?jobId=${job.jobId}`, { headers })).status()).toBe(404);
  await page.goto(`/tracker/${job.jobId}/cover-letter`);
  await page.getByLabel("Cover letter", { exact: true }).fill("Dear Hiring Manager,\n\nI would like to build your checkout.\n\nRiley Chen");
  await page.getByRole("button", { name: "Save cover letter" }).click();
  await expect.poll(async () => (await request.get(`/api/ext/cover-letter?jobId=${job.jobId}`, { headers })).status()).toBe(200);
  const letter = await (await request.get(`/api/ext/cover-letter?jobId=${job.jobId}`, { headers })).json();
  expect(letter.name).toBe("Cover-Letter.pdf");
  expect(Buffer.from(letter.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");

  // written questions: the saved answer when one is close, otherwise a draft
  const known = await (await request.post("/api/ext/answer", { headers, data: { question: "Why do you want to work at Brightside Labs?", jdText: JD } })).json();
  expect(known).toMatchObject({ source: "saved", answer: "I like building tools people use every day." });
  const fresh = await (await request.post("/api/ext/answer", { headers, data: { question: "Describe a project you are proud of.", jdText: JD, resumeId } })).json();
  expect(fresh.source).toBe("ai");

  // the card's Application tab offers auto apply and says nothing has been filled in yet
  await page.goto(`/tracker/${job.jobId}/application`);
  await expect(page.getByRole("button", { name: "Auto Apply" })).toBeEnabled();
  await expect(page.getByText("Nothing has been filled in for this job yet.")).toBeVisible();
  // with no extension in this browser, pressing it says so instead of opening anything
  await page.getByRole("button", { name: "Auto Apply" }).click();
  await expect(page.getByText("We could not reach the extension.")).toBeVisible();

  // now the real thing: the built extension, in a browser of its own, filling the saved form.
  // this copy is allowed onto pages up front, because the box Chrome shows to ask cannot be clicked from a test
  const copy = mkdtempSync(path.join(tmpdir(), "resumefit-extension-"));
  cpSync(EXTENSION, copy, { recursive: true });
  const manifestPath = path.join(copy, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, host_permissions: ["https://*/*", "http://localhost/*"] }));
  const context = await chromium.launchPersistentContext("", { channel: "chromium", args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;

    // the application form, served from this machine so nothing touches the real internet
    await context.route("**/apply-form", (route) => route.fulfill({ contentType: "text/html", body: FORM }));
    const form = await context.newPage();
    await form.goto(`${baseURL}/apply-form`);
    // anything that would send the form is counted
    await form.evaluate(() => {
      (window as unknown as { sent: string[] }).sent = [];
      const note = (what: string) => (window as unknown as { sent: string[] }).sent.push(what);
      document.querySelector("form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        note("submit");
      });
      document.querySelector("#submit_app")?.addEventListener("click", () => note("click"));
    });

    // the side panel, opened as a tab. it is told the form's tab is the one it sits next to, which is what Chrome does for a real side panel
    const panel = await context.newPage();
    await panel.addInitScript(() => {
      const real = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (async (query: chrome.tabs.QueryInfo) => (query.active && query.currentWindow ? (await real({})).filter((tab) => tab.url?.includes("/apply-form")) : real(query))) as typeof chrome.tabs.query;
    });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByLabel("Connection code").fill(code);
    await panel.getByRole("button", { name: "Connect" }).click();
    await expect(panel.getByText("riley.chen@example.com").or(panel.getByText("you@resumefit.local"))).toBeVisible();
    await panel.getByRole("button", { name: "Connect" }).click();

    // it sees an application form and offers to fill it
    await expect(panel.getByRole("heading", { name: "Fill in this application" })).toBeVisible();
    await panel.getByRole("button", { name: "Fill this application" }).click();
    await expect(panel.getByRole("heading", { name: /\d+ filled in, \d+ for you to check/ })).toBeVisible({ timeout: 60_000 });

    // every field on the form, checked one by one
    const value = (selector: string) => form.locator(selector).inputValue();
    const chosen = (selector: string) => form.locator(selector).evaluate((select: HTMLSelectElement) => select.options[select.selectedIndex]?.text ?? "");
    expect(await value("#first_name")).toBe("Riley");
    expect(await value("#last_name")).toBe("Chen");
    expect(await value("#email")).toBe("riley.chen@example.com");
    expect(await value("#phone")).toBe("(503) 555-0177");
    expect(await value("#q_linkedin")).toBe("https://linkedin.com/in/rileychen");
    // nothing saved for a website, so it is left alone
    expect(await value("#q_website")).toBe("");
    expect(await chosen("#q_auth")).toBe("Yes");
    expect(await chosen("#q_sponsor")).toBe("No");
    // the written question got the person's own saved answer
    expect(await value("#q_why")).toBe("I like building tools people use every day.");
    // self-identification: declined unless the person chose something
    expect(await chosen("#job_application_gender")).toBe("Decline To Self Identify");
    expect(await chosen("#job_application_race")).toBe("Decline To Self Identify");
    expect(await chosen("#job_application_veteran_status")).toBe("I am not a protected veteran");
    expect(await chosen("#job_application_disability_status")).toMatch(/do not want to answer|decline/i);
    // the resume went into its own box as a real pdf
    expect(await form.locator("#resume").evaluate((input: HTMLInputElement) => input.files?.[0]?.name ?? "")).toMatch(/\.pdf$/);

    // nothing was sent, and the page never moved
    expect(await form.evaluate(() => (window as unknown as { sent: string[] }).sent)).toEqual([]);
    expect(form.url()).toBe(`${baseURL}/apply-form`);
    await expect(panel.getByText("Nothing has been sent.")).toBeVisible();

    // the checklist can take the person to a field
    await panel.getByText("Filled in (").click();
    await panel.getByRole("listitem").filter({ hasText: "Email" }).getByRole("button", { name: "Jump to field" }).click();
    await expect(form.locator("#email")).toBeFocused();

    // marking it applied is not offered until the person says they sent it
    await expect(panel.getByRole("button", { name: "Mark as applied" })).toHaveCount(0);
    // ticking the box swaps it for the button
    await panel.getByLabel("The page did not say so, but I pressed Submit").click();
    await panel.getByRole("button", { name: "Mark as applied" }).click();
    await expect(panel.getByRole("heading", { name: "Marked as applied" })).toBeVisible();
  } finally {
    await context.close();
  }

  // the run shows up in the list as sent by the person
  await page.goto("/applications");
  await expect(page.getByRole("row").filter({ hasText: "Submitted by me" })).toHaveCount(1);

  // a run for a tracker card moves the card to Applied and keeps the answers on its Application tab
  const report = { jobId: job.jobId, ats: "Greenhouse", applyUrl: "https://boards.greenhouse.io/brightside/jobs/42", fieldsFilled: 9, fieldsNeedingAttention: 2, resumeId, coverLetter: true, answers: [{ label: "Email", value: "riley.chen@example.com", status: "filled" }, { label: "Describe a project you are proud of.", value: "A draft.", status: "review" }] };
  expect((await request.post("/api/ext/applications", { headers, data: { ...report, status: "needs_review" } })).status()).toBe(200);
  await page.goto("/applications");
  await expect(page.getByRole("row", { name: /Checkout Platform Engineer/ })).toContainText("Needs review");
  await expect(page.getByRole("row", { name: /Checkout Platform Engineer/ })).toContainText("9 filled, 2 to check");
  await request.post("/api/ext/applications", { headers, data: { ...report, status: "applied", fieldsNeedingAttention: 0, today: "2026-11-12" } });
  await page.goto(`/tracker/${job.jobId}/application`);
  await expect(page.getByText("Submitted by me")).toBeVisible();
  await expect(page.getByText("2026-11-12")).toBeVisible();
  await expect(page.getByText("and the cover letter")).toBeVisible();
  await expect(page.getByText("Was marked for you to check")).toBeVisible();
  await page.goto("/tracker");
  await expect(page.getByRole("region", { name: "Applied", exact: true }).getByText("Checkout Platform Engineer")).toBeVisible();

  // the admin switch turns all of it off, and the profile stops leaving the app
  await page.goto("/admin");
  await page.getByLabel(/^Auto Apply/).uncheck();
  await page.getByRole("button", { name: "Save switches" }).click();
  await expect.poll(async () => (await (await request.get("/api/ext/me", { headers })).json()).autoApply).toBe(false);
  expect((await (await request.get("/api/ext/me", { headers })).json()).profile).toBeUndefined();
  expect((await request.get(`/api/ext/resumes/${resumeId}/file`, { headers })).status()).toBe(403);
  expect((await request.post("/api/ext/answer", { headers, data: { question: "Why do you want to work here?" } })).status()).toBe(403);
  await page.goto(`/tracker/${job.jobId}/application`);
  await expect(page.getByText("Auto Apply is switched off for now.")).toBeVisible();
  // and back on for whatever runs next
  await page.goto("/admin");
  await page.getByLabel(/^Auto Apply/).check();
  await page.getByRole("button", { name: "Save switches" }).click();
  await expect.poll(async () => (await (await request.get("/api/ext/me", { headers })).json()).autoApply).toBe(true);
});

test("with sending switched on, the extension fills a form, presses Submit once and marks it sent for the person", async ({ page, request }) => {
  test.setTimeout(180_000);

  // sending starts switched off, and the person turns it on in their application profile
  await page.goto("/settings/application");
  await expect(page.getByLabel("Who presses Submit?")).toHaveValue("off");
  await page.getByLabel("Who presses Submit?").selectOption("safe");
  await page.getByLabel(/^Most it may send in a day/).fill("99");
  await page.getByRole("button", { name: "Finished" }).click();
  // a number past the limit is turned away
  await expect(page.getByText("Pick a number from 1 to 25.")).toBeVisible();
  await page.getByLabel(/^Most it may send in a day/).fill("3");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.goto("/extension");
  await page.getByRole("button", { name: /Connect (extension|again)/ }).click();
  const code = await page.getByLabel("Connection code").inputValue();
  const { token } = JSON.parse(Buffer.from(code, "base64").toString()) as { token: string };
  const headers = { Authorization: `Bearer ${token}` };
  const before = await (await request.get("/api/ext/me", { headers })).json();
  expect(before.profile.autoSend).toBe("safe");
  expect(before.sendsLeft).toBe(3);

  // the tracker now offers to work through every saved job, and asks before it starts
  await request.post("/api/ext/jobs", { headers, data: { title: "Queue Test Engineer", company: "Brightside Labs", url: "https://boards.greenhouse.io/brightside/jobs/77", description: JD } });
  await page.goto("/tracker");
  await page.getByRole("button", { name: /^Auto Apply to all \d+ saved$/ }).click();
  await expect(page.getByRole("dialog")).toContainText("A sent application cannot be taken back.");
  await page.getByRole("button", { name: "Cancel" }).click();

  const copy = mkdtempSync(path.join(tmpdir(), "resumefit-extension-"));
  cpSync(EXTENSION, copy, { recursive: true });
  const manifestPath = path.join(copy, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, host_permissions: ["https://*/*", "http://localhost/*"] }));
  const context = await chromium.launchPersistentContext("", { channel: "chromium", args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;

    // the saved form, served from this machine at a greenhouse address. sending it counts the send and shows a thank you, and never leaves the machine
    const APPLY = "https://boards.greenhouse.io/brightside/jobs/42";
    const counting = FORM.replace(
      "</body>",
      `<script>window.sent = []; document.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); window.sent.push("submit"); document.querySelector("form").outerHTML = "<main><h1>Thank you for applying</h1></main>"; });</script></body>`,
    );
    await context.route("https://boards.greenhouse.io/**", (route) => route.fulfill({ contentType: "text/html", body: counting }));
    const form = await context.newPage();
    await form.goto(APPLY);

    const panel = await context.newPage();
    await panel.addInitScript(() => {
      const real = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (async (query: chrome.tabs.QueryInfo) => (query.active && query.currentWindow ? (await real({})).filter((tab) => tab.url?.includes("greenhouse.io")) : real(query))) as typeof chrome.tabs.query;
    });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByLabel("Connection code").fill(code);
    await panel.getByRole("button", { name: "Connect" }).click();
    await expect(panel.getByText("riley.chen@example.com").or(panel.getByText("you@resumefit.local"))).toBeVisible();
    await panel.getByRole("button", { name: "Connect" }).click();

    // the panel says up front that this one will be sent
    await expect(panel.getByText("Then we press Submit for you, as you asked in your application profile.")).toBeVisible();
    await panel.getByRole("button", { name: "Fill and send this application" }).click();
    await expect(panel.getByRole("heading", { name: "Sent for you" })).toBeVisible({ timeout: 90_000 });

    // sent once, and the page shows its thank you
    expect(await form.evaluate(() => (window as unknown as { sent: string[] }).sent)).toEqual(["submit"]);
    await expect(form.getByRole("heading", { name: "Thank you for applying" })).toBeVisible();
  } finally {
    await context.close();
  }

  // it is listed as sent for the person, and one of the day's sends is used up
  await page.goto("/applications");
  await expect(page.getByRole("row").filter({ hasText: "Sent for me" })).toHaveCount(1);
  expect((await (await request.get("/api/ext/me", { headers })).json()).sendsLeft).toBe(2);

  // switched back off, the extension is told it has nothing to send
  await page.goto("/settings/application");
  await page.getByLabel("Who presses Submit?").selectOption("off");
  await page.getByRole("button", { name: "Finished" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect((await (await request.get("/api/ext/me", { headers })).json()).sendsLeft).toBe(0);
  await page.goto("/tracker");
  await expect(page.getByRole("button", { name: /^Auto Apply to all/ })).toHaveCount(0);
});
