// fills the local database with a little demo data, so there is something to look at on a fresh install.
// run it with: pnpm seed
// it only ever touches the local database, never a hosted one

import { isLocalDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { addInterview, createJob, saveCoverLetter, updateJob } from "@/lib/data/jobs";
import { saveProfile } from "@/lib/data/profile";
import { saveResume } from "@/lib/data/resumes";
import { createScan, listScans } from "@/lib/data/scans";
import { DECLINE } from "@/lib/profile";
import { SAMPLE_JD, SAMPLE_RESUME } from "@/lib/sample-scan";

if (!isLocalDb()) {
  console.error("DATABASE_URL is set, so this would write to a hosted database. Unset it to seed the local one.");
  process.exit(1);
}

// a second resume, written for the job below
const TAILORED = `Jordan Lee
Austin, TX | jordan.lee@example.com | (512) 555-0142
linkedin.com/in/jordanlee | github.com/jordanlee

Summary
Frontend Engineer with four years of experience building fast, accessible web apps with TypeScript and React. Clear communication and close collaboration with design and product.

Work Experience
Frontend Engineer, Brightside Labs
Jan 2023 - Present
• Rebuilt the checkout flow in React and TypeScript, cutting drop off by 18%
• Added unit testing with Jest across 40 components
• Set up CI/CD and code review habits for a team of 6
• Improved web accessibility scores from 71 to 96
• Worked with the backend team on REST APIs and GraphQL for the mobile app

Junior Developer, Corner Studio
Jun 2021 - Dec 2022
• Built responsive design layouts with HTML and CSS for 12 client sites
• Cut page load time by 35% through performance optimization

Education
B.S. Computer Science, State University, 2021

Skills
TypeScript, JavaScript, React, Next.js, HTML, CSS, Jest, Git, Figma, GraphQL
`;

const ANALYST_JD = `Data Analyst at Northwind Health

We are hiring a Data Analyst to help our care teams make better decisions.

Requirements
2+ years of experience with SQL and Tableau
Bachelor's degree in a related field
Clear communication with clinical staff

Nice to have
Python
`;

// adds everything, unless there is already something here
async function seed() {
  const user = await getCurrentUser();
  if ((await listScans(user.id)).total > 0) {
    console.log("There is already data here, so nothing was added.");
    return;
  }

  // resumes: a general one as the base, and one tailored to a job
  const base = await saveResume(user.id, { name: "Jordan Lee, general", text: SAMPLE_RESUME });
  const tailored = await saveResume(user.id, { name: "Jordan Lee, frontend", text: TAILORED });

  // tracker jobs in different columns
  const frontend = await createJob(user.id, { title: "Frontend Engineer", company: "Brightside Labs", url: "https://jobs.example.com/brightside/frontend", description: SAMPLE_JD, status: "interview", resumeId: tailored.id });
  const analyst = await createJob(user.id, { title: "Data Analyst", company: "Northwind Health", description: ANALYST_JD, status: "saved" });
  await createJob(user.id, { title: "UI Engineer", company: "Lakeside Labs", status: "applied" });
  await createJob(user.id, { title: "Web Developer", company: "Corner Studio", status: "rejected" });
  await updateJob(user.id, frontend.id, { dateApplied: new Date(Date.now() - 9 * 86_400_000).toISOString().slice(0, 10), notes: "Recruiter is Priya. Team of six, hybrid, two days in the office." });

  // scans: the same job before and after tailoring, plus a poor fit
  await createScan(user.id, { resumeId: base.id, resumeText: SAMPLE_RESUME, layout: null, jdText: SAMPLE_JD, jobId: frontend.id });
  await createScan(user.id, { resumeId: tailored.id, resumeText: TAILORED, layout: null, jdText: SAMPLE_JD, jobId: frontend.id });
  await createScan(user.id, { resumeId: base.id, resumeText: SAMPLE_RESUME, layout: null, jdText: ANALYST_JD, jobId: analyst.id });

  // an interview next week and a cover letter on the frontend job
  const nextWeek = new Date(Date.now() + 6 * 86_400_000);
  nextWeek.setHours(14, 0, 0, 0);
  await addInterview(user.id, frontend.id, { type: "Technical", datetime: nextWeek, interviewerName: "Priya Shah", phone: null, email: null, meetingLink: "https://meet.example.com/brightside", description: "Pairing exercise on a React component, then questions about testing." });
  await saveCoverLetter(user.id, frontend.id, "Dear Hiring Manager,\n\nI rebuilt the checkout flow at my current job in React and TypeScript, which cut drop off by 18%. I would like to bring that same care to Brightside Labs.\n\nSincerely,\nJordan Lee", "Professional");

  // a profile, so autofill has something to work with
  await saveProfile(user.id, {
    preferredName: null,
    pronouns: null,
    streetAddress: null,
    over18: true,
    howHeard: "LinkedIn",
    noticePeriod: "2 weeks",
    school: "State University",
    degree: "Bachelor's degree",
    major: "Computer Science",
    graduationYear: "2021",
    gpa: null,
    eeoHispanic: "Decline to self-identify",
    fullName: "Jordan Lee",
    email: "jordan.lee@example.com",
    phone: "(512) 555-0142",
    city: "Austin",
    state: "Texas",
    country: "United States",
    zip: "78701",
    linkedinUrl: "https://linkedin.com/in/jordanlee",
    githubUrl: "https://github.com/jordanlee",
    portfolioUrl: null,
    otherLinks: [],
    yearsExperience: 4,
    workAuthorization: "US citizen",
    needsSponsorship: false,
    willingToRelocate: null,
    desiredSalaryMin: 95000,
    desiredSalaryMax: 115000,
    earliestStartDate: null,
    jobTypes: ["Full-time"],
    preferredIndustries: ["Software"],
    remotePreference: "Hybrid",
    eeoGender: DECLINE,
    eeoRace: DECLINE,
    eeoVeteran: DECLINE,
    eeoDisability: DECLINE,
    qaBank: [{ question: "Why do you want to work here?", answer: "I like building things people use every day, and your product is one I already rely on." }],
  });

  console.log("Added 2 resumes, 4 tracked jobs, 3 scans, an interview, a cover letter and a profile. Run pnpm dev and open the dashboard.");
}

seed().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
