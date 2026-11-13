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
  "preferredName",
  "pronouns",
  "address",
  "over18",
  "school",
  "degree",
  "major",
  "graduationYear",
  "graduationDate",
  "gpa",
  "eeoHispanic",
  "eeoGender",
  "eeoRace",
  "eeoVeteran",
  "eeoDisability",
  "resume",
  "coverLetter",
  "question",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

// the application profile as the web app sends it
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
  // the rest of the profile, missing on accounts that have not filled it in
  preferredName?: string | null;
  pronouns?: string | null;
  streetAddress?: string | null;
  over18?: boolean | null;
  howHeard?: string | null;
  noticePeriod?: string | null;
  school?: string | null;
  degree?: string | null;
  major?: string | null;
  graduationMonth?: string | null;
  graduationYear?: string | null;
  gpa?: string | null;
  // true when the person asked for their gpa never to be typed into a form
  gpaNeverFill?: boolean;
  eeoHispanic?: string;
};

// what the web app tells us about the connected person
export type Account = {
  user: { email: string; name: string | null };
  resumes: { id: string; name: string; isBase: boolean; linkedJobId?: string | null }[];
  // everything below is only sent while auto apply is switched on for the app
  autoApply?: boolean;
  profile?: Profile;
  // true once the profile has a name, an email and a phone number
  profileReady?: boolean;
  // title and company of the newest job on the base resume
  current?: { title: string | null; company: string | null };
};

// how a field ended up after a fill, these drive the colors on the page.
// filled: from the profile. review: a draft or a loose match, worth a look. missing: required and we have nothing. skipped: optional and empty
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
  // the choices on offer, for dropdowns and radio buttons
  options?: string[];
  // false for a field that was dealt with on an earlier step and left alone this time
  fresh?: boolean;
};

// a file handed over by the web app, ready to be put into a file input
export type FileData = { name: string; type: string; base64: string };

// a job read off the page the person is looking at
export type PageJob = { title: string; company: string; location: string; description: string; url: string };

// what the side panel can ask the page to do
export type PageRequest =
  | { type: "read-page" }
  | { type: "selection" }
  | { type: "read-linkedin" }
  // fills the form on the page. onlyNew leaves fields that were already dealt with alone, for the next step of a long form
  | { type: "autofill"; values: Partial<Record<FieldKey, string>>; resume: FileData | null; coverLetter: FileData | null; onlyNew?: boolean }
  // one answer set from the side panel. key says what kind of answer it is, when the page did not work that out by itself
  | { type: "set-field"; id: string; value: string; status: FillStatus; key?: FieldKey }
  | { type: "focus-field"; id: string }
  // where the posting's Apply button leads
  | { type: "find-apply" };

// a linkedin profile read off the page the person is on
export type LinkedinImport = { headline: string; about: string; experience: string; skills: string[]; url: string };

// what the page tells the side panel about itself
export type PageInfo = {
  url: string;
  job: PageJob | null;
  // true on a linkedin profile, which can be imported into the linkedin optimizer
  linkedinProfile: boolean;
  // the applicant system the page belongs to, when we know it
  ats: { id: string; name: string } | null;
  // true when the page has a form that looks like a job application
  hasForm: boolean;
  // true when the form is spread over several pages and is filled a page at a time
  multiPage: boolean;
  fields: FieldReport[];
  // true when the page is showing a captcha, which only the person can do
  captcha: boolean;
  // true when the page reads like "thanks, we got your application"
  confirmed: boolean;
  // true on a site whose rules forbid filling its forms with a tool
  fillBlocked: boolean;
};
