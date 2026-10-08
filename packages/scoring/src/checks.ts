import type { ResumeContact, ResumeSection } from "./parse";
import { measurableResults, wordCount } from "./parse";
import { CHECK_CONFIG } from "./config";

// one pass or fail line in the report
export type Check = {
  id: string;
  category: "searchability" | "recruiterTips";
  passed: boolean;
  // what we tell the user about it
  message: string;
};

// everything the checks need to know about the resume
export type CheckInput = {
  text: string;
  sections: ResumeSection[];
  contact: ResumeContact;
  // the job title from the posting, if we know it
  jobTitle?: string;
};

// tired phrases that recruiters skim past
const CLICHES = [
  "team player",
  "hard worker",
  "go-getter",
  "results-driven",
  "synergy",
  "think outside the box",
  "detail-oriented",
  "self-starter",
  "dynamic",
  "passionate",
];

// small helper so each check reads as one line
function check(id: string, category: Check["category"], passed: boolean, pass: string, fail: string): Check {
  return { id, category, passed, message: passed ? pass : fail };
}

// can a scanner find you and file the resume correctly
export function searchabilityChecks({ text, sections, contact, jobTitle }: CheckInput): Check[] {
  const experience = sections.find((section) => section.kind === "experience");
  const education = sections.find((section) => section.kind === "education");

  const checks = [
    check("email", "searchability", contact.email !== null, "We found your email address.", "We could not find an email address. Recruiters need one to reach you."),
    check("phone", "searchability", contact.phone !== null, "We found your phone number.", "We could not find a phone number. Add one near the top."),
    check(
      "location",
      "searchability",
      contact.location !== null,
      "We found your location.",
      "We could not find a city and state. Recruiters use location to match you with nearby jobs.",
    ),
    check(
      "education-section",
      "searchability",
      education !== undefined,
      "We found your education section.",
      "We could not find an education section. Add a heading called Education.",
    ),
    check(
      "experience-section",
      "searchability",
      experience !== undefined,
      "We found your work experience section.",
      "We could not find a work experience section. Add a heading called Work Experience.",
    ),
  ];

  // only worth checking the heading name when the section exists
  if (experience) {
    checks.push(
      check(
        "experience-heading",
        "searchability",
        experience.standard,
        "Your work experience heading is a standard name.",
        `Rename "${experience.heading}" to Work Experience or Professional Experience so scanners recognize it.`,
      ),
    );
  }

  // only runs when we know which job title to look for
  if (jobTitle?.trim()) {
    const title = jobTitle.trim();
    checks.push(
      check(
        "job-title",
        "searchability",
        text.toLowerCase().includes(title.toLowerCase()),
        `The job title "${title}" is in your resume.`,
        `The job title "${title}" is not in your resume. If it fits your background, work it into your summary.`,
      ),
    );
  }
  return checks;
}

// the things a recruiter notices in a quick read
export function recruiterTipChecks({ text, sections, contact }: CheckInput): Check[] {
  const results = measurableResults(sections).length;
  const words = wordCount(text);
  const lower = text.toLowerCase();
  const cliches = CLICHES.filter((phrase) => lower.includes(phrase));
  const hasLink = contact.linkedin !== null || contact.github !== null || contact.links.length > 0;

  return [
    check(
      "summary",
      "recruiterTips",
      sections.some((section) => section.kind === "summary"),
      "You have a summary section.",
      "Add a short summary at the top that says who you are and what you are looking for.",
    ),
    check(
      "measurable-results",
      "recruiterTips",
      results >= CHECK_CONFIG.minMeasurableResults,
      `We found ${results} bullets with measurable results.`,
      `We found ${results} bullets with measurable results. Aim for at least ${CHECK_CONFIG.minMeasurableResults} by adding numbers, percentages or amounts.`,
    ),
    check(
      "tone",
      "recruiterTips",
      cliches.length === 0,
      "Your wording is clear, with no overused phrases.",
      `Swap out overused phrases: ${cliches.join(", ")}.`,
    ),
    check(
      "web-presence",
      "recruiterTips",
      hasLink,
      "You link to a profile or website.",
      "Add a link to your LinkedIn, GitHub or portfolio so recruiters can see more of your work.",
    ),
    check(
      "word-count",
      "recruiterTips",
      words >= CHECK_CONFIG.minWords && words <= CHECK_CONFIG.maxWords,
      `Your resume has ${words} words, which is a good length.`,
      words < CHECK_CONFIG.minWords
        ? `Your resume has ${words} words. Under ${CHECK_CONFIG.minWords} usually means there is not enough detail.`
        : `Your resume has ${words} words. Try to keep it under ${CHECK_CONFIG.maxWords}.`,
    ),
  ];
}
