import { parseResume, type DegreeLevel } from "@resumefit/scoring";
import { DEGREES, type Profile } from "@/lib/profile";

// how the resume reader names a degree, and what the profile's dropdown calls it
const DEGREE_NAMES: Partial<Record<DegreeLevel, (typeof DEGREES)[number]>> = { "High School": "High school diploma", Associate: "Associate's degree", "Bachelor's": "Bachelor's degree", "Master's": "Master's degree", MBA: "MBA", PhD: "Doctorate" };

// the states by their short names
const US_STATES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia" };

// a link the way forms want it, with https in front
const link = (value: string | null | undefined) => (value ? (/^https?:\/\//.test(value) ? value : `https://${value}`) : null);

// starts an empty application profile off with what the person's resume already says, so they check it instead of typing it.
// only empty answers are filled, and nothing about work authorization or self-identification is ever guessed
export function prefillFromResume(profile: Profile, resumeText: string): { profile: Profile; filled: number } {
  const resume = parseResume(resumeText);
  const school = resume.education[0];
  // "Portland, OR" is a city and a state
  const [city, shortState] = (resume.contact.location ?? "").split(",").map((part) => part.trim());
  // forms list states by their full names, and "CA" could be taken for part of another word
  const fullState = shortState ? US_STATES[shortState.toUpperCase()] : undefined;
  const state = fullState ?? shortState;
  const found: Partial<Profile> = {
    fullName: resume.contact.name,
    email: resume.contact.email,
    phone: resume.contact.phone,
    city: city || null,
    state: state || null,
    // someone in a US state is in the United States
    country: fullState || Object.values(US_STATES).includes(state ?? "") ? "United States" : null,
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
