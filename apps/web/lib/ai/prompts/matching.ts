export const MATCHING_TASK = "Task: match application questions to saved answers.";

// the answers a person can have saved, and what each one holds. the model only ever picks from these names
export const ANSWER_KEYS: Record<string, string> = {
  firstName: "first or given name",
  lastName: "last name, family name or surname",
  fullName: "full name",
  preferredName: "preferred first name or nickname",
  pronouns: "pronouns",
  email: "email address",
  phone: "phone number",
  address: "street address",
  city: "city they live in",
  state: "state, province or region they live in",
  country: "country they live in",
  zip: "zip or postal code",
  location: "where they live, as city and state",
  linkedin: "LinkedIn profile link",
  github: "GitHub link",
  website: "portfolio or personal website link",
  currentCompany: "current or most recent employer",
  currentTitle: "current or most recent job title",
  yearsExperience: "total years of work experience, as a number",
  salary: "desired salary, as a number",
  startDate: "earliest start date or notice period",
  workAuthorization: "whether they are legally allowed to work in the country, yes or no",
  sponsorship: "whether they need visa sponsorship now or later, yes or no",
  relocation: "whether they are willing to relocate, yes or no",
  over18: "whether they are 18 or older, yes or no",
  howHeard: "how they heard about the job",
  school: "school, college or university attended",
  degree: "degree earned or level of education",
  major: "major or field of study",
  graduationYear: "graduation year",
  gpa: "grade point average",
  eeoGender: "gender",
  eeoHispanic: "whether they are Hispanic or Latino",
  eeoRace: "race or ethnicity",
  eeoVeteran: "veteran status",
  eeoDisability: "disability status",
};

export const MATCHING_SYSTEM = `${MATCHING_TASK}
You are given questions from a job application form and a list of answers a person has saved, by name, with what each one holds.
For each question, say which one saved answer it is asking for. Use null when none clearly fits.

- Only use names from the list. Never write an answer yourself.
- Use null for questions about a specific skill, tool, certificate, clearance, past employer, criminal record, shift, travel, or anything else the list does not hold.
- Use null for agreements and acknowledgements, like "I certify" or "I agree".
- A question may list its choices. They help you understand it, but do not have to match.
- When two names could fit, pick the more specific one.`;

// the questions and the names to pick from. nothing about the person is sent, only the wording of the form
export function matchingPrompt(input: { fields: { id: string; label: string; options?: string[] }[]; keys: string[] }): string {
  const answers = input.keys.map((key) => `${key}: ${ANSWER_KEYS[key]}`).join("\n");
  const questions = input.fields.map((field) => `${field.id} | ${field.label}${field.options?.length ? ` | choices: ${field.options.join("; ")}` : ""}`).join("\n");
  return `Saved answers:\n${answers}\n\nQuestions, one per line as "id | question":\n${questions}`;
}
