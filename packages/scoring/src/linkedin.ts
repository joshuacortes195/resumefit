import type { SkillMatch } from "@resumefit/shared";
import { analyzeJd, stripIgnoredSections } from "./jd";
import { countSkills, matchSkills, type SkillTerm } from "./match";
import { detectSections, isBullet, isMeasurable, wordCount } from "./parse";

// the parts of a linkedin profile we look at
export type LinkedinProfile = {
  headline: string;
  about: string;
  experience: string;
  // one skill per entry
  skills: string[];
  // the address of the profile, when we know it
  url?: string;
};

// a tip with whether the profile already follows it
export type LinkedinTip = { id: string; passed: boolean; message: string };

export type LinkedinSectionKey = "headline" | "about" | "experience" | "skills";

// everything the linkedin report shows
export type LinkedinReport = {
  score: number;
  sections: Record<LinkedinSectionKey, { score: number; tips: LinkedinTip[] }>;
  // keywords from the target jobs, with how often the profile uses each
  keywords: SkillMatch[];
  jobTitles: string[];
};

// limits and targets, in one place so they are easy to tweak
export const LINKEDIN_CONFIG = {
  weights: { headline: 0.2, about: 0.25, experience: 0.3, skills: 0.25 },
  headlineMax: 220,
  headlineMin: 40,
  aboutMinWords: 200,
  skillsTarget: 15,
  experienceMinWords: 150,
};

// the share of keywords that show up in a piece of text, weighted the same way for all of them
function coverage(text: string, keywords: SkillMatch[], skills: SkillTerm[]): number {
  if (keywords.length === 0) return 1;
  const names = new Set(keywords.map((keyword) => keyword.name));
  const found = countSkills(text, skills.filter((skill) => names.has(skill.name)));
  return found.size / keywords.length;
}

// share of tips passed, 0 to 1
const share = (tips: LinkedinTip[]) => (tips.length === 0 ? 1 : tips.filter((tip) => tip.passed).length / tips.length);

const tip = (id: string, passed: boolean, pass: string, fail: string): LinkedinTip => ({ id, passed, message: passed ? pass : fail });

// headings linkedin puts in the side column of its pdf export
const SIDE_HEADING = /^(contact|top skills|languages|certifications|honors-awards|honors & awards|publications|patents)$/i;

