import type { FieldKey } from "../types";

// what we know about one applicant tracking system's forms
export type Adapter = {
  id: string;
  name: string;
  // the web addresses its application pages live on
  hosts: RegExp;
  // fields we can point at directly, checked before the general label matching
  hints: { selector: string; key: FieldKey }[];
  // set when the form is spread over several pages and has to be filled a page at a time
  multiPage?: boolean;
};

export const greenhouse: Adapter = {
  id: "greenhouse",
  name: "Greenhouse",
  hosts: /(^|\.)greenhouse\.io$/,
  hints: [
    { selector: "#first_name", key: "firstName" },
    { selector: "#last_name", key: "lastName" },
    { selector: "#email", key: "email" },
    { selector: "#phone", key: "phone" },
    { selector: "#candidate-location, #job_application_location", key: "location" },
    { selector: 'input[type="file"]#resume, [data-field="resume"] input[type="file"], #resume_fieldset input[type="file"]', key: "resume" },
    { selector: 'input[type="file"]#cover_letter, [data-field="cover_letter"] input[type="file"]', key: "coverLetter" },
    { selector: "#job_application_gender, #gender", key: "eeoGender" },
    { selector: "#hispanic_ethnicity", key: "eeoHispanic" },
    { selector: "#job_application_race, #race", key: "eeoRace" },
    { selector: "#job_application_veteran_status, #veteran_status", key: "eeoVeteran" },
    { selector: "#job_application_disability_status, #disability_status", key: "eeoDisability" },
  ],
};

export const lever: Adapter = {
  id: "lever",
  name: "Lever",
  hosts: /(^|\.)lever\.co$/,
  hints: [
    { selector: 'input[name="name"]', key: "fullName" },
    { selector: 'input[name="email"]', key: "email" },
    { selector: 'input[name="phone"]', key: "phone" },
    { selector: 'input[name="location"]', key: "location" },
    { selector: 'input[name="org"]', key: "currentCompany" },
    { selector: 'input[name="urls[LinkedIn]"]', key: "linkedin" },
    { selector: 'input[name="urls[GitHub]"]', key: "github" },
    { selector: 'input[name="urls[Portfolio]"], input[name="urls[Other]"]', key: "website" },
    { selector: 'input[type="file"][name="resume"]', key: "resume" },
    { selector: 'select[name="eeo[gender]"]', key: "eeoGender" },
    { selector: 'select[name="eeo[race]"]', key: "eeoRace" },
    { selector: 'select[name="eeo[veteran]"]', key: "eeoVeteran" },
    { selector: 'select[name="eeo[disability]"]', key: "eeoDisability" },
  ],
};

export const ashby: Adapter = {
  id: "ashby",
  name: "Ashby",
  hosts: /(^|\.)ashbyhq\.com$/,
  hints: [
    { selector: 'input[name="_systemfield_name"]', key: "fullName" },
    { selector: 'input[name="_systemfield_email"]', key: "email" },
    { selector: 'input[name="_systemfield_phone"], input[type="tel"]', key: "phone" },
    { selector: 'input[name="_systemfield_location"]', key: "location" },
    { selector: 'input[type="file"]#_systemfield_resume, input[type="file"][name="_systemfield_resume"]', key: "resume" },
  ],
};

export const workable: Adapter = {
  id: "workable",
  name: "Workable",
  hosts: /(^|\.)workable\.com$/,
  hints: [
    { selector: 'input[name="firstname"]', key: "firstName" },
    { selector: 'input[name="lastname"]', key: "lastName" },
    { selector: 'input[name="email"]', key: "email" },
    { selector: 'input[name="phone"]', key: "phone" },
    { selector: 'input[name="address"]', key: "location" },
    { selector: 'input[type="file"][data-ui="resume"], [data-ui="resume"] input[type="file"]', key: "resume" },
  ],
};

export const workday: Adapter = {
  id: "workday",
  name: "Workday",
  hosts: /(^|\.)myworkdayjobs\.com$|(^|\.)workday\.com$/,
  multiPage: true,
  hints: [
    { selector: '[data-automation-id="legalNameSection_firstName"], [data-automation-id="firstName"]', key: "firstName" },
    { selector: '[data-automation-id="legalNameSection_lastName"], [data-automation-id="lastName"]', key: "lastName" },
    { selector: '[data-automation-id="email"]', key: "email" },
    { selector: '[data-automation-id="phone-number"], [data-automation-id="phoneNumber"]', key: "phone" },
    { selector: '[data-automation-id="addressSection_city"]', key: "city" },
    { selector: '[data-automation-id="addressSection_postalCode"]', key: "zip" },
    { selector: '[data-automation-id="addressSection_countryRegion"]', key: "state" },
    { selector: '[data-automation-id="countryDropdown"]', key: "country" },
    { selector: '[data-automation-id="file-upload-input-ref"]', key: "resume" },
    { selector: '[data-automation-id="sourceDropdown"], [data-automation-id="sourcePrompt"]', key: "howHeard" },
    { selector: '[data-automation-id="linkedinQuestion"]', key: "linkedin" },
  ],
};

export const smartrecruiters: Adapter = {
  id: "smartrecruiters",
  name: "SmartRecruiters",
  hosts: /(^|\.)smartrecruiters\.com$/,
  hints: [
    { selector: "#first-name-input, input[name='firstName']", key: "firstName" },
    { selector: "#last-name-input, input[name='lastName']", key: "lastName" },
    { selector: "#email-input, input[name='email']", key: "email" },
    { selector: "#linkedin-input", key: "linkedin" },
  ],
};

// these are filled by the general label matching, which is as good as we can promise for them
export const icims: Adapter = { id: "icims", name: "iCIMS", hosts: /(^|\.)icims\.com$/, hints: [] };
export const jobvite: Adapter = { id: "jobvite", name: "Jobvite", hosts: /(^|\.)jobvite\.com$/, hints: [] };
export const bamboohr: Adapter = { id: "bamboohr", name: "BambooHR", hosts: /(^|\.)bamboohr\.com$/, hints: [] };
export const taleo: Adapter = { id: "taleo", name: "Taleo", hosts: /(^|\.)taleo\.net$|(^|\.)oraclecloud\.com$/, hints: [], multiPage: true };

// any other site, matched by labels alone
export const generic: Adapter = { id: "generic", name: "This site", hosts: /.*/, hints: [] };

export const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, workable, workday, smartrecruiters, icims, jobvite, bamboohr, taleo];

// picks the adapter for a page from its address, falling back to the general one
export function adapterFor(hostname: string): Adapter {
  return ADAPTERS.find((adapter) => adapter.hosts.test(hostname)) ?? generic;
}

// the job sites we ask to fill in without being opened by hand, asked for once when the extension is connected
export const HANDS_FREE_ORIGINS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "myworkdayjobs.com", "smartrecruiters.com", "icims.com", "jobvite.com", "bamboohr.com", "taleo.net"].map((host) => `https://*.${host}/*`);
