import { describe, expect, it } from "vitest";
import { applyUrl } from "./apply-url";

describe("going straight to the application form", () => {
  it("adds the form page to lever and ashby postings", () => {
    expect(applyUrl("https://jobs.lever.co/spotify/1b2c3d4e-0000-4000-8000-123456789abc")).toBe("https://jobs.lever.co/spotify/1b2c3d4e-0000-4000-8000-123456789abc/apply");
    expect(applyUrl("https://jobs.ashbyhq.com/linear/9f8e7d6c-0000-4000-8000-123456789abc?utm_source=feed")).toBe("https://jobs.ashbyhq.com/linear/9f8e7d6c-0000-4000-8000-123456789abc/application");
  });

  it("leaves a form page alone", () => {
    expect(applyUrl("https://jobs.lever.co/spotify/1b2c3d4e/apply")).toBe("https://jobs.lever.co/spotify/1b2c3d4e/apply");
    expect(applyUrl("https://jobs.ashbyhq.com/linear/9f8e7d6c/application")).toBe("https://jobs.ashbyhq.com/linear/9f8e7d6c/application");
  });

  it("sends a greenhouse posting on a company's own site to the form at greenhouse", () => {
    expect(applyUrl("https://stripe.com/jobs/search?gh_jid=8172510")).toBe("https://boards.greenhouse.io/embed/job_app?for=stripe&token=8172510");
    // already at greenhouse, where the form sits under the posting
    expect(applyUrl("https://boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004")).toBe("https://boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004");
  });

  it("changes nothing it does not recognize", () => {
    expect(applyUrl("https://careers.example.com/jobs/77?gh_jid=12")).toBe("https://careers.example.com/jobs/77?gh_jid=12");
    expect(applyUrl("https://jobs.example.com/harbor/77")).toBe("https://jobs.example.com/harbor/77");
    expect(applyUrl("not an address")).toBe("not an address");
  });
});
