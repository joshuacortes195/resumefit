import type { Account, FieldKey } from "./types";

// turns the saved profile into the answer for each kind of field. anything we do not know is left out
export function profileValues(account: Account): Partial<Record<FieldKey, string>> {
  const { profile, current } = account;
  const [first = "", ...rest] = (profile.fullName ?? "").trim().split(/\s+/);
  const yesNo = (value: boolean | null) => (value === null ? "" : value ? "Yes" : "No");
  const salary = profile.desiredSalaryMin ?? profile.desiredSalaryMax;
  const hispanic = profile.eeoHispanic ?? "Decline to self-identify";

  const values: Partial<Record<FieldKey, string>> = {
    firstName: first,
    preferredName: profile.preferredName || first,
    pronouns: profile.pronouns ?? "",
    address: profile.streetAddress ?? "",
    over18: yesNo(profile.over18 ?? null),
    howHeard: profile.howHeard ?? "",
    school: profile.school ?? "",
    degree: profile.degree ?? "",
    major: profile.major ?? "",
    graduationYear: profile.graduationYear ?? "",
    gpa: profile.gpa ?? "",
    lastName: rest.join(" "),
    fullName: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    linkedin: profile.linkedinUrl ?? "",
    github: profile.githubUrl ?? "",
    website: profile.portfolioUrl ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    country: profile.country ?? "",
    zip: profile.zip ?? "",
    location: [profile.city, profile.state].filter(Boolean).join(", "),
    currentCompany: current.company ?? "",
    currentTitle: current.title ?? "",
    yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
    salary: salary === null ? "" : String(salary),
    startDate: profile.earliestStartDate ?? profile.noticePeriod ?? "",
    // only a clear yes or no is ever given for these
    workAuthorization: /not authorized/i.test(profile.workAuthorization ?? "") ? "No" : profile.workAuthorization ? "Yes" : "",
    sponsorship: yesNo(profile.needsSponsorship),
    relocation: yesNo(profile.willingToRelocate),
    // demographic answers come straight from what the person chose, which starts on decline
    eeoGender: profile.eeoGender,
    // someone who chose Hispanic or Latino as their race has already answered this one
    eeoHispanic: /decline/i.test(hispanic) && profile.eeoRace === "Hispanic or Latino" ? "Yes" : hispanic,
    eeoRace: profile.eeoRace,
    eeoVeteran: profile.eeoVeteran,
    eeoDisability: profile.eeoDisability,
  };
  // drop the empty ones so "we do not know" and "blank" are the same thing
  for (const key of Object.keys(values) as FieldKey[]) if (!values[key]) delete values[key];
  return values;
}
