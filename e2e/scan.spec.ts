import { expect, test } from "./fixtures";
import { singleColumnPdf } from "../apps/web/lib/files/fixtures";

const JD = `Frontend Engineer at Brightside Labs

We are looking for a Frontend Engineer to build fast, accessible product features.

Requirements
3+ years of experience with TypeScript and React
Bachelor's degree in Computer Science or a related field
Experience with unit testing, CI/CD and code review
Clear communication and collaboration with design and product

Nice to have
GraphQL
`;

test("upload a resume, read the report, fix things and rescan", async ({ page }) => {
  // upload a pdf and paste the job description
  await page.goto("/scans/new");
  await page.getByLabel("Upload your resume").setInputFiles({ name: "Jordan-Lee-Resume.pdf", mimeType: "application/pdf", buffer: Buffer.from(await singleColumnPdf()) });
  await expect(page.getByText("Jordan-Lee-Resume.pdf")).toBeVisible();
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();

  // the report opens with the title and company read from the posting
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Brightside Labs - Frontend Engineer");
  const score = page.getByRole("meter", { name: "Match rate" });
  const firstScore = Number(await score.getAttribute("aria-valuenow"));
  expect(firstScore).toBeGreaterThan(30);
  expect(firstScore).toBeLessThan(90);

  // findings from the real file: the title is missing, the layout is clean
  await expect(page.getByText('The job title "Frontend Engineer" is not in your resume')).toBeVisible();
  await expect(page.getByText("Your resume uses a single column")).toBeVisible();
  await expect(page.getByRole("row", { name: /GraphQL/ })).toContainText("nice to have");

  // looking for the title the resume really uses turns that finding green
  await page.getByRole("button", { name: "Update scan information" }).click();
  await page.getByLabel("Job title to look for").fill("Software Engineer");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText('The job title "Software Engineer" is in your resume.')).toBeVisible();

  // a skill added by hand gets its own row
  await page.locator("#hardSkills").getByRole("button", { name: "Add skill" }).click();
  await page.getByLabel("Skill", { exact: true }).fill("Storybook");
  await page.getByRole("dialog").getByRole("button", { name: "Add skill" }).click();
  await expect(page.getByRole("row", { name: /Storybook/ })).toBeVisible();

  // the job description tab marks what is missing
  await page.getByRole("tab", { name: "Job description" }).click();
  await expect(page.locator("mark", { hasText: "GraphQL" })).toBeVisible();
  await page.getByRole("tab", { name: "Resume report" }).click();

  // track the job
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("button", { name: "Tracked" })).toBeVisible();

  // rescan with a better resume and see the score go up
  await page.getByRole("button", { name: "Upload and rescan" }).click();
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(`Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142

Summary
Frontend Engineer with four years of TypeScript and React. Clear communication and close collaboration with design.

Work Experience
Frontend Engineer, Acme Corp
Jan 2022 - Present
• Cut page load time by 40% with React code splitting
• Added unit testing across 40 components
• Set up CI/CD that ships 15 releases a week
• Led code review for a team of 6
• Built 12 GraphQL endpoints

Education
B.S. Computer Science, State University, 2021
`);
  await page.getByRole("button", { name: "Rescan", exact: true }).click();
  await expect(page.getByText(/\+\d+% from last scan/)).toBeVisible();
  expect(Number(await page.getByRole("meter", { name: "Match rate" }).getAttribute("aria-valuenow"))).toBeGreaterThan(firstScore);

  // both scans are in the history, and the job shows as tracked
  await page.goto("/scans");
  await expect(page.getByRole("link", { name: "Frontend Engineer" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Tracked" }).first()).toBeVisible();

  // search narrows the list, and the dashboard shows the latest scan
  await page.getByPlaceholder("Search by company").fill("nothing matches this");
  await expect(page.getByText("No scans match that search")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Latest resume scan" })).toBeVisible();
  await expect(page.getByText("Skills match")).toBeVisible();
});

test("the sample scan shows a full report without an account's data", async ({ page }) => {
  await page.goto("/scans/new");
  await page.getByRole("link", { name: "View a sample scan" }).click();
  await expect(page.getByText("Sample scan, made up data")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Match rate" })).toBeVisible();
  // nothing on the sample can be edited
  await expect(page.getByRole("button", { name: "Add skill" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Scan my resume" })).toBeVisible();

  // the tour walks through each part
  await page.getByRole("button", { name: "Guide me" }).click();
  await page.getByRole("button", { name: "Start tour" }).click();
  await expect(page.getByText("Step 1 of 7")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: "Report tour" })).toContainText("Searchability");
});

test("a file that is not a resume gets a clear message", async ({ page }) => {
  await page.goto("/scans/new");
  await page.getByLabel("Upload your resume").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf at all") });
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText("We can only read PDF and DOCX files")).toBeVisible();
});
