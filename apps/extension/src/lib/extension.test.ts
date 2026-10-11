// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJob } from "./job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./linkedin-page";

// loads one of the saved pages into the test document
function load(name: string): Document {
  document.documentElement.innerHTML = readFileSync(path.join(import.meta.dirname, "../../test/fixtures", `${name}.html`), "utf8");
  return document;
}

describe("reading the page", () => {
  it("reads a posting from structured data, keeping the list structure", () => {
    const job = readJob(load("posting"), "https://careers.northwind.example/jobs/42");
    expect(job).toMatchObject({ title: "Senior Data Analyst", company: "Northwind Health", location: "Denver, CO", url: "https://careers.northwind.example/jobs/42" });
    expect(job?.description).toContain("Requirements\n");
    expect(job?.description).toContain("• Strong SQL and Tableau skills");
  });

  it("falls back to the biggest block of text on a plain page", () => {
    const job = readJob(load("plain-posting"), "https://ironworks.example/careers/welder");
    expect(job?.title).toBe("Structural Welder");
    expect(job?.company).toBe("Ironworks Co");
    expect(job?.description).toContain("AWS D1.1 certification");
    expect(job?.description).not.toContain("Privacy");
  });

  it("does not call a form page a job posting", () => {
    expect(readJob(load("generic"), "https://lakeside.example/apply")).toBeNull();
  });
});

describe("importing a linkedin profile", () => {
  it("only offers it on a profile page", () => {
    expect(isLinkedinProfile("https://www.linkedin.com/in/jordan-lee/")).toBe(true);
    expect(isLinkedinProfile("https://www.linkedin.com/in/jordan-lee/details/skills/")).toBe(true);
    expect(isLinkedinProfile("https://www.linkedin.com/jobs/view/123")).toBe(false);
    expect(isLinkedinProfile("https://notlinkedin.com/in/jordan-lee")).toBe(false);
  });

  it("reads the headline, about, experience and skills, without the buttons and counters", () => {
    const profile = readLinkedinProfile(load("linkedin-profile"), "https://www.linkedin.com/in/jordan-lee/?trk=nav");
    expect(profile.headline).toBe("Data Analyst | SQL and Tableau | Healthcare");
    expect(profile.about).toBe("I help care teams decide faster with clear dashboards.");
    expect(profile.experience).toBe("Data Analyst\nNorthwind Health · Full-time\nJan 2022 - Present · 3 yrs\nBuilt 14 Tableau dashboards used by 200 staff");
    expect(profile.skills).toEqual(["SQL", "Tableau"]);
    expect(profile.url).toBe("linkedin.com/in/jordan-lee");
  });

  it("comes back empty on a page that is not a profile", () => {
    document.documentElement.innerHTML = "<main><p>Nothing to see</p></main>";
    expect(readLinkedinProfile(document, "https://www.linkedin.com/feed/")).toMatchObject({ headline: "", about: "", experience: "", skills: [] });
  });
});
