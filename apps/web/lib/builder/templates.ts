import type { TemplateId } from "@/lib/builder/types";

// the parts of a resume, the order they show in is up to the template
export type SectionKey = "summary" | "experience" | "skills" | "education" | "projects" | "certifications" | "awards" | "volunteer" | "languages";

// what makes one template different from another, all of them are a single column so scanners read them cleanly
export type Template = {
  id: TemplateId;
  name: string;
  // one line about who it suits
  blurb: string;
  font: "sans" | "serif";
  // where the name and contact line sit
  header: "left" | "center";
  // how section headings are drawn. caps-rule is capital letters with a line under them, the latex look
  heading: "rule" | "caps" | "bar" | "plain" | "caps-rule";
  // skills as one flowing line or as a few columns of words
  skills: "inline" | "grid";
  order: SectionKey[];
  // true for the ones people reach for most, shown first where templates are picked
  popular?: boolean;
  // which major or field it was made for, shown on its card
  field?: string;
  // headings this template words its own way. every one is a name scanners already know
  titles?: Partial<Record<SectionKey, string>>;
};

const STANDARD: SectionKey[] = ["summary", "experience", "skills", "education", "projects", "certifications", "awards", "volunteer", "languages"];

export const TEMPLATES: Template[] = [
  // the latex one page resume computer science students pass around: centered name, capital headings with a line under them,
  // education, experience and projects, then technical skills at the bottom
  {
    id: "jakes",
    name: "Jake's Resume",
    field: "Computer science",
    blurb: "The one page LaTeX layout CS students share most. Education, experience, projects, then technical skills.",
    font: "serif",
    header: "center",
    heading: "caps-rule",
    skills: "inline",
    order: ["summary", "education", "experience", "projects", "skills", "certifications", "awards", "volunteer", "languages"],
    titles: { skills: "Technical Skills" },
    popular: true,
  },
  // the dense banking and consulting format: school first, then experience, leadership and a short skills line
  {
    id: "finance",
    name: "Finance and business",
    field: "Business, finance, consulting",
    blurb: "The dense banking style. School first, then experience, leadership and skills.",
    font: "serif",
    header: "center",
    heading: "caps-rule",
    skills: "inline",
    order: ["summary", "education", "experience", "volunteer", "skills", "awards", "certifications", "languages", "projects"],
    titles: { experience: "Professional Experience", volunteer: "Leadership Experience" },
  },
  // nursing and health: licenses come first since they are the first thing checked, then school and clinical work
  {
    id: "nursing",
    name: "Nursing and health",
    field: "Nursing, health sciences",
    blurb: "Licenses up top, then education, clinical experience and skills.",
    font: "sans",
    header: "center",
    heading: "rule",
    skills: "grid",
    order: ["summary", "certifications", "education", "experience", "skills", "volunteer", "awards", "languages", "projects"],
    titles: { certifications: "Licenses and Certifications" },
  },
  // mechanical, electrical and civil: school, a grid of technical skills, then design projects ahead of jobs
  {
    id: "engineering",
    name: "Engineering",
    field: "Mechanical, electrical, civil",
    blurb: "Education, a grid of technical skills and design projects before work history.",
    font: "sans",
    header: "left",
    heading: "caps-rule",
    skills: "grid",
    order: ["summary", "education", "skills", "projects", "experience", "certifications", "awards", "volunteer", "languages"],
    titles: { skills: "Technical Skills" },
  },
  // marketing and communications: a summary and results driven experience lead, with campaigns as projects
  {
    id: "marketing",
    name: "Marketing and comms",
    field: "Marketing, communications, design",
    blurb: "Summary and experience lead, with campaigns and portfolio work as projects.",
    font: "sans",
    header: "left",
    heading: "bar",
    skills: "inline",
    order: ["summary", "experience", "projects", "skills", "education", "certifications", "awards", "volunteer", "languages"],
    titles: { experience: "Professional Experience", projects: "Selected Projects" },
  },
  // teaching: credentials and school first, then classroom experience and service
  {
    id: "teaching",
    name: "Teaching",
    field: "Education, teaching",
    blurb: "Credentials and education first, then classroom experience and service.",
    font: "serif",
    header: "left",
    heading: "rule",
    skills: "inline",
    order: ["summary", "certifications", "education", "experience", "volunteer", "skills", "awards", "projects", "languages"],
    titles: { certifications: "Licenses and Certifications" },
  },
  // the one page layout most software engineering resumes are built on: name centered, ruled headings, school and projects before skills
  {
    id: "tech-one-page",
    name: "Tech one page",
    blurb: "The one page layout most software and engineering resumes use.",
    font: "serif",
    header: "center",
    heading: "rule",
    skills: "inline",
    order: ["summary", "education", "experience", "projects", "skills", "certifications", "awards", "volunteer", "languages"],
    popular: true,
  },
  { id: "classic", name: "Classic", blurb: "The safe choice. Works for any field.", font: "serif", header: "center", heading: "rule", skills: "inline", order: STANDARD, popular: true },
  { id: "modern", name: "Modern", blurb: "Clean and current, with a touch of color.", font: "sans", header: "left", heading: "bar", skills: "inline", order: STANDARD, popular: true },
  // the layout university career offices hand out: school first, capital letter headings, activities ahead of skills
  {
    id: "ivy",
    name: "Ivy",
    blurb: "The format university career offices teach. School first, then experience and activities.",
    font: "serif",
    header: "center",
    heading: "caps",
    skills: "inline",
    order: ["summary", "education", "experience", "volunteer", "projects", "skills", "awards", "certifications", "languages"],
    popular: true,
  },
  {
    id: "student",
    name: "Student",
    blurb: "Education and projects first, for a first job or internship.",
    font: "sans",
    header: "center",
    heading: "rule",
    skills: "inline",
    order: ["summary", "education", "projects", "experience", "skills", "awards", "volunteer", "certifications", "languages"],
  },
  { id: "minimal", name: "Minimal", blurb: "As little decoration as possible.", font: "sans", header: "left", heading: "plain", skills: "inline", order: STANDARD },
  { id: "timeless", name: "Timeless", blurb: "Traditional, for law, finance and government.", font: "serif", header: "left", heading: "caps", skills: "inline", order: STANDARD },
  {
    id: "technical",
    name: "Technical",
    blurb: "Skills up top, for engineering and data roles.",
    font: "sans",
    header: "left",
    heading: "caps",
    skills: "grid",
    order: ["summary", "skills", "experience", "projects", "education", "certifications", "awards", "volunteer", "languages"],
  },
  {
    id: "academic",
    name: "Academic",
    blurb: "Education, awards and projects lead, for research and teaching.",
    font: "serif",
    header: "center",
    heading: "caps",
    skills: "inline",
    order: ["summary", "education", "experience", "projects", "awards", "certifications", "skills", "volunteer", "languages"],
  },
  {
    id: "career-change",
    name: "Career change",
    blurb: "Summary and skills first, so what carries over is seen before job titles.",
    font: "sans",
    header: "center",
    heading: "bar",
    skills: "grid",
    order: ["summary", "skills", "projects", "experience", "education", "certifications", "volunteer", "awards", "languages"],
  },
];

// looks a template up, falling back to the classic one
export function getTemplate(id: string): Template {
  return TEMPLATES.find((template) => template.id === id) ?? (TEMPLATES.find((template) => template.id === "classic") as Template);
}

// the heading printed above each section
export const SECTION_TITLES: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Work Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  volunteer: "Volunteer Experience",
  languages: "Languages",
};
