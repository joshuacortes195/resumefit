import type { ParsedResume } from "@resumefit/scoring";

// one box on an application form, with what a system would put in it from the resume.
// problem says what looks wrong, so a bad read is caught before a recruiter sees it
export type AtsField = { label: string; value: string | null; problem?: string };
export type AtsGroup = { title: string; fields: AtsField[] };

const field = (label: string, value: string | null | undefined, missing?: string): AtsField => (value ? { label, value } : { label, value: null, ...(missing ? { problem: missing } : {}) });

// lays the parsed resume out the way an applicant system fills its own form: contact, then each job, then each school.
// anything it could not read, or read in a way that looks wrong, is flagged
export function atsView(resume: ParsedResume): { groups: AtsGroup[]; problems: number } {
  const contact = resume.contact;
  const groups: AtsGroup[] = [
    {
      title: "Contact",
      fields: [
        field("Name", contact.name, "No name was read. Put your name on the first line, on its own."),
        field("Email", contact.email, "No email was read. Write it out in the text, not inside an icon or a header."),
        field("Phone", contact.phone, "No phone number was read."),
        field("Location", contact.location, "No city was read. Add a city and state near your name."),
        field("LinkedIn", contact.linkedin),
      ],
    },
  ];

  resume.experience.forEach((job, index) => {
    const title = job.title ?? "";
    // a title that carries the company or a date with it was not split cleanly
    const merged = title.length > 70 || /\b(19|20)\d\d\b/.test(title) || (job.company === null && /\s(at|@)\s/i.test(title));
    groups.push({
      title: `Job ${index + 1}`,
      fields: [
        merged ? { label: "Job title", value: title, problem: "This reads like more than a title. Put the title, the company and the dates on separate lines or split them with commas." } : field("Job title", job.title, "No job title was read for this job."),
        field("Company", job.company, "No company was read for this job."),
        field("Dates", job.dates?.text, "No start and end date was read. Write them like Mar 2022 - Present."),
        { label: "Bullet points", value: String(job.bullets.length), ...(job.bullets.length === 0 ? { problem: "No bullet points were read under this job." } : {}) },
      ],
    });
  });
  if (resume.experience.length === 0) groups.push({ title: "Work experience", fields: [{ label: "Jobs", value: null, problem: "No jobs were read. Use a plain heading like Work Experience above them." }] });

  resume.education.forEach((school, index) => {
    groups.push({
      title: `School ${index + 1}`,
      fields: [field("School", school.school, "No school name was read."), field("Degree", school.level, "No degree level was read. Write it out, like Bachelor of Science."), field("Field of study", school.field), field("Graduation year", school.graduationYear ? String(school.graduationYear) : null)],
    });
  });
  if (resume.education.length === 0) groups.push({ title: "Education", fields: [{ label: "Schools", value: null, problem: "No school was read. Use a plain heading like Education above it." }] });

  return { groups, problems: groups.reduce((count, group) => count + group.fields.filter((entry) => entry.problem).length, 0) };
}
