// what the web app tells us about the connected person
export type Account = {
  user: { email: string; name: string | null };
  resumes: { id: string; name: string; isBase: boolean }[];
};

// a job read off the page the person is looking at
export type PageJob = { title: string; company: string; location: string; description: string; url: string };

// what the side panel can ask the page to do
export type PageRequest = { type: "read-page" } | { type: "selection" } | { type: "read-linkedin" };

// a linkedin profile read off the page the person is on
export type LinkedinImport = { headline: string; about: string; experience: string; skills: string[]; url: string };

// what the page tells the side panel about itself
export type PageInfo = {
  url: string;
  job: PageJob | null;
  // true on a linkedin profile, which can be imported into the linkedin optimizer
  linkedinProfile: boolean;
};
