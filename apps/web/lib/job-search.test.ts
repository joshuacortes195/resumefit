import { describe, expect, it } from "vitest";
import { findLiveJob, forgetSearches, jobicy, liveJobs, liveSources, relevant, remotive, usajobs, type Getter, type LiveQuery } from "./job-search";

const QUERY: LiveQuery = { what: "firmware engineer", where: "Seattle", remoteOnly: false, internOnly: true, days: 7 };
const KEYS = { USAJOBS_API_KEY: "usa", USAJOBS_EMAIL: "me@example.com" } as unknown as NodeJS.ProcessEnv;
const NONE = {} as NodeJS.ProcessEnv;

// answers each job site the way its own documentation says it does, and writes down what was asked
function sites(): { get: Getter; asked: { url: string; headers?: Record<string, string> }[] } {
  const asked: { url: string; headers?: Record<string, string> }[] = [];
  const get: Getter = async (url, headers) => {
    asked.push({ url, headers });
    if (url.includes("usajobs")) return { SearchResult: { SearchResultItems: [{ MatchedObjectId: "77", MatchedObjectDescriptor: { PositionTitle: "Student Trainee (Engineering)", OrganizationName: "NASA", PositionLocationDisplay: "Seattle, Washington", PositionURI: "https://www.usajobs.gov/job/77", PublicationStartDate: "2026-11-10", QualificationSummary: "Enrolled in an engineering degree.", UserArea: { Details: { JobSummary: "Work on flight software." } } } }] } };
    if (url.includes("remotive")) return { jobs: [{ id: 9, url: "https://remotive.com/remote-jobs/9", title: "Firmware Engineer", company_name: "Farfield", candidate_required_location: "USA", publication_date: "2026-11-11T00:00:00", description: "<p>Rust and C.</p>" }, { id: 10, url: "http://not-secure.example/10", title: "Skipped", company_name: "X", description: "" }] };
    if (url.includes("jobicy")) return { jobs: [{ id: 3, url: "https://jobicy.com/jobs/3", jobTitle: "Embedded Engineer", companyName: "Lumen", jobGeo: "USA", pubDate: "2026-11-09 10:00:00", jobDescription: "<p>Zephyr RTOS.</p>" }] };
    throw new Error("unexpected site");
  };
  return { get, asked };
}

describe("live job search", () => {
  it("only asks the sites it has a key for, and the free ones always", () => {
    expect(liveSources(NONE)).toEqual(["Remotive", "Jobicy"]);
    expect(liveSources(KEYS)).toEqual(["USAJOBS", "Remotive", "Jobicy"]);
    expect(usajobs.ready(NONE)).toBe(false);
  });

  it("reads each site's answer into the same shape", async () => {
    const { get, asked } = sites();
    const [u] = await usajobs.search(QUERY, KEYS, get);
    expect(u).toMatchObject({ id: "usajobs:jobs:77", company: "NASA", via: "USAJOBS", description: "Work on flight software.\n\nEnrolled in an engineering degree." });
    expect(asked[0]?.headers).toMatchObject({ "Authorization-Key": "usa", "User-Agent": "me@example.com" });

    expect((await remotive.search(QUERY, NONE, get))[0]).toMatchObject({ id: "remotive:jobs:9", remote: true, location: "Remote, USA", description: "Rust and C." });
    expect((await jobicy.search(QUERY, NONE, get))[0]).toMatchObject({ id: "jobicy:jobs:3", title: "Embedded Engineer", remote: true });
  });

  it("gathers every site, drops links that are not secure, and asks each site once however often it is searched", async () => {
    forgetSearches();
    const { get, asked } = sites();
    const query = { ...QUERY, what: "engineer", where: `Seattle ${Date.now()}` };
    const first = await liveJobs(query, KEYS, get);
    expect(first.map((job) => job.via).sort()).toEqual(["Jobicy", "Remotive", "USAJOBS"]);
    expect(asked).toHaveLength(3);
    await liveJobs(query, KEYS, get);
    expect(asked).toHaveLength(3);
    // a copy of the app that did not do the search finds the saved answer, and the opening with its description
    forgetSearches();
    expect(await liveJobs(query, KEYS, get)).toHaveLength(3);
    expect(asked).toHaveLength(3);
    forgetSearches();
    expect((await findLiveJob("usajobs:jobs:77"))?.description).toContain("flight software");
    expect(await findLiveJob("greenhouse:acme:1")).toBeNull();
  });

  it("drops openings a site returned that are not about what was asked for", () => {
    const about = (title: string, description = "") => relevant({ title, description }, "data analyst");
    expect(about("Senior Data Analyst")).toBe(true);
    expect(about("Analyst, Growth", "You will work with product data every day.")).toBe(true);
    expect(about("Head of Engineering", "Hire data analysts and engineers.")).toBe(false);
    expect(about("Data Engineer", "Build pipelines.")).toBe(false);
    expect(about("FinOps Data Engineer", "Works with every data analyst on the team.")).toBe(false);
    expect(relevant({ title: "Anything", description: "" }, "")).toBe(true);
  });

  it("carries on when a site is down, and stays quiet offline or with nothing to look for", async () => {
    forgetSearches();
    const { get } = sites();
    const flaky: Getter = async (url, headers) => {
      if (url.includes("remotive")) throw new Error("down");
      return get(url, headers);
    };
    const found = await liveJobs({ ...QUERY, what: "engineer", where: `Tacoma ${Date.now()}` }, KEYS, flaky);
    expect(found.map((job) => job.via).sort()).toEqual(["Jobicy", "USAJOBS"]);
    expect(await liveJobs({ ...QUERY, what: "x" }, KEYS, get)).toEqual([]);
    expect(await liveJobs(QUERY, { ...KEYS, JOB_FEED_OFFLINE: "1" } as NodeJS.ProcessEnv, get)).toEqual([]);
  });
});
