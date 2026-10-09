import type { BuilderData } from "@/lib/builder/types";

// the seven steps of the builder, in order
export const STEPS = ["Profile", "Experience", "Core Skills", "Education", "Additional", "Summary", "Finalize"] as const;

// the help shown next to each step
export const GUIDE: { what: string; why: string; tips: string[] }[] = [
  {
    what: "Your name, the job title you are going for, and how to reach you.",
    why: "Scanners copy these into the recruiter's database. A missing phone or email means they cannot contact you, and the job title is the first thing a recruiter searches for.",
    tips: ["Use the job title from the posting you want, if it honestly fits.", "City and state are enough. Leave out your street address.", "Use an email with your name in it."],
  },
  {
    what: "The jobs you have held, newest first, with a few bullets each on what you did.",
    why: "This is where most of your match score comes from. Recruiters read the top two jobs closely and skim the rest.",
    tips: ["Start each bullet with a verb: built, led, cut, grew.", "Put a number in at least five bullets across the resume.", "Three to five bullets for recent jobs, one or two for older ones."],
  },
  {
    what: "The tools, methods and strengths you want to be found for.",
    why: "Recruiters search by skill. A clear skills section makes sure the scanner finds the exact words, even when your bullets phrase things differently.",
    tips: ["Copy the spelling from the job description.", "Lead with the skills the job mentions most.", "Only list what you could talk about in an interview."],
  },
  {
    what: "Your degrees and where you earned them.",
    why: "Some systems filter out resumes that do not show the degree a job requires.",
    tips: ["Write the degree out: Bachelor of Science, not just BS.", "Leave off the year if you would rather not show your age.", "High school only belongs here if it is your highest level."],
  },
  {
    what: "Projects, certifications, awards, volunteering and languages.",
    why: "These fill gaps. They matter most when you are early in your career or changing fields.",
    tips: ["Only add what supports the job you want.", "Give projects a line on what you built and what came of it.", "Skip this step entirely if your experience already fills the page."],
  },
  {
    what: "Two or three sentences at the top that say who you are and what you bring.",
    why: "It is the first thing a person reads, and a good place to fit the exact job title and your top skills.",
    tips: ["Write it last, when the rest is done.", "Name the job title you want.", "Keep it under 60 words."],
  },
  {
    what: "A last check before you download.",
    why: "The checklist runs the same tests our scanner uses on any resume, so you know this one will be read correctly.",
    tips: ["Fix anything marked red, then download.", "Use the file name we suggest.", "Scan it against a real job description next."],
  },
];

// some made up answers, shown in the preview so a template can be judged before anything is typed
export const SAMPLE_DATA: BuilderData = {
  profile: { name: "Jordan Lee", title: "Frontend Engineer", email: "jordan.lee@example.com", phone: "(512) 555-0142", linkedin: "linkedin.com/in/jordanlee", website: "", links: [], location: "Austin, TX", years: "4" },
  summary: "Frontend engineer with four years of experience building fast, accessible web apps with React and TypeScript. Known for clear communication with design and for shipping on schedule.",
  experience: [
    {
      id: "s1",
      title: "Frontend Engineer",
      company: "Acme Corp",
      location: "Austin, TX",
      start: "Jan 2023",
      end: "",
      current: true,
      bullets: ["Cut page load time by 40% by splitting the bundle and lazy loading routes", "Moved 30 screens to TypeScript with zero regressions", "Set up CI/CD that ships 15 releases a week"],
    },
    { id: "s2", title: "Junior Developer", company: "Corner Studio", location: "Remote", start: "Jun 2021", end: "Dec 2022", current: false, bullets: ["Built responsive layouts for 12 client sites", "Fixed bugs and improved page speed on older projects"] },
  ],
  skills: ["TypeScript", "React", "Next.js", "CSS", "Unit testing", "REST APIs", "Git", "Figma", "Web accessibility"],
  education: [{ id: "s3", degree: "Bachelor of Science", field: "Computer Science", school: "State University", location: "Austin, TX", year: "2021" }],
  additional: { projects: [{ id: "s4", name: "Trail Map", description: "Offline maps for hikers, used by 2,000 people" }], certifications: ["AWS Certified Cloud Practitioner"], awards: [], volunteer: [], languages: ["English", "Spanish"] },
};
