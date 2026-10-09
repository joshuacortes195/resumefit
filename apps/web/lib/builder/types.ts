import { z } from "zod";

// short text fields, trimmed, never longer than they need to be
const line = (max = 200) => z.string().max(max).default("");

// one job in the builder
export const experienceSchema = z.object({
  id: z.string().max(40),
  title: line(),
  company: line(),
  location: line(),
  // written the way they should show, like "Jan 2022"
  start: line(30),
  end: line(30),
  current: z.boolean().default(false),
  bullets: z.array(z.string().max(600)).max(20).default([]),
});

// one school in the builder
export const educationSchema = z.object({
  id: z.string().max(40),
  degree: line(),
  field: line(),
  school: line(),
  location: line(),
  year: line(30),
});

// a project with a line or two about it
export const projectSchema = z.object({ id: z.string().max(40), name: line(), description: z.string().max(1000).default("") });

// everything the builder collects, step by step
export const builderDataSchema = z.object({
  profile: z
    .object({
      name: line(),
      title: line(),
      email: line(),
      phone: line(40),
      linkedin: line(),
      website: line(),
      links: z.array(z.string().max(200)).max(6).default([]),
      location: line(),
      // not shown on the resume, used to tune suggestions and the page count check
      years: line(10),
    })
    .default({ name: "", title: "", email: "", phone: "", linkedin: "", website: "", links: [], location: "", years: "" }),
  experience: z.array(experienceSchema).max(30).default([]),
  skills: z.array(z.string().max(60)).max(80).default([]),
  education: z.array(educationSchema).max(10).default([]),
  additional: z
    .object({
      projects: z.array(projectSchema).max(15).default([]),
      certifications: z.array(z.string().max(200)).max(20).default([]),
      awards: z.array(z.string().max(200)).max(20).default([]),
      volunteer: z.array(z.string().max(300)).max(20).default([]),
      languages: z.array(z.string().max(60)).max(15).default([]),
    })
    .default({ projects: [], certifications: [], awards: [], volunteer: [], languages: [] }),
  summary: z.string().max(2000).default(""),
});
export type BuilderData = z.infer<typeof builderDataSchema>;
export type BuilderExperience = z.infer<typeof experienceSchema>;
export type BuilderEducation = z.infer<typeof educationSchema>;

export const TEMPLATE_IDS = ["classic", "modern", "student", "minimal", "timeless", "technical", "academic", "career-change"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const ACCENTS = { black: "#111111", navy: "#1f3a6e", "slate-purple": "#4b4370", sage: "#4d6b57" } as const;
export type Accent = keyof typeof ACCENTS;

// how the resume looks: template, spacing, margins and accent color
export const templateSettingsSchema = z.object({
  template: z.enum(TEMPLATE_IDS).default("classic"),
  lineSpacing: z.union([z.literal(1), z.literal(1.15), z.literal(1.5)]).default(1.15),
  // in inches
  margins: z.union([z.literal(0.5), z.literal(0.75), z.literal(1)]).default(0.75),
  accent: z.enum(Object.keys(ACCENTS) as [Accent, ...Accent[]]).default("black"),
});
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// a blank builder and the default look
export const emptyBuilder = (): BuilderData => builderDataSchema.parse({});
export const defaultSettings = (): TemplateSettings => templateSettingsSchema.parse({});

// a short random id for list items
export const newId = (): string => Math.random().toString(36).slice(2, 10);