// reads a linkedin profile out of the text of its pdf export.
// the export has a side column (contact, top skills) that is read first, then the name, the headline and the main sections
export function parseLinkedinText(text: string): LinkedinProfile {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const mainStart = lines.findIndex((line) => /^(summary|experience)$/i.test(line));
  const before = lines.slice(0, mainStart === -1 ? Math.min(lines.length, 20) : mainStart);

  // the headline is the longest line above the summary that is not a contact detail
  const candidates = before.filter((line) => !/@|linkedin\.com|https?:|^\(?\+?\d|^page \d/i.test(line) && !SIDE_HEADING.test(line));
  const headline = candidates.reduce((longest, line) => (line.length > longest.length ? line : longest), "");
  const nameIndex = before.indexOf(headline) - 1;

  // top skills sit under their heading in the side column, and stop at the next heading or at the name
  const skillsStart = before.findIndex((line) => /^top skills$/i.test(line));
  const skills: string[] = [];
  for (let index = skillsStart + 1; skillsStart !== -1 && index < before.length && index < nameIndex; index++) {
    const line = before[index] ?? "";
    if (SIDE_HEADING.test(line)) break;
    skills.push(line);
  }

  // the main sections read like a resume, so the resume reader handles them
  const sections = detectSections(lines.slice(mainStart === -1 ? 0 : mainStart).join("\n"));
  const linesOf = (kind: string) => sections.filter((section) => section.kind === kind).flatMap((section) => section.lines);
  return {
    headline: headline.length > 15 ? headline : "",
    about: linesOf("summary").join(" "),
    experience: linesOf("experience").join("\n"),
    skills: skills.filter((skill) => skill.length > 1 && skill.length <= 50),
    url: text.match(/(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0],
  };
}

// scores a linkedin profile against one to three job descriptions. no network, no ai
export function scoreLinkedin(profile: LinkedinProfile, jobDescriptions: string[], hardSkills: SkillTerm[], softSkills: SkillTerm[]): LinkedinReport {
  const jdText = jobDescriptions.map(stripIgnoredSections).join("\n\n");
  const profileText = [profile.headline, profile.about, profile.experience, profile.skills.join(", ")].join("\n");
  const hard = matchSkills(jdText, profileText, hardSkills, "hard");
  const soft = matchSkills(jdText, profileText, softSkills, "soft");
  const allSkills = [...hardSkills, ...softSkills];
  // the keywords the jobs mention most are the ones a headline should carry
  const top = [...hard].sort((a, b) => b.jdCount - a.jdCount).slice(0, 8);
  const jobTitles = [...new Set(jobDescriptions.map((jd) => analyzeJd(jd).jobTitle).filter((title): title is string => Boolean(title)))];

  const headline = profile.headline.trim();
  const headlineLower = headline.toLowerCase();
  // the main words of a job title, like "data" and "analyst"
  const titleWords = (title: string) => title.toLowerCase().split(/\s+/).filter((word) => word.length > 2 && !["senior", "junior", "lead", "staff", "the", "and"].includes(word));
  const hasTitle = jobTitles.some((title) => titleWords(title).every((word) => headlineLower.includes(word)));
  const headlineKeywords = countSkills(headline, allSkills.filter((skill) => top.some((keyword) => keyword.name === skill.name))).size;

  const headlineTips = [
    tip("headline-length", headline.length >= LINKEDIN_CONFIG.headlineMin && headline.length <= LINKEDIN_CONFIG.headlineMax, `Your headline is ${headline.length} characters, a good length.`, headline.length > LINKEDIN_CONFIG.headlineMax ? `Your headline is ${headline.length} characters. LinkedIn cuts it off at ${LINKEDIN_CONFIG.headlineMax}.` : `Your headline is only ${headline.length} characters. You have up to ${LINKEDIN_CONFIG.headlineMax} to say what you do and what you are good at.`),
    tip("headline-title", jobTitles.length === 0 || hasTitle, "Your headline names the kind of job you are going for.", `Recruiters search by job title. Work "${jobTitles[0] ?? "your target title"}" into your headline.`),
    tip("headline-keywords", top.length === 0 || headlineKeywords >= Math.min(2, top.length), `Your headline uses ${headlineKeywords} of the skills these jobs ask for most.`, `Add two or three of the top skills to your headline: ${top.slice(0, 4).map((keyword) => keyword.name).join(", ")}.`),
  ];

  const aboutWords = wordCount(profile.about);
  const aboutCoverage = coverage(profile.about, hard, allSkills);
  const aboutTips = [
    tip("about-length", aboutWords >= LINKEDIN_CONFIG.aboutMinWords, `Your About section has ${aboutWords} words, enough room to tell your story.`, aboutWords === 0 ? "You have no About section. It is the best place on your profile to say what you do in your own words." : `Your About section has ${aboutWords} words. Aim for at least ${LINKEDIN_CONFIG.aboutMinWords} so there is room for your skills and a result or two.`),
    tip("about-keywords", hard.length === 0 || aboutCoverage >= 0.3, `Your About section covers ${Math.round(aboutCoverage * 100)}% of the hard skills in these jobs.`, `Your About section mentions only ${Math.round(aboutCoverage * 100)}% of the hard skills in these jobs. Work in the ones you really have.`),
    tip("about-results", isMeasurable(profile.about), "Your About section includes a measurable result.", "Add one or two numbers to your About section, like team size, revenue or time saved."),
  ];

  const experienceLines = profile.experience.split("\n").filter(Boolean);
  const experienceWords = wordCount(profile.experience);
  const experienceCoverage = coverage(profile.experience, hard, allSkills);
  const measured = experienceLines.filter((line) => isMeasurable(line.replace(/\b(19|20)\d{2}\b/g, "")) && (isBullet(line) || line.length > 40)).length;
  const experienceTips = [
    tip("experience-length", experienceWords >= LINKEDIN_CONFIG.experienceMinWords, `Your experience has ${experienceWords} words of detail.`, `Your experience has only ${experienceWords} words. A title and dates are not enough, add what you did in each role.`),
    tip("experience-keywords", hard.length === 0 || experienceCoverage >= 0.4, `Your experience covers ${Math.round(experienceCoverage * 100)}% of the hard skills in these jobs.`, `Your experience mentions only ${Math.round(experienceCoverage * 100)}% of the hard skills in these jobs. Describe the work where you used them.`),
    tip("experience-results", measured >= 3, `We found ${measured} lines with measurable results in your experience.`, `We found ${measured} lines with measurable results. Aim for at least three, with numbers, percentages or amounts.`),
  ];

  const listed = profile.skills.join("\n");
  const skillsCoverage = coverage(listed, hard, allSkills);
  const skillsTips = [
    tip("skills-count", profile.skills.length >= LINKEDIN_CONFIG.skillsTarget, `You list ${profile.skills.length} skills.`, `You list ${profile.skills.length} skills. LinkedIn lets you add up to 100, and recruiters filter by them. Aim for at least ${LINKEDIN_CONFIG.skillsTarget}.`),
    tip("skills-match", hard.length === 0 || skillsCoverage >= 0.5, `Your skills list covers ${Math.round(skillsCoverage * 100)}% of the hard skills in these jobs.`, `Your skills list covers only ${Math.round(skillsCoverage * 100)}% of the hard skills in these jobs. Add the missing ones you have.`),
  ];

  // a custom profile address looks tidier than the default one with numbers on the end
  const custom = profile.url ? !/-[0-9a-f]{6,}$|\d{5,}$/i.test(profile.url) : null;
  if (custom !== null) headlineTips.push(tip("custom-url", custom, "You have a custom profile address.", "Your profile address still has the default numbers on the end. Set a custom one under Edit public profile and URL."));

  // each part is half how well it follows the tips and half how much of the keywords it carries
  const sections = {
    headline: { score: Math.round(100 * share(headlineTips)), tips: headlineTips },
    about: { score: Math.round(100 * (0.5 * share(aboutTips) + 0.5 * Math.min(1, aboutCoverage / 0.5))), tips: aboutTips },
    experience: { score: Math.round(100 * (0.5 * share(experienceTips) + 0.5 * Math.min(1, experienceCoverage / 0.7))), tips: experienceTips },
    skills: { score: Math.round(100 * (0.4 * share(skillsTips) + 0.6 * skillsCoverage)), tips: skillsTips },
  };
  const { weights } = LINKEDIN_CONFIG;
  const score = Math.round(sections.headline.score * weights.headline + sections.about.score * weights.about + sections.experience.score * weights.experience + sections.skills.score * weights.skills);

  return { score, sections, keywords: [...hard, ...soft], jobTitles };
}
