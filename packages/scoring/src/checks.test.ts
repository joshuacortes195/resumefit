import { describe, expect, it } from "vitest";
import { findPlaceholders, formattingChecks, recruiterTipChecks, searchabilityChecks, type Check, type CheckInput } from "./checks";
import { analyzeJd } from "./jd";
import { fontFamily, isStandardFont, type LayoutMeta } from "./layout";
import { parseResume } from "./parse";

// a fixed "today" so Present always means the same month
const TODAY = new Date(2026, 5, 15);

const RESUME = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142
linkedin.com/in/jordanlee

Summary
Data analyst who turns messy numbers into clear answers.

Work Experience
Data Analyst, Northwind Health
Jan 2022 - Present
• Built 14 Tableau dashboards used by 200 staff
• Cut report time by 60% with SQL automation
• Built a forecasting model in Python
• Built data checks that caught 30 errors a month
• Built weekly summaries for 12 leaders

Analyst Intern, Corner Studio
Jun 2021 - Dec 2021
• Cleaned survey data for 5 client projects

Education
B.S. Statistics, State University, 2021
`;

const JD = `Senior Data Analyst
Requirements
5+ years of experience in analytics
Master's degree in Statistics or a related field
`;

// builds the input the checks take, with optional changes to the resume text
function input(resume = RESUME, jd = JD, extra: Partial<CheckInput> = {}): CheckInput {
  const analysis = analyzeJd(jd);
  return { text: resume, parsed: parseResume(resume, TODAY), jd: analysis, jobTitle: analysis.jobTitle, ...extra };
}

// looks a check up by id
function byId(checks: Check[], id: string): Check {
  const found = checks.find((check) => check.id === id);
  if (!found) throw new Error(`no check called ${id}`);
  return found;
}

describe("searchability checks", () => {
  it("passes dates that are all in one format", () => {
    expect(byId(searchabilityChecks(input()), "dates").passed).toBe(true);
  });

  it("flags mixed date formats", () => {
    const mixed = RESUME.replace("Jun 2021 - Dec 2021", "06/2021 - 12/2021");
    expect(byId(searchabilityChecks(input(mixed)), "dates")).toMatchObject({ passed: false });
  });

  it("names the jobs that have no dates", () => {
    const undated = RESUME.replace("Jun 2021 - Dec 2021\n", "");
    const dates = byId(searchabilityChecks(input(undated)), "dates");
    expect(dates.passed).toBe(false);
    expect(dates.details).toEqual(["Analyst Intern"]);
  });

  it("compares the degree to what the job asks for", () => {
    const education = byId(searchabilityChecks(input()), "education-match");
    expect(education.passed).toBe(false);
    expect(education.message).toContain("Master's");
    expect(education.message).toContain("Bachelor's");
  });

  it("lets the user correct the required degree or turn the check off", () => {
    expect(byId(searchabilityChecks(input(RESUME, JD, { educationOverride: "Bachelor's" })), "education-match").passed).toBe(true);
    expect(byId(searchabilityChecks(input(RESUME, JD, { educationOverride: "none" })), "education-match").info).toBe(true);
  });

  it("adds a note instead of a fail when the job names no degree", () => {
    expect(byId(searchabilityChecks(input(RESUME, "Data Analyst\nSQL and Tableau")), "education-match")).toMatchObject({ passed: true, info: true });
  });

  it("checks the file name when a file was uploaded", () => {
    const layout = { ...LAYOUT, fileName: "resume_final_v3 (2).pdf" };
    expect(byId(searchabilityChecks(input(RESUME, JD, { layout })), "file-name").passed).toBe(false);
    expect(byId(searchabilityChecks(input(RESUME, JD, { layout: { ...LAYOUT, fileName: "Jordan-Lee-Resume.pdf" } })), "file-name").passed).toBe(true);
    // a tidy name without the person's name still gets a nudge
    expect(byId(searchabilityChecks(input(RESUME, JD, { layout: { ...LAYOUT, fileName: "resume.pdf" } })), "file-name").message).toContain("your name");
  });
});

describe("recruiter tip checks", () => {
  it("compares years of experience to the job", () => {
    // jan 2022 to june 2026 plus the internship is about five years
    const level = byId(recruiterTipChecks(input()), "job-level");
    expect(level.message).toContain("5+ years");
    expect(level.passed).toBe(true);
    expect(byId(recruiterTipChecks(input(RESUME, JD.replace("5+", "8+"))), "job-level").passed).toBe(false);
  });

  it("adds a note when the job gives no years", () => {
    expect(byId(recruiterTipChecks(input(RESUME, "Data Analyst\nSQL")), "job-level")).toMatchObject({ info: true });
  });

  it("lists measurable results, or bullets that need a number when short", () => {
    const enough = byId(recruiterTipChecks(input()), "measurable-results");
    expect(enough.passed).toBe(true);
    expect(enough.details).toContain("Built 14 Tableau dashboards used by 200 staff");

    const short = byId(recruiterTipChecks(input(RESUME.replace(/\d+%?/g, "many"))), "measurable-results");
    expect(short.passed).toBe(false);
    expect(short.details?.length).toBeGreaterThan(0);
  });

  it("flags a verb that starts too many bullets", () => {
    const verbs = byId(recruiterTipChecks(input()), "repeated-verbs");
    expect(verbs.passed).toBe(false);
    expect(verbs.message).toContain("built (4 times)");
  });

  it("catches common typos and negative wording", () => {
    const checks = recruiterTipChecks(input(RESUME.replace("Cleaned survey data", "Unfortunately recieved bad survey data")));
    expect(byId(checks, "spelling").message).toContain("recieved (received)");
    expect(byId(checks, "negative-tone").message).toContain("unfortunately");
  });
});

// a clean one page file
const LAYOUT: LayoutMeta = {
  fileType: "pdf",
  fileName: "Jordan-Lee-Resume.pdf",
  pageCount: 1,
  pageSize: "Letter",
  margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 },
  columns: 1,
  hasTables: false,
  imageCount: 0,
  headerText: "",
  footerText: "",
  fonts: [
    { name: "ABCDEF+Calibri", share: 0.82 },
    { name: "ABCDEF+Calibri-Bold", share: 0.17 },
    { name: "SymbolMT", share: 0.01 },
  ],
  bodyFontSize: 11,
  minFontSize: 10,
  maxFontSize: 18,
  boldShare: 0.17,
  lightTextShare: 0,
  offLeftShare: 0.08,
};

describe("leftover placeholders", () => {
  it("flags stand-ins that were never filled in", () => {
    const checks = recruiterTipChecks(input(RESUME.replace("Cleaned survey data", "Built a tool used by [N] operators, cutting errors by [X]%. TODO add the date. XXX")));
    const found = byId(checks, "placeholders");
    expect(found).toMatchObject({ passed: false, group: "placeholders", category: "recruiterTips" });
    expect(found.message).toContain("[N], [X]%, TODO, XXX");
    expect(findPlaceholders("Led [number] people at [Company Name]. TBD. Lorem ipsum dolor.")).toEqual(["[number]", "[Company Name]", "TBD", "Lorem ipsum"]);
  });

  it("leaves real text alone and adds nothing to a clean resume", () => {
    expect(recruiterTipChecks(input()).some((check) => check.id === "placeholders")).toBe(false);
    // footnotes, links in brackets, a todo app and ordinary words are not placeholders
    expect(findPlaceholders("Built a Todo app [1] with a [Live Demo] link, [GitHub] and Xxx Corp. Sorted todo lists.")).toEqual([]);
  });
});

describe("formatting checks", () => {
  it("only runs the text checks when there is no file", () => {
    expect(formattingChecks(input()).map((check) => check.id)).toEqual(["paragraphs", "special-characters"]);
  });

  it("passes everything on a clean file", () => {
    const checks = formattingChecks(input(RESUME, JD, { layout: LAYOUT }));
    expect(checks.filter((check) => !check.passed)).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(14);
    // bold and regular of the same family count as one font
    expect(byId(checks, "font-count").message).toBe("You use one font throughout.");
  });

  it("flags each layout problem", () => {
    const messy: LayoutMeta = {
      ...LAYOUT,
      pageCount: 3,
      pageSize: "Other",
      margins: { top: 0.2, right: 0.3, bottom: 0.2, left: 0.3 },
      columns: 2,
      hasTables: true,
      imageCount: 2,
      headerText: "Jordan Lee | jordan.lee@example.com",
      footerText: "References on request",
      fonts: [
        { name: "Papyrus", share: 0.4 },
        { name: "ComicSansMS", share: 0.2 },
        { name: "Arial", share: 0.2 },
        { name: "Impact", share: 0.2 },
      ],
      bodyFontSize: 8,
      boldShare: 0.6,
      lightTextShare: 0.2,
      offLeftShare: 0.7,
    };
    const failed = formattingChecks(input(RESUME, JD, { layout: messy }))
      .filter((check) => !check.passed)
      .map((check) => check.id);
    expect(failed).toEqual(["columns", "images", "tables", "alignment", "bold", "font-color", "font-count", "font-standard", "font-size", "footer", "header", "margins", "page-size", "page-count"]);
  });

  it("is fine with a page number in the footer", () => {
    const checks = formattingChecks(input(RESUME, JD, { layout: { ...LAYOUT, footerText: "Page 1 of 2" } }));
    expect(byId(checks, "footer").passed).toBe(true);
  });

  it("asks early career people to stay on one page", () => {
    const short = RESUME.replace("Jan 2022 - Present", "Jan 2025 - Present");
    const checks = formattingChecks(input(short, JD, { layout: { ...LAYOUT, pageCount: 2 } }));
    expect(byId(checks, "page-count").passed).toBe(false);
  });

  it("flags long paragraphs and decorative symbols", () => {
    const long = `Work Experience\n${"word ".repeat(60)}\n★ ★ ★ ★ ★ ➤ ➤ ✦`;
    const checks = formattingChecks(input(long));
    expect(byId(checks, "paragraphs").passed).toBe(false);
    expect(byId(checks, "special-characters").passed).toBe(false);
  });
});

describe("font names", () => {
  it("cleans up the names files use", () => {
    expect(fontFamily("ABCDEF+Calibri-Bold")).toBe("Calibri");
    expect(fontFamily("TimesNewRomanPSMT")).toBe("Times New Roman");
    expect(fontFamily("Arial-BoldItalicMT")).toBe("Arial");
  });

  it("knows the safe fonts", () => {
    expect(isStandardFont("ABCDEF+Calibri-Bold")).toBe(true);
    expect(isStandardFont("TimesNewRomanPS-BoldMT")).toBe(true);
    expect(isStandardFont("Papyrus")).toBe(false);
  });
});
