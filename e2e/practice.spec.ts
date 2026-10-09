import { expect, test } from "@playwright/test";

const JD = `Senior Data Analyst at Northwind Health

Requirements
5+ years of experience with SQL and Tableau
Strong SQL skills and data analysis
Clear communication with clinical staff
Python is a plus
`;

test("score a linkedin profile and get rewrite suggestions", async ({ page }) => {
  await page.goto("/linkedin");
  await page.getByLabel("Headline").fill("Looking for work");
  await page.getByLabel("About").fill("Hard worker.");
  await page.getByLabel("Experience").fill("Analyst, Corner Studio\nBuilt reports in Excel.");
  await page.getByLabel("Skills").fill("Teamwork, Excel");

  // a job description is needed to compare against
  await page.getByRole("button", { name: "Score my profile" }).click();
  await expect(page.getByText("Add at least one job description")).toBeVisible();
  await page.getByLabel("Job description 1").fill(JD);
  await page.getByRole("button", { name: "Score my profile" }).click();
  await expect(page).toHaveURL(/\/linkedin\/[0-9a-f-]{36}$/);

  // a thin profile scores low and is told exactly why
  const score = Number(await page.getByRole("meter", { name: "LinkedIn score" }).first().getAttribute("aria-valuenow"));
  expect(score).toBeLessThan(40);
  await expect(page.getByText('Work "Senior Data Analyst" into your headline.')).toBeVisible();
  await expect(page.getByText(/Your About section has 2 words/)).toBeVisible();
  await expect(page.getByRole("row", { name: /SQL/ })).toContainText("Needs work");
  await expect(page.getByText(/are missing from your profile/)).toBeVisible();

  // rewrite helpers
  await page.getByRole("button", { name: "Suggest 3 headlines" }).click();
  await expect(page.getByText("Data Analyst | SQL and Tableau | Healthcare")).toBeVisible();
  await page.getByRole("button", { name: "Rewrite my About section" }).click();
  await expect(page.getByText(/I am a data analyst who helps care teams/)).toBeVisible();

  // it is in the history
  await page.goto("/linkedin");
  await expect(page.getByRole("link", { name: /Looking for work/ })).toBeVisible();
});

test("practice an interview and see the summary", async ({ page }) => {
  await page.goto("/interview");
  // with no tracked job picked, the description is pasted
  if (await page.getByLabel("Practice for").isVisible()) await page.getByLabel("Practice for").selectOption("");
  await page.getByLabel("Job description").fill(JD);
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Senior Data Analyst at Northwind Health");
  await expect(page.getByText("Question 1 of 8")).toBeVisible();

  // answer the first one by typing
  await page.getByLabel("Your answer").fill("Um, so basically I led the reporting migration. You know, I rebuilt 14 dashboards and, um, trained the team.");
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByText("STAR structure")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Answer score" })).toHaveAttribute("aria-valuenow", "72");
  // counted here, not by the model
  await expect(page.getByText("19 words")).toBeVisible();
  await expect(page.getByText(/um 2/)).toBeVisible();
  await expect(page.getByText("A stronger version, built from your own experience")).toBeVisible();
  // a typed answer has no pace
  await expect(page.getByText(/words a minute/)).toHaveCount(0);

  // skip the rest and land on the summary
  await page.getByRole("button", { name: "Next question" }).click();
  for (let question = 2; question <= 7; question++) await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Session summary" })).toBeVisible();
  await expect(page.getByText("You answered 1 of 8 questions")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Average answer score" })).toHaveAttribute("aria-valuenow", "72");

  // the summary can jump back to an answer
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("I rebuilt 14 dashboards")).toBeVisible();

  // it is saved, and reopens at the first question still waiting for an answer
  await page.goto("/interview");
  await page.getByRole("link", { name: /Senior Data Analyst.*1 of 8 answered, average 72/ }).click();
  await expect(page.getByText("Question 2 of 8")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("I rebuilt 14 dashboards").filter({ visible: true })).toBeVisible();
});
