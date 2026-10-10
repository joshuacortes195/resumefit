import { z } from "zod";

// the answers demographic questions can be given, we never guess these
export const DECLINE = "Decline to self-identify";
export const EEO_OPTIONS = {
  eeoGender: [DECLINE, "Male", "Female", "Non-binary"],
  eeoHispanic: [DECLINE, "Yes", "No"],
  eeoRace: [DECLINE, "American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races"],
  eeoVeteran: [DECLINE, "I am not a protected veteran", "I identify as one or more of the classifications of a protected veteran"],
  eeoDisability: [DECLINE, "Yes, I have a disability, or have had one in the past", "No, I do not have a disability and have not had one in the past"],
} as const;

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"] as const;
export const REMOTE_PREFERENCES = ["No preference", "Remote", "Hybrid", "On-site"] as const;
export const PRONOUNS = ["", "He/him", "She/her", "They/them"] as const;
export const DEGREES = ["", "High school diploma", "Associate's degree", "Bachelor's degree", "Master's degree", "MBA", "Doctorate", "Other"] as const;
export const WORK_AUTHORIZATIONS = ["", "Authorized to work in the US", "US citizen", "Permanent resident", "Work visa", "Not authorized"] as const;

// short optional text, empty becomes null
const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
// yes, no or not answered
const yesNo = z.enum(["", "yes", "no"]).transform((value) => (value === "" ? null : value === "yes"));
// a whole number or nothing
const amount = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{1,9}$/.test(value.replace(/[$,]/g, "")), "Use a plain number, like 85000.")
  .transform((value) => (value === "" ? null : Number(value.replace(/[$,]/g, ""))));

// one saved answer to a question applications tend to ask
export const qaSchema = z.object({ question: z.string().trim().min(3).max(300), answer: z.string().trim().min(1).max(3000) });
export type QaEntry = z.infer<typeof qaSchema>;

// everything on the profile and preferences form
export const profileSchema = z.object({
  fullName: text(),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || z.email().safeParse(value).success, "That email does not look right.")
    .transform((value) => value || null),
  phone: text(40),
  city: text(100),
  state: text(100),
  country: text(100),
  zip: text(20),
  linkedinUrl: text(300),
  githubUrl: text(300),
  portfolioUrl: text(300),
  otherLinks: z.array(z.string().trim().max(300)).max(5).transform((links) => links.filter(Boolean)),
  yearsExperience: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,2}(\.\d)?$/.test(value) && Number(value) <= 60), "Use a number of years, like 4.")
    .transform((value) => (value === "" ? null : Number(value))),
  workAuthorization: text(100),
  needsSponsorship: yesNo,
  willingToRelocate: yesNo,
  desiredSalaryMin: amount,
  desiredSalaryMax: amount,
  earliestStartDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Pick a date from the calendar.")
    .transform((value) => value || null),
  jobTypes: z.array(z.enum(JOB_TYPES)).max(JOB_TYPES.length),
  preferredIndustries: z.array(z.string().trim().max(60)).max(15).transform((items) => items.filter(Boolean)),
  remotePreference: text(40),
  eeoGender: z.enum(EEO_OPTIONS.eeoGender),
  eeoRace: z.enum(EEO_OPTIONS.eeoRace),
  eeoVeteran: z.enum(EEO_OPTIONS.eeoVeteran),
  eeoDisability: z.enum(EEO_OPTIONS.eeoDisability),
  qaBank: z.array(qaSchema).max(100),
  // the rest of the one application: things forms ask that are not in the first set above
  preferredName: text(100),
  pronouns: text(40),
  streetAddress: text(200),
  over18: yesNo,
  howHeard: text(100),
  noticePeriod: text(60),
  school: text(200),
  degree: text(100),
  major: text(100),
  graduationYear: z
    .string()
    .trim()
    .refine((value) => value === "" || /^(19|20)\d{2}$/.test(value), "Use a four digit year, like 2024.")
    .transform((value) => value || null),
  gpa: text(10),
  eeoHispanic: z.enum(EEO_OPTIONS.eeoHispanic),
});

// the newer answers, kept together in one saved bundle next to the profile
export const EXTRA_KEYS = ["preferredName", "pronouns", "streetAddress", "over18", "howHeard", "noticePeriod", "school", "degree", "major", "graduationYear", "gpa", "eeoHispanic"] as const;
export type ProfileExtras = Pick<Profile, (typeof EXTRA_KEYS)[number]>;

// the parts of the one application and whether each has been filled in, for the checklist on Auto Apply
export function applicationParts(profile: Profile, answered: boolean): { label: string; done: boolean }[] {
  return [
    { label: "Contact", done: Boolean(profile.fullName && profile.email && profile.phone && profile.city) },
    { label: "Links", done: Boolean(profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl) },
    { label: "Work details", done: Boolean(profile.workAuthorization) && profile.needsSponsorship !== null },
    { label: "Education", done: Boolean(profile.school && profile.degree) },
    // declining is an answer too, so this counts once the form has been saved with these on it
    { label: "Self-identification", done: answered },
  ];
}
export type ProfileInput = z.input<typeof profileSchema>;
export type Profile = z.output<typeof profileSchema>;
