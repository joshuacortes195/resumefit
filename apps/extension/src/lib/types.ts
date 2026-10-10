// the kinds of answer a form field can be asking for
export const FIELD_KEYS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "linkedin",
  "github",
  "website",
  "location",
  "city",
  "state",
  "country",
  "zip",
  "currentCompany",
  "currentTitle",
  "yearsExperience",
  "salary",
  "startDate",
  "workAuthorization",
  "sponsorship",
  "relocation",
  "howHeard",
  "eeoGender",
  "eeoRace",
  "eeoVeteran",
  "eeoDisability",
  "resume",
  "coverLetter",
  "question",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

// the profile as the web app sends it
export type Profile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  workAuthorization: string | null;
  needsSponsorship: boolean | null;
  willingToRelocate: boolean | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  earliestStartDate: string | null;
  eeoGender: string;
  eeoRace: string;
  eeoVeteran: string;
  eeoDisability: string;
};

// what the web app tells us about the connected person
export type Account = {
  user: { email: string; name: string | null };
  profile: Profile;
  profileReady: boolean;
  // true when the person switched on "Submit for me" in the web app
  autoSubmit?: boolean;
  // title and company of the newest job on the base resume
  current: { title: string | null; company: string | null };
  resumes: { id: string; name: string; isBase: boolean; linkedJobId: string | null }[];
};

// how a field ended up after autofill, these drive the colors on the page
// filled: from the profile. review: drafted or a best guess. missing: required and we have nothing. skipped: optional and empty.
export type FillStatus = "filled" | "review" | "missing" | "skipped";

// one field on the form, as the side panel lists it
export type FieldReport = {
  // matches the data attribute we put on the element, so the panel can point at it
  id: string;
  key: FieldKey | null;
  label: string;
  kind: "text" | "textarea" | "select" | "radio" | "checkbox" | "file";
  required: boolean;
  status: FillStatus;
  value: string;
};

// a job read off the page the person is looking at
export type PageJob = { title: string; company: string; location: string; description: string; url: string };

// what the side panel can ask the page to do
export type PageRequest =
  | { type: "read-page" }
  | { type: "autofill"; values: Partial<Record<FieldKey, string>>; resume: { name: string; type: string; base64: string } | null }
  | { type: "set-field"; id: string; value: string; status: FillStatus }
  | { type: "focus-field"; id: string }
  | { type: "selection" }
  | { type: "read-linkedin" }
  | { type: "find-apply" }
  | { type: "show-bar"; bar: BarState }
  // counts down on the page, then presses the site's Submit button. done is what the bar goes back to if the person cancels
  | { type: "auto-submit"; seconds: number; done: BarState };

// what the little bar on the page is saying
export type BarState =
  | { state: "working" }
  | { state: "done"; filled: number; needs: number; captcha: boolean; multiPage: boolean }
  | { state: "no-form" }
  | { state: "applied" }
  // counting down to pressing Submit, pressed and waiting for the site, or left for the person with the reason
  | { state: "sending"; seconds: number }
  | { state: "sent" }
  | { state: "held"; message: string }
  | { state: "error"; message: string };

// one application the web app asked us to open and fill, kept per tab
export type Run = {
  jobId: string | null;
  resumeId: string | null;
  // how many times we followed an Apply link to get to the form
  hops: number;
  // opening: waiting for the form. blocked: we may not read this site yet. review: filled, the person is checking it
  stage: "opening" | "blocked" | "filling" | "review" | "applied";
  // the page the form was filled on, and how it went
  url: string;
  filled: number;
  needs: number;
  // true once we have counted down to Submit on this application, so it is only ever tried once
  submitTried?: boolean;
};

// messages the page and the side panel send to the background worker
export type WorkerRequest = { type: "rf-refill" } | { type: "rf-confirmed" } | { type: "rf-advance"; tabId: number };

// a linkedin profile read off the page the person is on
export type LinkedinImport = { headline: string; about: string; experience: string; skills: string[]; url: string };

// what the page tells the side panel about itself
export type PageInfo = {
  url: string;
  ats: { id: string; name: string } | null;
  job: PageJob | null;
  // true when the page has a form that looks like a job application
  hasForm: boolean;
  fields: FieldReport[];
  captcha: boolean;
  // true when the page reads like "thanks, we got your application"
  confirmed: boolean;
  // true on a linkedin profile, which can be imported into the linkedin optimizer
  linkedinProfile: boolean;
};
