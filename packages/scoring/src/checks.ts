import { CHECK_CONFIG } from "./config";
import type { JdAnalysis } from "./jd";
import { fontFamily, isStandardFont, type LayoutMeta } from "./layout";
import { degreeAtLeast, highestDegree, isBullet, stripBullet, type DegreeLevel, type ParsedResume } from "./parse";

// the rows a finding can sit under in the report
export type CheckGroup =
  | "contact"
  | "headings"
  | "job-title"
  | "dates"
  | "education"
  | "file"
  | "summary"
  | "job-level"
  | "measurable"
  | "tone"
  | "placeholders"
  | "web-presence"
  | "word-count"
  | "verbs"
  | "spelling"
  | "layout"
  | "fonts"
  | "page-setup";

// one pass or fail line in the report
export type Check = {
  id: string;
  category: "searchability" | "recruiterTips" | "formatting";
  group: CheckGroup;
  passed: boolean;
  // what we tell the user about it
  message: string;
  // true for notes that are shown but do not move the score
  info?: boolean;
  // extra lines the report can expand, like the list of measurable results
  details?: string[];
};

// everything the checks need to know
export type CheckInput = {
  text: string;
  parsed: ParsedResume;
  jd: JdAnalysis;
  // the job title to look for, typed by the user or guessed from the posting
  jobTitle?: string | null;
  // lets the user correct the degree we read from the posting, "none" turns the check off
  educationOverride?: DegreeLevel | "none" | null;
  // only there when a file was uploaded
  layout?: LayoutMeta | null;
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

// wording that reads as negative
const NEGATIVE = ["fired", "hate", "hated", "failed to", "unfortunately", "terminated", "boring", "couldn't", "laid off", "quit"];

// typos that show up on resumes a lot, with the right spelling
const MISSPELLINGS: Record<string, string> = {
  recieve: "receive",
  recieved: "received",
  seperate: "separate",
  managment: "management",
  mangement: "management",
  manger: "manager",
  responsibile: "responsible",
  responsibilites: "responsibilities",
  acheive: "achieve",
  acheived: "achieved",
  achived: "achieved",
  definately: "definitely",
  occured: "occurred",
  occurence: "occurrence",
  experiance: "experience",
  expereince: "experience",
  sucessful: "successful",
  succesful: "successful",
  successfull: "successful",
  teh: "the",
  adress: "address",
  accomodate: "accommodate",
  acommodate: "accommodate",
  buisness: "business",
  calender: "calendar",
  collegue: "colleague",
  comittee: "committee",
  commited: "committed",
  enviroment: "environment",
  goverment: "government",
  independant: "independent",
  knowlege: "knowledge",
  liason: "liaison",
  maintainance: "maintenance",
  maintenence: "maintenance",
  neccessary: "necessary",
  necesary: "necessary",
  noticable: "noticeable",
  perfomance: "performance",
  performence: "performance",
  proffesional: "professional",
  profesional: "professional",
  refered: "referred",
  relevent: "relevant",
  shedule: "schedule",
  succesfully: "successfully",
  sucessfully: "successfully",
  thier: "their",
  untill: "until",
  writting: "writing",
  analize: "analyze",
  assesment: "assessment",
  begining: "beginning",
  developement: "development",
  implimented: "implemented",
  implemention: "implementation",
  intergrated: "integrated",
  langauge: "language",
  libary: "library",
  oppurtunity: "opportunity",
  recomend: "recommend",
  strenght: "strength",
  techincal: "technical",
  tecnical: "technical",
  transfered: "transferred",
  utlize: "utilize",
};

// small helper so each check reads as one call
function check(
  id: string,
  category: Check["category"],
  group: CheckGroup,
  passed: boolean,
  pass: string,
  fail: string,
  extra: Pick<Check, "details" | "info"> = {},
): Check {
  return { id, category, group, passed, message: passed ? pass : fail, ...extra };
}

// a note that shows in the report without counting for or against the score
function note(id: string, category: Check["category"], group: CheckGroup, message: string): Check {
  return { id, category, group, passed: true, message, info: true };
}

// words in a file name that make it look unfinished
const MESSY_FILE_NAME = /final|draft|copy|untitled|new|edited|updated|\bv\d|\(\d+\)|\d{6,}/i;

// can a scanner find you and file the resume correctly
export function searchabilityChecks({ text, parsed, jd, jobTitle, educationOverride, layout }: CheckInput): Check[] {
  const { sections, contact, experience, education } = parsed;
  const experienceSection = sections.find((section) => section.kind === "experience");
  const educationSection = sections.find((section) => section.kind === "education");
  const lower = text.toLowerCase().replace(/\s+/g, " ");

  const checks = [
    check(
      "location",
      "searchability",
      "contact",
      contact.location !== null,
      "We found your location.",
      "We could not find a city and state. Recruiters use location to match you with nearby jobs.",
    ),
    check("email", "searchability", "contact", contact.email !== null, "We found your email address.", "We could not find an email address. Recruiters need one to reach you."),
    check("phone", "searchability", "contact", contact.phone !== null, "We found your phone number.", "We could not find a phone number. Add one near the top."),
    check(
      "education-section",
      "searchability",
      "headings",
      educationSection !== undefined,
      "We found your education section.",
      "We could not find an education section. Add a heading called Education.",
    ),
    check(
      "experience-section",
      "searchability",
      "headings",
      experienceSection !== undefined,
      "We found your work experience section.",
      "We could not find a work experience section. Add a heading called Work Experience.",
    ),
  ];

  // only worth checking the heading name when the section exists
  if (experienceSection) {
    checks.push(
      check(
        "experience-heading",
        "searchability",
        "headings",
        experienceSection.standard,
        "Your work experience heading is a standard name.",
        `Rename "${experienceSection.heading}" to Work Experience or Professional Experience so scanners recognize it.`,
      ),
    );
  }

  // is the exact job title somewhere in the resume
  const title = jobTitle?.trim();
  if (title) {
    checks.push(
      check(
        "job-title",
        "searchability",
        "job-title",
        lower.includes(title.toLowerCase()),
        `The job title "${title}" is in your resume.`,
        `The job title "${title}" is not in your resume. If it fits your background, work it into your summary.`,
      ),
    );
  } else {
    checks.push(note("job-title", "searchability", "job-title", "We could not tell the job title from the posting. Add it so we can check your resume for it."));
  }

  // every job should have dates, all written the same way
  if (experience.length > 0) {
    const undated = experience.filter((entry) => !entry.dates);
    const styles = new Set(experience.flatMap((entry) => (entry.dates ? [entry.dates.start.style] : [])));
    if (undated.length > 0) {
      const names = undated.map((entry) => entry.title ?? entry.company ?? "Untitled job");
      checks.push(
        check("dates", "searchability", "dates", false, "", `We could not find dates for ${undated.length} of your ${experience.length} jobs. Add a start and end date to each one.`, {
          details: names,
        }),
      );
    } else {
      checks.push(
        check(
          "dates",
          "searchability",
          "dates",
          styles.size <= 1,
          "The dates in your work experience are easy to read and all in one format.",
          "Your dates mix formats, like Jan 2024 in one place and 01/2024 in another. Pick one and use it everywhere.",
        ),
      );
    }
  }

  // does the degree on the resume meet what the job asks for
  const wanted = educationOverride === "none" ? null : (educationOverride ?? jd.educationRequired);
  const have = highestDegree(education);
  if (!wanted) {
    const preferred = jd.educationPreferred;
    checks.push(
      note(
        "education-match",
        "searchability",
        "education",
        preferred
          ? `This job prefers a ${preferred} degree but does not require one.${have ? ` Your resume lists a ${have}.` : ""}`
          : "This job description does not ask for a specific degree.",
      ),
    );
  } else {
    checks.push(
      check(
        "education-match",
        "searchability",
        "education",
        have !== null && degreeAtLeast(have, wanted),
        `Your ${have} meets the ${wanted} degree this job asks for.`,
        have
          ? `This job asks for a ${wanted} degree and your resume lists a ${have}. If you have equivalent experience, say so in your summary.`
          : `This job asks for a ${wanted} degree and we could not find a degree in your resume.`,
      ),
    );
  }

  // file checks only make sense when a file was uploaded
  if (layout) {
    checks.push(note("file-type", "searchability", "file", `You uploaded a ${layout.fileType.toUpperCase()} file, which scanners read well.`));
    if (layout.fileName) {
      const base = layout.fileName.replace(/\.[a-z0-9]+$/i, "");
      const lastName = contact.name?.split(" ").at(-1)?.toLowerCase();
      const messy = MESSY_FILE_NAME.test(base) || /[^A-Za-z0-9 ._-]/.test(base);
      const named = !lastName || base.toLowerCase().includes(lastName);
      checks.push(
        check(
          "file-name",
          "searchability",
          "file",
          !messy && named,
          "Your file name is clean and easy to recognize.",
          messy
            ? `The file name "${layout.fileName}" looks unfinished. Rename it to something like First-Last-Resume.`
            : `Put your name in the file name, like First-Last-Resume, so recruiters can find it later.`,
        ),
      );
    }
  }
  return checks;
}

// stand-ins people leave for later: "[N]", "[X]%", "[company name]", TODO, TBD, XXX and filler text
const PLACEHOLDER = /\[(?:[A-Za-z#?_]{1,2}|x+|number|num|company(?: name)?|name|role|title|date|year|metric|your [a-z ]{1,30}|insert[^\]]{0,30})\]%?|\b(?:TODO|TBD|XXX+)\b|lorem ipsum/gi;

// every leftover placeholder in a resume, each one listed once, as it was written
export function findPlaceholders(text: string): string[] {
  const found = (text.match(PLACEHOLDER) ?? []).filter((match) => match.startsWith("[") || /lorem/i.test(match) || match === match.toUpperCase());
  return [...new Set(found)].slice(0, 8);
}

// the things a recruiter notices in a quick read
export function recruiterTipChecks({ text, parsed, jd }: CheckInput): Check[] {
  const { sections, contact, yearsExperience } = parsed;
  const results = parsed.measurableResults;
  const words = parsed.wordCount;
  const lower = text.toLowerCase();
  const cliches = CLICHES.filter((phrase) => lower.includes(phrase));
  const negatives = NEGATIVE.filter((phrase) => new RegExp(`\\b${phrase}\\b`, "i").test(text));
  const hasLink = contact.linkedin !== null || contact.github !== null || contact.links.length > 0;

  // bullets from the jobs and projects, used by a few checks below
  const bullets = sections
    .filter((section) => section.kind === "experience" || section.kind === "projects")
    .flatMap((section) => section.lines)
    .filter(isBullet)
    .map(stripBullet);

  const checks = [
    check(
      "summary",
      "recruiterTips",
      "summary",
      sections.some((section) => section.kind === "summary"),
      "You have a summary section.",
      "Add a short summary at the top that says who you are and what you are looking for.",
    ),
  ];

  // years the job asks for against the years we can count from the dates
  if (jd.yearsRequired === null && jd.levelYears && yearsExperience !== null) {
    // the posting gives no number, but its title names a level
    checks.push(
      check(
        "job-level",
        "recruiterTips",
        "job-level",
        yearsExperience + 0.5 >= jd.levelYears,
        `A title at this level usually means about ${jd.levelYears} years of experience, and your resume shows about ${yearsExperience}.`,
        `A title at this level usually means about ${jd.levelYears} years of experience, and your resume shows about ${yearsExperience}. This role is likely more senior than your resume supports.`,
      ),
    );
  } else if (jd.yearsRequired === null) {
    checks.push(note("job-level", "recruiterTips", "job-level", "No specific years of experience were found in this job description, so there is nothing to compare here."));
  } else if (yearsExperience === null) {
    checks.push(
      note("job-level", "recruiterTips", "job-level", `This job asks for ${jd.yearsRequired}+ years of experience. We could not count yours because your jobs have no dates we can read.`),
    );
  } else {
    checks.push(
      check(
        "job-level",
        "recruiterTips",
        "job-level",
        // half a year of slack so 2.8 years is not marked short of 3
        yearsExperience + 0.5 >= jd.yearsRequired,
        `This job asks for ${jd.yearsRequired}+ years and your resume shows about ${yearsExperience}.`,
        `This job asks for ${jd.yearsRequired}+ years and your resume shows about ${yearsExperience}. Make sure projects, internships and freelance work are listed with dates.`,
      ),
    );
  }

  // bullets that could take a number, shown when there are not enough measured ones
  const unmeasured = bullets.filter((bullet) => !/\d/.test(bullet)).slice(0, 5);
  const enough = results.length >= CHECK_CONFIG.minMeasurableResults;
  checks.push(
    check(
      "measurable-results",
      "recruiterTips",
      "measurable",
      enough,
      `We found ${results.length} bullets with measurable results.`,
      `We found ${results.length} bullets with measurable results. Aim for at least ${CHECK_CONFIG.minMeasurableResults} by adding numbers, percentages or amounts.`,
      { details: enough ? results.map(stripBullet) : unmeasured },
    ),
    check(
      "tone",
      "recruiterTips",
      "tone",
      cliches.length === 0,
      "Your wording is clear, with no overused phrases.",
      `Swap out overused phrases: ${cliches.join(", ")}.`,
    ),
  );
  if (negatives.length > 0) {
    checks.push(check("negative-tone", "recruiterTips", "tone", false, "", `Some wording reads as negative: ${negatives.join(", ")}. Say what you did instead.`));
  }

  // text that was meant to be filled in later and never was. only shown when there is some, so it never pads the score
  const leftovers = findPlaceholders(text);
  if (leftovers.length > 0) {
    checks.push(check("placeholders", "recruiterTips", "placeholders", false, "", `Unfinished text is still in your resume: ${leftovers.join(", ")}. Fill in the real number or word before you send it.`));
  }

  // too long gets cut some slack for people with a long career
  const maxWords = (yearsExperience ?? 0) >= 10 ? CHECK_CONFIG.maxWordsSenior : CHECK_CONFIG.maxWords;
  checks.push(
    check(
      "web-presence",
      "recruiterTips",
      "web-presence",
      hasLink,
      "You link to a profile or website.",
      "Add a link to your LinkedIn, GitHub or portfolio so recruiters can see more of your work.",
    ),
    check(
      "word-count",
      "recruiterTips",
      "word-count",
      words >= CHECK_CONFIG.minWords && words <= maxWords,
      `There are ${words} words in your resume, which is a good length.`,
      words < CHECK_CONFIG.minWords
        ? `There are ${words} words in your resume. Under ${CHECK_CONFIG.minWords} usually means there is not enough detail.`
        : `There are ${words} words in your resume. Try to keep it under ${maxWords}.`,
    ),
  );

  // starting too many bullets with the same verb reads as repetitive
  const verbCounts = new Map<string, number>();
  for (const bullet of bullets) {
    const verb = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    if (verb && verb.length > 2) verbCounts.set(verb, (verbCounts.get(verb) ?? 0) + 1);
  }
  const repeated = [...verbCounts].filter(([, count]) => count > CHECK_CONFIG.maxSameVerb).map(([verb, count]) => `${verb} (${count} times)`);
  if (bullets.length > 0) {
    checks.push(
      check(
        "repeated-verbs",
        "recruiterTips",
        "verbs",
        repeated.length === 0,
        "Your bullets start with a good mix of action verbs.",
        `Too many bullets start with the same verb: ${repeated.join(", ")}. Mix in a few different ones.`,
      ),
    );
  }

  // quick look for common typos
  const typos = [...new Set((lower.match(/[a-z]+/g) ?? []).filter((word) => word in MISSPELLINGS))];
  checks.push(
    check(
      "spelling",
      "recruiterTips",
      "spelling",
      typos.length === 0,
      "We did not spot any common spelling mistakes.",
      `Possible spelling mistakes: ${typos.map((typo) => `${typo} (${MISSPELLINGS[typo]})`).join(", ")}.`,
    ),
  );
  return checks;
}

// decorative symbols that scanners often turn into junk
const SPECIAL_CHARS = /[★☆✦✧❖◆◇♦➤➔→⇒☑✔✗✘☎✉⌂♥❤⚑⚙✎✪❯❱»«►▶]|\p{Extended_Pictographic}/gu;

// how the page looks, which decides whether a scanner can read it at all
export function formattingChecks({ text, parsed, layout }: CheckInput): Check[] {
  // these two work on plain text too
  const longLines = text.split(/\r?\n/).filter((line) => line.split(/\s+/).filter(Boolean).length > CHECK_CONFIG.maxParagraphWords);
  const special = text.match(SPECIAL_CHARS) ?? [];

  const paragraphs = check(
    "paragraphs",
    "formatting",
    "layout",
    longLines.length === 0,
    "Your bullets and paragraphs are short and easy to skim.",
    `${longLines.length} of your paragraphs run past ${CHECK_CONFIG.maxParagraphWords} words. Break them into shorter bullets.`,
    { details: longLines.map((line) => `${line.slice(0, 120)}...`) },
  );
  const specialChars = check(
    "special-characters",
    "formatting",
    "fonts",
    special.length <= CHECK_CONFIG.maxSpecialChars,
    "You keep special characters to a minimum.",
    `We found ${special.length} decorative symbols or emoji (${[...new Set(special)].slice(0, 8).join(" ")}). Scanners often turn these into junk, so stick to plain bullets.`,
  );

  // pasted text has no layout to check
  if (!layout) return [paragraphs, specialChars];

  const checks: Check[] = [
    check(
      "columns",
      "formatting",
      "layout",
      layout.columns <= 1,
      "Your resume uses a single column, which scanners read in the right order.",
      `Your resume uses ${layout.columns} columns. Many scanners read straight across the page and mix the columns together. A single column is safest.`,
    ),
    paragraphs,
    check(
      "images",
      "formatting",
      "layout",
      layout.imageCount === 0,
      "There are no images in your resume.",
      `We found ${layout.imageCount} ${layout.imageCount === 1 ? "image" : "images"}. Scanners cannot read text inside images, and photos or icons can confuse them.`,
    ),
    check(
      "tables",
      "formatting",
      "layout",
      !layout.hasTables,
      "There are no tables in your resume.",
      "Your resume uses a table. Scanners often read tables out of order or skip them. Use plain lines and bullets instead.",
    ),
  ];
  if (layout.offLeftShare !== null) {
    checks.push(
      check(
        "alignment",
        "formatting",
        "layout",
        layout.offLeftShare <= CHECK_CONFIG.maxOffLeftShare,
        "Your text is mostly left aligned.",
        "A lot of your text is centered or right aligned. Keep the body left aligned so it is easy to scan.",
      ),
    );
  }

  // fonts
  checks.push(specialChars);
  if (layout.boldShare !== null) {
    checks.push(
      check(
        "bold",
        "formatting",
        "fonts",
        layout.boldShare <= CHECK_CONFIG.maxBoldShare,
        "Bold is used sparingly, so the important parts stand out.",
        `About ${Math.round(layout.boldShare * 100)}% of your text is bold. Save bold for headings, job titles and a few key words.`,
      ),
    );
  }
  if (layout.lightTextShare !== null) {
    checks.push(
      check(
        "font-color",
        "formatting",
        "fonts",
        layout.lightTextShare <= CHECK_CONFIG.maxLightTextShare,
        "Your text color is easy to read.",
        "Some of your text is in a very light color. It is hard to read on screen and can vanish when printed. Use black or dark grey.",
      ),
    );
  }
  // tiny amounts of a font, like a bullet symbol, do not count
  const mainFonts = [...new Set(layout.fonts.filter((font) => font.share >= 0.03).map((font) => fontFamily(font.name)))];
  if (mainFonts.length > 0) {
    const top = mainFonts[0] ?? "";
    checks.push(
      check(
        "font-count",
        "formatting",
        "fonts",
        mainFonts.length <= CHECK_CONFIG.maxFonts,
        mainFonts.length === 1 ? "You use one font throughout." : `You use ${mainFonts.length} fonts, which keeps things consistent.`,
        `You use ${mainFonts.length} fonts (${mainFonts.join(", ")}). Stick to one or two.`,
      ),
      check(
        "font-standard",
        "formatting",
        "fonts",
        isStandardFont(top),
        `${top} is a standard font that every scanner can read.`,
        `${top} is not a common font. If the reader does not have it installed your layout can shift. Arial, Calibri, Georgia and Times New Roman are safe picks.`,
      ),
    );
  }
  if (layout.bodyFontSize !== null) {
    const size = Math.round(layout.bodyFontSize * 10) / 10;
    checks.push(
      check(
        "font-size",
        "formatting",
        "fonts",
        size >= CHECK_CONFIG.minFontSize && size <= CHECK_CONFIG.maxFontSize,
        `Your body text is ${size}pt, which is comfortable to read.`,
        size < CHECK_CONFIG.minFontSize ? `Your body text is ${size}pt, which is small. Use 10 to 12pt.` : `Your body text is ${size}pt, which is large. Use 10 to 12pt.`,
      ),
    );
  }

  // page setup, page numbers in the footer are fine
  const header = layout.headerText.trim();
  const footer = layout.footerText.replace(/page\s*\d+(\s*of\s*\d+)?|^\s*\d+\s*$/gim, "").trim();
  checks.push(
    check(
      "footer",
      "formatting",
      "page-setup",
      footer.length === 0,
      "There is nothing important in the page footer.",
      "You have text in the page footer. Some scanners skip footers, so move anything that matters into the body.",
    ),
    check(
      "header",
      "formatting",
      "page-setup",
      header.length === 0,
      "There is nothing important in the page header.",
      "You have text in the page header. Some scanners skip headers, so put your name and contact details in the body of the page.",
    ),
  );
  if (layout.margins) {
    const { top, right, bottom, left } = layout.margins;
    const smallest = Math.min(top, right, bottom, left);
    checks.push(
      check(
        "margins",
        "formatting",
        "page-setup",
        smallest >= CHECK_CONFIG.minMargin && left <= CHECK_CONFIG.maxMargin,
        "Your margins are a standard size.",
        smallest < CHECK_CONFIG.minMargin
          ? `Your margins are tight (about ${smallest.toFixed(2)} inches at the narrowest). Keep them between 0.5 and 1 inch so nothing is cut off.`
          : `Your margins are wide (about ${left.toFixed(2)} inches). Keep them between 0.5 and 1 inch to use the page well.`,
      ),
    );
  }
  if (layout.pageSize) {
    checks.push(
      check(
        "page-size",
        "formatting",
        "page-setup",
        layout.pageSize !== "Other",
        `Your page is standard ${layout.pageSize} size.`,
        "Your page is not a standard size. Use US Letter or A4 so it prints and displays correctly.",
      ),
    );
  }
  if (layout.pageCount !== null) {
    // people early in their career should fit on one page
    const newGrad = parsed.yearsExperience !== null && parsed.yearsExperience < CHECK_CONFIG.newGradYears;
    const limit = newGrad ? 1 : 2;
    checks.push(
      check(
        "page-count",
        "formatting",
        "page-setup",
        layout.pageCount <= limit,
        `Your resume is ${layout.pageCount} ${layout.pageCount === 1 ? "page" : "pages"}, which is a good length.`,
        newGrad
          ? `Your resume is ${layout.pageCount} pages. With under ${CHECK_CONFIG.newGradYears} years of experience, one page is plenty.`
          : `Your resume is ${layout.pageCount} pages. Recruiters rarely read past two.`,
      ),
    );
  }
  return checks;
}
