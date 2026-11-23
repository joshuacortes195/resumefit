import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { CONTACT_EMAIL, CONTACT_IS_EMAIL, LEGAL_UPDATED, MINIMUM_AGE, OPERATOR } from "@/lib/legal";

// the two pages as plain text, the way a visitor reads them
const text = (page: () => React.ReactElement) => renderToStaticMarkup(createElement(page)).replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const privacy = text(PrivacyPage);
const terms = text(TermsPage);

describe("the terms and privacy pages", () => {
  it("show the same date, operator, age and contact, all from the one settings file", () => {
    for (const page of [privacy, terms]) {
      expect(page).toContain(`Last updated ${LEGAL_UPDATED}`);
      expect(page).toContain(OPERATOR);
      expect(page).toContain(String(MINIMUM_AGE));
      expect(page).toContain(CONTACT_EMAIL);
    }
    expect(LEGAL_UPDATED).toBe("November 22, 2026");
    // the placeholder is not mistaken for a real address
    expect(CONTACT_IS_EMAIL).toBe(CONTACT_EMAIL.includes("@") && !CONTACT_EMAIL.includes("["));
  });

  it("name every ai provider the code can call", () => {
    const providers = readFileSync(path.join(import.meta.dirname, "ai/providers.ts"), "utf8");
    for (const [inCode, named] of [
      ["gemini", "Gemini"],
      ["groq", "Groq"],
      ["cloudflare", "Cloudflare"],
    ]) {
      expect(providers.toLowerCase()).toContain(inCode);
      expect(privacy).toContain(named);
      expect(terms).toContain(named);
    }
  });

  it("cover what a launch needs", () => {
    for (const part of ["Supabase", "Vercel", "DuckDuckGo", "Limited Use", "California", "never sell", "Download everything", "Delete"]) expect(privacy).toContain(part);
    for (const part of ["as is", "Limitation of liability", "Acceptable use", "Auto Apply", "You are responsible for every application", "Governing law", "California"]) expect(terms.toLowerCase()).toContain(part.toLowerCase());
  });

  // find jobs searches the newest title on the resume when nothing is typed, and the policy has to say so
  it("say what find jobs sends to the job sites", () => {
    const findJobs = readFileSync(path.join(import.meta.dirname, "../app/actions/find-jobs.ts"), "utf8");
    expect(findJobs).toContain("parseResume(chosen.rawText).experience[0]?.title");
    expect(privacy).toContain("When you leave the title empty, the most recent job title on your resume is searched for instead.");
  });

  // the saved answers are locked and a deleted resume leaves its scans, and the policy has to say both
  it("say saved answers are encrypted and what deleting a resume does to its scans", () => {
    const profile = readFileSync(path.join(import.meta.dirname, "data/profile.ts"), "utf8");
    const resumes = readFileSync(path.join(import.meta.dirname, "data/resumes.ts"), "utf8");
    expect(profile).toContain("qaBank: sealQaBank(profile.qaBank, secret)");
    expect(resumes).toContain("await forgetResumeInScans(userId, id);");
    expect(privacy).toContain("your saved answers to application questions and the answers used on each application are encrypted before they are stored");
    expect(privacy).toContain("takes its text and the details read from it out of the scans you ran with it");
  });

  it("never use long dashes", () => {
    expect(privacy + terms).not.toMatch(/[—–]/);
  });
});
