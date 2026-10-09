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
  // how section headings are drawn
  heading: "rule" | "caps" | "bar" | "plain";
  // skills as one flowing line or as a few columns of words
  skills: "inline" | "grid";
  order: SectionKey[];
};

const STANDARD: SectionKey[] = ["summary", "experience", "skills", "education", "projects", "certifications", "awards", "volunteer", "languages"];

export const TEMPLATES: Template[] = [
  { id: "classic", name: "Classic", blurb: "The safe choice. Works for any field.", font: "serif", header: "center", heading: "rule", skills: "inline", order: STANDARD },
  { id: "modern", name: "Modern", blurb: "Clean and current, with a touch of color.", font: "sans", header: "left", heading: "bar", skills: "inline", order: STANDARD },
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

// looks a template up, falling back to the first one
export function getTemplate(id: string): Template {
  return TEMPLATES.find((template) => template.id === id) ?? (TEMPLATES[0] as Template);
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
