import { expect, test } from "@playwright/test";
import { singleColumnPdf } from "../apps/web/lib/files/fixtures";

test("build a resume from scratch and download it", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /Create a new resume/ }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}\?new=1$/);

  // a new resume opens on the look, with sample content in the preview
  const preview = page.getByLabel("Resume preview");
  await expect(preview).toContainText("Jordan Lee");
  await page.getByRole("button", { name: /Technical/ }).click();
  await page.getByLabel("Margins").selectOption("1");
  await page.getByRole("button", { name: "navy" }).click();
  await page.getByRole("button", { name: "Continue to Profile" }).click();

  // profile
  await page.getByLabel("Name").fill("Sam Rivera");
  await page.getByLabel("Job title").fill("Data Analyst");
  await page.getByLabel("Email").fill("sam.rivera@example.com");
  await page.getByLabel("Phone").fill("(303) 555-0188");
  await page.getByLabel("Location").fill("Denver, CO");
  await expect(preview).toContainText("Sam Rivera");
  await expect(preview).not.toContainText("Jordan Lee");

  // undo takes the last thing typed back out, redo puts it back
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Location")).not.toHaveValue("Denver, CO");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Location")).toHaveValue("Denver, CO");

  // experience, with bullets drafted from a short description
  await page.getByRole("button", { name: "Next: Experience" }).click();
  await page.getByRole("button", { name: "Add a job" }).click();
  await page.getByLabel("Job title").fill("Data Analyst");
  await page.getByLabel("Company").fill("Corner Studio");
  await page.getByLabel("Start").fill("Jan 2023");
  await page.getByLabel("I work here now").check();
  await page.getByRole("textbox", { name: "Bullets 1" }).fill("Built 14 dashboards used by 200 staff");
  await page.getByRole("button", { name: "Write bullets with AI" }).click();
  await page.getByLabel("What did you do in this job?").fill("I ran the weekly reporting and trained new analysts on our tools.");
  await page.getByRole("button", { name: "Write bullets", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Bullets 3" })).toHaveValue(/Trained \[N\] new team members/);
  await expect(preview).toContainText("Jan 2023 - Present");

  // skills, typed and suggested from the job title alone
  await page.getByRole("button", { name: "Next: Core Skills" }).click();
  await page.getByLabel("Add a skill").fill("SQL, Tableau");
  await page.getByLabel("Add a skill").press("Enter");
  await expect(page.getByLabel("Suggest skills for my target job")).toHaveValue("Data Analyst");
  await page.getByRole("button", { name: "Show skills" }).click();
  await page.getByRole("button", { name: "+ Forecasting" }).click();
  await expect(page.getByLabel("Your skills")).toContainText("Forecasting");
  // one we already have is not offered again
  await expect(page.getByRole("button", { name: "+ SQL" })).toHaveCount(0);
  // a pasted job description still works
  await page.getByText("Or paste a job description instead").click();
  await page.getByLabel("Job description").fill("We need a data analyst with strong Python, SQL and communication skills.");
  await page.getByRole("button", { name: "Find skills in this job" }).click();
  await page.getByRole("button", { name: "+ Python" }).click();
  await expect(page.getByLabel("Your skills")).toContainText("Python");

  // education
  await page.getByRole("button", { name: "Next: Education" }).click();
  await page.getByRole("button", { name: "Add a school" }).click();
  await page.getByLabel("Degree").fill("Bachelor of Science");
  await page.getByLabel("Field of study").fill("Statistics");
  await page.getByLabel("School", { exact: true }).fill("State University");
  await page.getByLabel("Graduation year").fill("2022");

  // a project, with each point in its own box
  await page.getByRole("button", { name: "Next: Additional" }).click();
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project 1 name").fill("Trail Map");
  await page.getByRole("textbox", { name: "Project 1 bullet points 1" }).fill("Offline maps for hikers");
  await page.getByRole("button", { name: "Add bullet point" }).click();
  await page.getByRole("textbox", { name: "Project 1 bullet points 2" }).fill("Used by 2,000 people");
  await expect(preview.getByRole("listitem").filter({ hasText: "Used by 2,000 people" })).toHaveText("Used by 2,000 people");
  // summary drafted from the rest
  await page.getByRole("button", { name: "Next: Summary" }).click();
  await page.getByRole("button", { name: "Generate with AI" }).click();
  await expect(page.getByLabel("Summary")).toHaveValue(/four years of experience/);

  // the technical template puts skills above experience
  const text = (await preview.innerText()).toLowerCase();
  expect(text.indexOf("skills")).toBeGreaterThan(-1);
  expect(text.indexOf("skills")).toBeLessThan(text.indexOf("work experience"));

  // finalize: the checklist is clean and both files download with the right name
  await page.getByRole("button", { name: "Next: Finalize" }).click();
  await expect(page.getByText("Everything a scanner looks for is in place.")).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();
  for (const format of ["PDF", "DOCX"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: `Download ${format}` }).click();
    expect((await download).suggestedFilename()).toBe(`Sam-Rivera-Resume.${format.toLowerCase()}`);
  }

  // it is in the resume manager, and comes back as it was left
  await page.goto("/resumes");
  await expect(page.getByRole("row", { name: /Sam Rivera resume/ })).toBeVisible();
  await page.getByRole("link", { name: "Edit Sam Rivera resume in the builder" }).click();
  // it opens on the step that was last open, the profile is one click away
  await page.getByRole("button", { name: /Profile$/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Sam Rivera");
  await expect(page.getByLabel("Resume preview")).toContainText("Built 14 dashboards used by 200 staff");

  // leaving the builder and coming back lands on the same resume, on the step that was open
  await page.getByRole("button", { name: "Next: Experience" }).click();
  await page.getByLabel("Company").fill("Corner Studio West");
  await page.goto("/tracker");
  await page.goto("/builder");
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Company")).toHaveValue("Corner Studio West");

  // save and close keeps the resume and frees the builder up for a new one
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect(page.getByRole("row", { name: /Sam Rivera resume/ })).toBeVisible();
  await page.goto("/builder");
  await expect(page.getByRole("button", { name: /Create a new resume/ })).toBeVisible();
});

test("cancelling a new resume asks first, then deletes it", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: /Create a new resume/ }).click();
  await page.getByRole("button", { name: "Continue to Profile" }).click();
  await page.getByLabel("Name").fill("Throwaway Person");
  await expect(page.getByText("All changes saved")).toBeVisible();

  // backing out of the question keeps everything
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Are you sure you want to cancel?");
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Throwaway Person");

  // saying yes deletes it and goes back to the start
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByRole("button", { name: /Create a new resume/ })).toBeVisible();
  await page.goto("/resumes");
  await expect(page.getByText("Throwaway Person")).toHaveCount(0);
});

test("upload a resume into the builder", async ({ page }) => {
  await page.goto("/builder");
  await page.getByLabel("Upload my resume").setInputFiles({ name: "Jordan-Lee-Resume.pdf", mimeType: "application/pdf", buffer: Buffer.from(await singleColumnPdf()) });
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);

  // the steps are filled in from the file
  await expect(page.getByLabel("Name")).toHaveValue("Jordan Lee");
  await expect(page.getByLabel("Email")).toHaveValue("jordan.lee@example.com");
  await page.getByRole("button", { name: "Next: Experience" }).click();
  await expect(page.getByLabel("Company").first()).toHaveValue("Acme Corp");
  await expect(page.getByLabel("Start").first()).toHaveValue("Jan 2023");
  await expect(page.getByRole("textbox", { name: "Bullets 2" }).first()).toHaveValue("Moved 30 screens to TypeScript with zero regressions");
  await page.getByRole("button", { name: "Next: Core Skills" }).click();
  await expect(page.getByLabel("Your skills")).toContainText("PostgreSQL");
});
