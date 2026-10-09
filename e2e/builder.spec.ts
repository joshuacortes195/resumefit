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

  // skills, typed and picked from a job description
  await page.getByRole("button", { name: "Next: Core Skills" }).click();
  await page.getByLabel("Add a skill").fill("SQL, Tableau");
  await page.getByLabel("Add a skill").press("Enter");
  await page.getByLabel("Suggest skills for my target job").fill("We need a data analyst with strong Python, SQL and communication skills.");
  await page.getByRole("button", { name: "Find skills in this job" }).click();
  await page.getByRole("button", { name: "+ Python" }).click();
  await expect(page.getByLabel("Your skills")).toContainText("Python");
  // one we already have is not offered again
  await expect(page.getByRole("button", { name: "+ SQL" })).toHaveCount(0);

  // education
  await page.getByRole("button", { name: "Next: Education" }).click();
  await page.getByRole("button", { name: "Add a school" }).click();
  await page.getByLabel("Degree").fill("Bachelor of Science");
  await page.getByLabel("Field of study").fill("Statistics");
  await page.getByLabel("School", { exact: true }).fill("State University");
  await page.getByLabel("Graduation year").fill("2022");

  // summary drafted from the rest
  await page.getByRole("button", { name: "Next: Additional" }).click();
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
  await expect(page.getByLabel("Name")).toHaveValue("Sam Rivera");
  await expect(page.getByLabel("Resume preview")).toContainText("Built 14 dashboards used by 200 staff");
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
