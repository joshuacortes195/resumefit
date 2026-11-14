import { parseResume, type DegreeLevel } from "@resumefit/scoring";
import { DEGREES, type Profile } from "@/lib/profile";

// how the resume reader names a degree, and what the profile's dropdown calls it
const DEGREE_NAMES: Partial<Record<DegreeLevel, (typeof DEGREES)[number]>> = { "High School": "High school diploma", Associate: "Associate's degree", "Bachelor's": "Bachelor's degree", "Master's": "Master's degree", MBA: "MBA", PhD: "Doctorate" };

// a link the way forms want it, with https in front
const link = (value: string | null | undefined) => (value ? (/^https?:\/\//.test(value) ? value : `https://${value}`) : null);

// starts an empty application profile off with what the person's resume already says, so they check it instead of typing it.
// only empty answers are filled, and nothing about work authorization or self-identification is ever guessed
export function prefillFromResume(profile: Profile, resumeText: string): { profile: Profile; filled: number } {
  const resume = parseResume(resumeText);
  const school = resume.education[0];
  // "Portland, OR" is a city and a state
  const [city, state] = (resume.contact.location ?? "").split(",").map((part) => part.trim());
  const found: Partial<Profile> = {
    fullName: resume.contact.name,
    email: resume.contact.email,
    phone: resume.contact.phone,
    city: city || null,
    state: state || null,
    linkedinUrl: link(resume.contact.linkedin),
    githubUrl: link(resume.contact.github),
    portfolioUrl: link(resume.contact.links[0]),
    yearsExperience: resume.yearsExperience === null ? null : Math.round(resume.yearsExperience),
    school: school?.school ?? null,
    degree: (school?.level && DEGREE_NAMES[school.level]) || null,
    major: school?.field ?? null,
    graduationYear: school?.graduationYear ? String(school.graduationYear) : null,
  };
  const next = { ...profile };
  let filled = 0;
  for (const [key, value] of Object.entries(found) as [keyof Profile, unknown][]) {
    if (value === null || value === undefined || value === "" || (profile[key] !== null && profile[key] !== "")) continue;
    (next as Record<string, unknown>)[key] = value;
    filled++;
  }
  return { profile: next, filled };
}
