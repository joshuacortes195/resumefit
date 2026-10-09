import type { LayoutMeta, ParsedResume } from "@resumefit/scoring";
import { getTemplate, SECTION_TITLES, type SectionKey } from "@/lib/builder/templates";
import { emptyBuilder, newId, type BuilderData, type TemplateSettings } from "@/lib/builder/types";

// one block of a laid out resume, the preview, the pdf and the word file are all drawn from these
export type Block =
  | { kind: "entry"; title: string; right: string; subtitle: string; bullets: string[] }
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "skills"; items: string[] };

export type LaidOutSection = { key: SectionKey; title: string; blocks: Block[] };

// the resume ready to draw: name, contact line and sections in the template's order
export type LaidOut = { name: string; headline: string; contact: string[]; sections: LaidOutSection[] };

// joins the parts that are filled in
const joined = (parts: (string | undefined)[], separator: string) => parts.map((part) => part?.trim()).filter(Boolean).join(separator);

// "Jan 2022 - Present" from the start and end fields
function dates(start: string, end: string, current: boolean): string {
  const finish = current ? "Present" : end.trim();
  return joined([start, finish], " - ");
}

// turns the builder's answers into blocks, skipping anything left empty
export function layOut(data: BuilderData, templateId: string): LaidOut {
  const { profile, additional } = data;
  const clean = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

  const blocks: Record<SectionKey, Block[]> = {
    summary: data.summary.trim() ? [{ kind: "text", text: data.summary.trim() }] : [],
    experience: data.experience
      .filter((job) => job.title.trim() || job.company.trim())
      .map((job) => ({ kind: "entry", title: joined([job.title, job.company], ", "), right: dates(job.start, job.end, job.current), subtitle: job.location.trim(), bullets: clean(job.bullets) })),
    skills: clean(data.skills).length > 0 ? [{ kind: "skills", items: clean(data.skills) }] : [],
    education: data.education
      .filter((school) => school.school.trim() || school.degree.trim())
      .map((school) => ({ kind: "entry", title: joined([joined([school.degree, school.field], " in "), school.school], ", "), right: school.year.trim(), subtitle: school.location.trim(), bullets: [] })),
    projects: additional.projects
      .filter((project) => project.name.trim())
      .map((project) => ({ kind: "entry", title: project.name.trim(), right: "", subtitle: "", bullets: clean(project.description.split("\n")) })),
    certifications: clean(additional.certifications).length > 0 ? [{ kind: "list", items: clean(additional.certifications) }] : [],
    awards: clean(additional.awards).length > 0 ? [{ kind: "list", items: clean(additional.awards) }] : [],
    volunteer: clean(additional.volunteer).length > 0 ? [{ kind: "list", items: clean(additional.volunteer) }] : [],
    languages: clean(additional.languages).length > 0 ? [{ kind: "text", text: clean(additional.languages).join(", ") }] : [],
  };

  return {
    name: profile.name.trim(),
    headline: profile.title.trim(),
    contact: clean([profile.location, profile.email, profile.phone, profile.linkedin, profile.website, ...profile.links]),
    sections: getTemplate(templateId)
      .order.filter((key) => blocks[key].length > 0)
      .map((key) => ({ key, title: SECTION_TITLES[key], blocks: blocks[key] })),
  };
}

// the resume as plain text, the way a scanner would read it. this is what gets scored and saved
export function builderToText(data: BuilderData, templateId: string): string {
  const laid = layOut(data, templateId);
  const lines: string[] = [laid.name];
  if (laid.headline) lines.push(laid.headline);
  if (laid.contact.length > 0) lines.push(laid.contact.join(" | "));
  for (const section of laid.sections) {
    lines.push("", section.title);
    for (const block of section.blocks) {
      if (block.kind === "text") lines.push(block.text);
      else if (block.kind === "skills") lines.push(block.items.join(", "));
      else if (block.kind === "list") lines.push(...block.items.map((item) => `• ${item}`));
      else {
        lines.push(block.title);
        if (block.right || block.subtitle) lines.push(joined([block.right, block.subtitle], " | "));
        lines.push(...block.bullets.map((bullet) => `• ${bullet}`));
      }
    }
  }
  return lines.join("\n").trim();
}

