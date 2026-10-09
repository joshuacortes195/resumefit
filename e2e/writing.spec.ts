import { expect, test } from "@playwright/test";

const JD = `Frontend Engineer at Brightside Labs

Requirements
3+ years of experience with TypeScript and React
Experience with GraphQL and unit testing
Clear communication with design and product
`;

const RESUME = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142

Summary
Frontend developer with four years of React work.

Work Experience
Frontend Developer, Acme Corp
Jan 2022 - Present
• Rebuilt the checkout flow in React
• Wrote unit testing guides for the team

Education
B.S. Computer Science, State University, 2021

Skills
React, CSS, HTML
`;

// the number shown on a score ring
const rate = async (meter: import("@playwright/test").Locator) => Number(await meter.getAttribute("aria-valuenow"));

test("optimize a resume, export it and save it", async ({ page }) => {
  // scan and go straight into the workspace
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "AI Optimize" }).click();
  await expect(page).toHaveURL(/\/optimize\/[0-9a-f-]{36}$/);
  const before = await rate(page.getByRole("meter", { name: "Match rate before" }));
  expect(await rate(page.getByRole("meter", { name: "Match rate now" }))).toBe(before);

  // ask for suggestions
  await page.getByRole("button", { name: "Suggest improvements" }).click();
  const cards = page.locator("section", { hasText: "Suggestions" }).getByRole("listitem");
  await expect(cards.first()).toBeVisible();

  // a suggestion that adds a skill the resume never mentions cannot be accepted until the box is ticked
  const claim = cards.first();
  await expect(claim).toContainText("Only add this if it's true");
  await expect(claim.getByRole("button", { name: "Accept" })).toBeDisabled();
  await claim.getByRole("checkbox").check();
  await claim.getByRole("button", { name: "Accept" }).click();
  await expect(claim.getByText("Accepted")).toBeVisible();

  // the score went up without another trip to the server
  await expect.poll(() => rate(page.getByRole("meter", { name: "Match rate now" }))).toBeGreaterThan(before);

  // undo puts the line and the score back
  await claim.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => rate(page.getByRole("meter", { name: "Match rate now" }))).toBe(before);
  await claim.getByRole("checkbox").check();
  await claim.getByRole("button", { name: "Accept" }).click();

  // a bullet for a keyword that is still missing, dropped into the resume
  const helper = page.locator("section", { hasText: "Still missing" });
  await helper.getByRole("button", { name: "GraphQL" }).or(helper.getByRole("button", { name: "Communication" })).first().click();
  await helper.getByRole("button", { name: "Insert" }).first().click();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText(/^Optimized\d+%$/)).toBeVisible();

  // typing by hand rescores too
  await page.getByRole("button", { name: "Edit text" }).click();
  const editor = page.getByLabel("Resume text").filter({ visible: true });
  await editor.fill(`${await editor.inputValue()}\nTypeScript, GraphQL, Communication`);
  await expect.poll(() => rate(page.getByRole("meter", { name: "Match rate now" }))).toBeGreaterThan(before + 10);

  // export both formats
  for (const format of ["DOCX", "PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    expect((await download).suggestedFilename()).toBe(`Jordan-Lee-Resume.${format.toLowerCase()}`);
  }

  // save it, and find it in the resume manager marked for this job
  await page.getByRole("button", { name: "Save as new resume" }).click();
  await expect(page.getByText("Saved to your Resume Manager.")).toBeVisible();
  await page.goto("/resumes");
  await expect(page.getByRole("row", { name: /Resume for Brightside Labs, Frontend Engineer/ })).toBeVisible();
});

test("write a cover letter and a thank-you note", async ({ page }) => {
  // a tracked scan to write for
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(`${RESUME}\nLanguages\nSpanish`);
  await page.getByLabel("2. Paste the job description").fill(JD.replace("Frontend Engineer at Brightside Labs", "UI Engineer at Lakeside Labs"));
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("button", { name: "Tracked" })).toBeVisible();

  // generate, edit and save the letter to the job
  await page.goto("/cover-letter");
  await page.getByRole("button", { name: "Enthusiastic" }).click();
  await page.getByRole("button", { name: "Generate cover letter" }).click();
  const letter = page.getByLabel("Cover letter");
  await expect(letter).toHaveValue(/UI Engineer role at Lakeside Labs/);
  await letter.fill(`${await letter.inputValue()}\n\nP.S. I added this line myself.`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Cover-Letter.pdf");
  await page.getByRole("button", { name: "Save to job" }).click();
  await expect(page.getByText("Saved to the job's Cover Letter tab.")).toBeVisible();

  // the job card has the letter, and can draft a thank-you note for an interview
  await page.goto("/tracker");
  await page.getByRole("link", { name: /UI Engineer/ }).click();
  const tabs = page.getByRole("navigation", { name: "Job sections" });
  await tabs.getByRole("link", { name: "Cover Letter" }).click();
  await expect(page.getByRole("dialog").getByLabel("Cover letter")).toHaveValue(/I added this line myself/);

  await tabs.getByRole("link", { name: "Interviews" }).click();
  await page.getByLabel("Interviewer name").fill("Priya Shah");
  await page.getByRole("button", { name: "Save interview" }).click();
  await page.getByRole("button", { name: "Thank-you note" }).click();
  await page.getByRole("button", { name: "Draft with AI" }).click();
  // the interviewer's real name is back in the note even though it was hidden on the way out
  await expect(page.getByLabel("Thank-you note")).toHaveValue(/Hi Priya Shah,/);
});
