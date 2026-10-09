import type { CheckGroup } from "@resumefit/scoring";
import type { ScoreCategory } from "@resumefit/shared";

// the five parts of the report, in the order they show
export const SECTIONS: {
  key: ScoreCategory;
  label: string;
  // how much this part moves the score
  impact: string;
  explainer: string;
  tip: string;
  // what the guided tour says about it
  tour: string;
}[] = [
  {
    key: "searchability",
    label: "Searchability",
    impact: "Important",
    explainer: "Recruiters search their system for candidates the way you search the web. These checks make sure your resume turns up and gets filed under the right details.",
    tip: "Fix the red items first. Each one is something a scanner looks for by name.",
    tour: "Searchability covers the basics a scanner needs to file you correctly: contact details, standard headings, the job title and clean dates.",
  },
  {
    key: "hardSkills",
    label: "Hard skills",
    impact: "High score impact",
    explainer: "Hard skills are the tools and know-how the job needs, like software, methods and certifications. They carry the most weight in your match rate.",
    tip: "Use the same spelling as the job description, and start with the skills it repeats most.",
    tour: "Hard skills move your score the most. The table compares how often each skill shows up in your resume and in the job description.",
  },
  {
    key: "softSkills",
    label: "Soft skills",
    impact: "Medium score impact",
    explainer: "Soft skills are how you work with people and problems. Scanners give them less weight, but recruiters still look for them.",
    tip: "Lead with hard skills to get the interview, then show your soft skills once you are in the room.",
    tour: "Soft skills work the same way as hard skills but count for less. Work a few in where they are true.",
  },
  {
    key: "recruiterTips",
    label: "Recruiter tips",
    impact: "Important",
    explainer: "These are the things a recruiter notices in a quick read: length, numbers, tone and whether you look like a fit for the level.",
    tip: "Numbers do the most work here. A bullet with a result beats a bullet with a duty.",
    tour: "Recruiter tips look at what a person notices in the first few seconds, like measurable results and word count.",
  },
  {
    key: "formatting",
    label: "Formatting",
    impact: "Medium score impact",
    explainer: "A resume a scanner cannot read never reaches a person. These checks look at layout, fonts and page setup.",
    tip: "When in doubt, keep it plain: one column, a common font and no text boxes.",
    tour: "Formatting checks whether a scanner can read the file at all. Upload a PDF or DOCX to get the full set of checks.",
  },
];

// the name and explanation for each row of findings
export const GROUPS: Record<CheckGroup, { label: string; hint: string }> = {
  contact: { label: "Contact information", hint: "Scanners copy your contact details into the recruiter's database. If one is missing, they cannot reach you or match you by location." },
  headings: { label: "Section headings", hint: "Scanners sort your resume by its headings. Plain names like Work Experience and Education are recognized everywhere." },
  "job-title": { label: "Job title match", hint: "Recruiters often search by the exact job title, so having it in your resume makes you much easier to find." },
  dates: { label: "Date formatting", hint: "Scanners work out how long you spent in each role from your dates. They need a start and end date in a format they know." },
  education: { label: "Education match", hint: "Some systems filter out resumes that do not show the degree the job asks for." },
  file: { label: "File", hint: "The file type and name are the first things a recruiter sees in their inbox." },
  summary: { label: "Summary", hint: "A short summary tells the reader who you are before they decide whether to keep reading." },
  "job-level": { label: "Job level match", hint: "We add up the dates in your work history and compare the total with the years the job asks for." },
  measurable: { label: "Measurable results", hint: "Bullets with numbers show what changed because of your work. Aim for at least five." },
  tone: { label: "Resume tone", hint: "Overused phrases take up space without saying anything about you." },
  "web-presence": { label: "Web presence", hint: "A LinkedIn profile, GitHub or portfolio lets a recruiter see more than fits on a page." },
  "word-count": { label: "Word count", hint: "Too short looks thin, too long does not get read. Most strong resumes land between 300 and 1000 words." },
  verbs: { label: "Action verbs", hint: "Starting many bullets with the same verb makes different work sound the same." },
  spelling: { label: "Spelling", hint: "A quick pass for common typos. It will not catch everything, so read it through once more yourself." },
  layout: { label: "Layout", hint: "Columns, tables and images can scramble the order a scanner reads your text in." },
  fonts: { label: "Font check", hint: "Common fonts at a readable size come through cleanly in every system." },
  "page-setup": { label: "Page setup", hint: "Some scanners skip headers and footers, and odd page sizes or margins can cut text off." },
};
