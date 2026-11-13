import { describe, expect, it } from "vitest";
import { detectAts, inHouseHost } from "./ats";

describe("which system a posting is on", () => {
  it("knows the systems by their address", () => {
    expect(detectAts("https://boards.greenhouse.io/acme/jobs/7", "")?.name).toBe("Greenhouse");
    expect(detectAts("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/7", "")?.name).toBe("Workday");
    expect(detectAts("https://www.amazon.jobs/en/jobs/3130528", "")).toBeNull();
  });

  it("calls a company's own careers site in house", () => {
    expect(inHouseHost("https://www.amazon.jobs/en/jobs/3130528")).toBe("amazon.jobs");
    expect(inHouseHost("https://careers.northwind.example/jobs/42")).toBe("careers.northwind.example");
  });

  it("says nothing for a known system, a job board, a missing link or junk", () => {
    expect(inHouseHost("https://boards.greenhouse.io/acme/jobs/7")).toBeNull();
    // the posting text gives the system away even when the link does not
    expect(inHouseHost("https://acme.example/careers/7", "Apply at https://jobs.lever.co/acme/7")).toBeNull();
    for (const link of ["https://www.linkedin.com/jobs/view/123", "https://www.indeed.com/viewjob?jk=1", "https://uk.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/job-listing/x"]) expect(inHouseHost(link), link).toBeNull();
    for (const link of [null, undefined, "", "not a link", "javascript:alert(1)", "http://localhost:3000/jobs/1", "http://127.0.0.1/jobs"]) expect(inHouseHost(link), String(link)).toBeNull();
  });
});