// the layout facts of a built resume, so it can go through the same formatting checks as an uploaded file
export function builderLayoutMeta(data: BuilderData, settings: TemplateSettings, pageCount: number | null = null): LayoutMeta {
  const template = getTemplate(settings.template);
  const name = data.profile.name.trim().replace(/\s+/g, "-");
  return {
    fileType: "pdf",
    fileName: name ? `${name}-Resume.pdf` : null,
    pageCount,
    pageSize: "Letter",
    margins: { top: settings.margins, right: settings.margins, bottom: settings.margins, left: settings.margins },
    columns: 1,
    hasTables: false,
    imageCount: 0,
    headerText: "",
    footerText: "",
    fonts: [{ name: template.font === "serif" ? "Times New Roman" : "Helvetica", share: 1 }],
    bodyFontSize: 10.5,
    minFontSize: 10.5,
    maxFontSize: 20,
    boldShare: 0.12,
    lightTextShare: 0,
    offLeftShare: template.header === "center" ? 0.08 : 0,
  };
}

// "Jan 2022" from a parsed date
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateText = (date: { year: number; month: number | null; present: boolean }) => (date.present ? "" : joined([date.month ? MONTHS[date.month - 1] : undefined, String(date.year)], " "));

// fills the builder from a resume we already read, for "upload my resume" and the linkedin import
export function builderFromParsed(parsed: ParsedResume): BuilderData {
  const data = emptyBuilder();
  const linesOf = (kind: string) => parsed.sections.filter((section) => section.kind === kind).flatMap((section) => section.lines);
  const strip = (text: string) => text.replace(/^[•\-*▪◦●]\s*/, "").trim();

  data.profile = {
    ...data.profile,
    name: parsed.contact.name ?? "",
    email: parsed.contact.email ?? "",
    phone: parsed.contact.phone ?? "",
    location: parsed.contact.location ?? "",
    linkedin: parsed.contact.linkedin ?? "",
    website: parsed.contact.links[0] ?? parsed.contact.github ?? "",
    title: parsed.experience[0]?.title ?? "",
    years: parsed.yearsExperience === null ? "" : String(Math.round(parsed.yearsExperience)),
  };
  data.summary = linesOf("summary").join(" ");
  data.experience = parsed.experience.map((job) => ({
    id: newId(),
    title: job.title ?? "",
    company: job.company ?? "",
    location: job.location ?? "",
    start: job.dates ? dateText(job.dates.start) : "",
    end: job.dates ? dateText(job.dates.end) : "",
    current: job.dates?.end.present ?? false,
    bullets: job.bullets,
  }));
  data.education = parsed.education.map((school) => ({
    id: newId(),
    degree: school.level ?? "",
    field: school.field ?? "",
    school: school.school ?? "",
    location: "",
    year: school.graduationYear ? String(school.graduationYear) : "",
  }));
  // skills are usually comma or bullet separated
  data.skills = [
    ...new Set(
      linesOf("skills")
        .flatMap((text) => strip(text).replace(/^[A-Za-z &/]+:\s*/, "").split(/[,;|•·]/))
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 1 && skill.length <= 40),
    ),
  ].slice(0, 60);
  data.additional.certifications = linesOf("certifications").map(strip).filter(Boolean).slice(0, 20);
  data.additional.awards = linesOf("awards").map(strip).filter(Boolean).slice(0, 20);
  data.additional.volunteer = linesOf("volunteer").map(strip).filter(Boolean).slice(0, 20);
  data.additional.languages = linesOf("languages")
    .flatMap((text) => strip(text).split(/[,;|•·]/))
    .map((language) => language.trim())
    .filter(Boolean)
    .slice(0, 15);
  return data;
}
