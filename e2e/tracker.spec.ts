import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const JD = `Data Analyst at Northwind Health

Requirements
2+ years of experience with SQL and Tableau
Strong communication skills
Experience with Python is a plus
`;

const RESUME = `Sam Rivera
Denver, CO | sam.rivera@example.com | (303) 555-0188

Summary
Data Analyst who turns messy numbers into clear answers with SQL and Tableau.

Work Experience
Data Analyst, Corner Studio
Jan 2023 - Present
• Built 14 Tableau dashboards used by 200 staff
• Cut report time by 60% with SQL automation

Education
B.S. Statistics, State University, 2022
`;

// the tabs inside an open job card
const tabs = (page: Page) => page.getByRole("navigation", { name: "Job sections" });

// the column with a given name
const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("add a job, drag it, fill in its card and scan from it", async ({ page }) => {
  // add a job by hand
  await page.goto("/tracker");
  await page.getByRole("button", { name: "Add Job" }).click();
  await page.getByLabel("Job title").fill("Data Analyst");
  await page.getByLabel("Company").fill("Northwind Health");
  await page.getByLabel("Job description").fill(JD);
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  const card = page.getByRole("link", { name: /Data Analyst/ });
  await expect(column(page, "Saved").getByText("Data Analyst")).toBeVisible();

  // drag the card from saved to applied
  const from = await card.boundingBox();
  const to = await column(page, "Applied").boundingBox();
  if (!from || !to) throw new Error("card or column not on screen");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 140, { steps: 15 });
  await page.mouse.up();
  await expect(column(page, "Applied").getByText("Data Analyst")).toBeVisible();

  // the move is saved, not just shown
  await page.reload();
  await expect(column(page, "Applied").getByText("Data Analyst")).toBeVisible();
  await expect(column(page, "Saved").getByText("Data Analyst")).toHaveCount(0);

  // open the card, the date applied was filled in by the move
  await card.click();
  await expect(page).toHaveURL(/\/tracker\/[0-9a-f-]{36}\/job$/);
  await expect(page.getByLabel("Date applied")).toHaveValue(new Date().toLocaleDateString("en-CA"));
  await page.getByLabel("Salary").fill("$85,000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("p[aria-live]").filter({ hasText: /^Saved$/, visible: true })).toBeVisible();

  // add an interview and get calendar links for it
  await tabs(page).getByRole("link", { name: "Interviews" }).click();
  await page.getByLabel("Interview type").selectOption("Technical");
  await page.getByLabel("Date and time").fill("2031-03-04T15:30");
  await page.getByLabel("Interviewer name").fill("Priya Shah");
  await page.getByRole("button", { name: "Save interview" }).click();
  await expect(page.getByText("Interviewer: Priya Shah")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com.*Technical/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calendar file" }).click();
  expect((await download).suggestedFilename()).toBe("interview.ics");

  // notes save on their own
  await tabs(page).getByRole("link", { name: "Notes" }).click();
  await page.getByLabel("Notes").fill("Ask about the on call rotation.");
  await expect(page.getByText("All changes saved")).toBeVisible();

  // cover letter saves with the button
  await tabs(page).getByRole("link", { name: "Cover Letter" }).click();
  await page.getByLabel("Cover letter").fill("Dear Northwind team, I would love to help your care teams with data.");
  await page.getByRole("button", { name: "Save cover letter" }).click();
  await expect(page.locator("p[aria-live]").filter({ hasText: /^Saved$/, visible: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Cover letter")).toHaveValue(/Dear Northwind team/);

  // scan from the card, the job description is already filled in
  await page.getByRole("dialog").getByRole("link", { name: "Scan", exact: true }).click();
  await expect(page.getByLabel("2. Paste the job description")).toHaveValue(/Data Analyst at Northwind Health/);
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(RESUME);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tracked" })).toBeVisible();

  // back on the board the card now has a score, and its resume tab shows what was scanned
  await page.getByRole("button", { name: "Tracked" }).click();
  await expect(page.getByRole("dialog").getByRole("meter")).toBeVisible();
  await tabs(page).getByRole("link", { name: "Resume" }).click();
  await expect(page.getByText("Scanned 1 time for this job.")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Built 14 Tableau dashboards")).toBeVisible();

  // the dashboard counts the job and shows the interview
  await page.goto("/dashboard");
  await expect(page.getByText("Next interview: Data Analyst at Northwind Health")).toBeVisible();

  // archive the job and bring it back
  await page.goto("/tracker");
  await card.click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(/\/tracker$/);
  await expect(column(page, "Applied").getByText("Data Analyst")).toHaveCount(0);
  await page.getByRole("button", { name: "Archived" }).click();
  await page.getByRole("button", { name: "Restore Data Analyst" }).click();
  await page.getByRole("button", { name: "Archived" }).click();
  await expect(column(page, "Applied").getByText("Data Analyst")).toBeVisible();
});

test("manage saved resumes", async ({ page }) => {
  // save a resume by running a scan with pasted text
  await page.goto("/scans/new");
  await page.getByRole("tab", { name: "Paste text" }).click();
  await page.getByLabel("Resume text").fill(`${RESUME}\nSkills\nSQL, Tableau, Python`);
  await page.getByLabel("2. Paste the job description").fill(JD);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}$/);

  await page.goto("/resumes");
  // other tests paste resumes too, so find ours by its length
  const words = `${RESUME}\nSkills\nSQL, Tableau, Python`.split(/\s+/).filter(Boolean).length;
  const row = page.getByRole("row", { name: /Pasted resume/ }).filter({ hasText: `${words} words` });
  await expect(row).toBeVisible();

  // rename it in place
  await row.getByTitle("Click to rename").click();
  await page.getByLabel("Resume name").fill("Analyst resume");
  await page.getByLabel("Resume name").press("Enter");
  await expect(page.getByRole("row", { name: /Analyst resume/ })).toBeVisible();

  // preview shows its text
  await page.getByRole("button", { name: "Preview Analyst resume" }).click();
  await expect(page.getByRole("dialog").getByText("SQL, Tableau, Python")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  // duplicate, star the copy, then delete it
  await page.getByRole("button", { name: "Duplicate Analyst resume" }).click();
  await expect(page.getByRole("row", { name: /Analyst resume \(copy\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Make Analyst resume (copy) your base resume" }).click();
  await expect(page.getByRole("button", { name: "Analyst resume (copy) is your base resume" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Analyst resume (copy)" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row", { name: /Analyst resume \(copy\)/ })).toHaveCount(0);

  // search with no match says so
  await page.getByPlaceholder("Search resumes").fill("zzz nothing");
  await expect(page.getByText("No resumes match that search")).toBeVisible();
});
