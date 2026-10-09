// the applicant tracking systems we can recognize from a job posting
export type AtsId =
  | "greenhouse"
  | "lever"
  | "workday"
  | "icims"
  | "taleo"
  | "successfactors"
  | "smartrecruiters"
  | "ashby"
  | "workable"
  | "jobvite"
  | "bamboohr";

export type AtsInfo = {
  id: AtsId;
  name: string;
  // advice that is specific to how this system reads resumes
  tips: string[];
};

// each system, the web addresses that give it away and its tips
const ATS_LIST: (AtsInfo & { hosts: RegExp })[] = [
  {
    id: "greenhouse",
    name: "Greenhouse",
    hosts: /greenhouse\.io/i,
    tips: [
      "Greenhouse shows recruiters your resume as you uploaded it, so a clean one page layout matters.",
      "It pulls your name, email and phone into the form. Check those fields after you upload.",
      "Recruiters search by keyword, so use the same spelling of skills as the job description.",
    ],
  },
  {
    id: "lever",
    name: "Lever",
    hosts: /lever\.co/i,
    tips: [
      "Lever reads PDF and DOCX well, but tables and columns can scramble the order of your text.",
      "It does not match abbreviations to full names, so write both, like Search Engine Optimization (SEO).",
      "Use standard headings such as Work Experience and Education.",
    ],
  },
  {
    id: "workday",
    name: "Workday",
    hosts: /myworkdayjobs\.com|workday\.com/i,
    tips: [
      "Workday ignores text in headers and footers. Keep your contact details in the body of the page.",
      "It fills its own form from your resume, so simple job headings with clear dates parse best.",
      "Use month and year for every job, like 03/2022 or Mar 2022.",
    ],
  },
  {
    id: "icims",
    name: "iCIMS",
    hosts: /icims\.com/i,
    tips: [
      "iCIMS ranks resumes by how closely the wording matches the job description. Mirror its exact phrases.",
      "Avoid images, text boxes and columns. It reads top to bottom and left to right.",
      "A DOCX file tends to parse more cleanly than a PDF here.",
    ],
  },
  {
    id: "taleo",
    name: "Taleo",
    hosts: /taleo\.net|oraclecloud\.com/i,
    tips: [
      "Taleo is strict about headings. Use plain ones like Work Experience, Education and Skills.",
      "It matches exact keywords, so plurals and tenses count. Copy the job description wording.",
      "Skip tables, columns and graphics. Taleo often drops what is inside them.",
    ],
  },
  {
    id: "successfactors",
    name: "SuccessFactors",
    hosts: /successfactors\.(com|eu)|sapsf\.com/i,
    tips: [
      "SuccessFactors parses into a profile form. Check every field after you upload.",
      "Keep dates in one format and put them on the same line as the job title.",
      "Plain fonts and a single column give the cleanest result.",
    ],
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    hosts: /smartrecruiters\.com/i,
    tips: [
      "SmartRecruiters scores your resume against the job. Cover the required skills word for word.",
      "It reads PDF well as long as the text can be selected.",
      "List your skills in their own section so they are picked up as tags.",
    ],
  },
  {
    id: "ashby",
    name: "Ashby",
    hosts: /ashbyhq\.com/i,
    tips: [
      "Ashby keeps your original file and shows it to the hiring team, so tidy formatting counts.",
      "Fill in the links it asks for. Recruiters filter on LinkedIn and GitHub fields.",
      "Answer the extra questions with care. They are often used to screen.",
    ],
  },
  {
    id: "workable",
    name: "Workable",
    hosts: /workable\.com/i,
    tips: [
      "Workable fills the application from your resume. Standard headings help it sort things correctly.",
      "It reads both PDF and DOCX. Avoid scanned or image only files.",
      "Keep your phone and email on their own line at the top.",
    ],
  },
  {
    id: "jobvite",
    name: "Jobvite",
    hosts: /jobvite\.com/i,
    tips: [
      "Jobvite can stumble on columns and tables. A single column layout is safest.",
      "Use full dates with month and year so your timeline is read correctly.",
      "Spell out acronyms at least once.",
    ],
  },
  {
    id: "bamboohr",
    name: "BambooHR",
    hosts: /bamboohr\.com/i,
    tips: [
      "BambooHR is mostly read by a person, so a clear summary at the top goes a long way.",
      "It does not rank by keyword, but recruiters still search. Keep the main skills visible.",
      "PDF keeps your layout intact here.",
    ],
  },
];

// works out which system a posting uses from its link or any links in the text
export function detectAts(jobUrl: string | undefined, jdText: string): AtsInfo | null {
  const haystack = `${jobUrl ?? ""}\n${jdText}`;
  const found = ATS_LIST.find((ats) => ats.hosts.test(haystack));
  if (!found) return null;
  return { id: found.id, name: found.name, tips: found.tips };
}
