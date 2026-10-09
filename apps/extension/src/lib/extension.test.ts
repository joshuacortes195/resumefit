// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adapterFor, generic, greenhouse, lever, ashby, workday } from "./adapters";
import { findFields, looksLikeApplication, type FormField } from "./fields";
import { fillForm, pickOption, setNativeValue } from "./fill";
import { hasCaptcha, looksConfirmed, readJob } from "./job-page";
import { matchKey } from "./synonyms";
import type { Account, FieldKey } from "./types";
import { profileValues } from "./values";

// loads one of the saved form pages into the test document
function load(name: string): Document {
  document.documentElement.innerHTML = readFileSync(path.join(import.meta.dirname, "../../test/fixtures", `${name}.html`), "utf8");
  return document;
}

// what each field was matched to, by the name or id the form gives it
function mapping(fields: FormField[]): Record<string, FieldKey | null> {
  return Object.fromEntries(fields.map((field) => [field.elements[0]?.id || field.elements[0]?.getAttribute("name") || field.label, field.key]));
}

const ACCOUNT: Account = {
  user: { email: "jordan.lee@example.com", name: "Jordan Lee" },
  profileReady: true,
  current: { title: "Frontend Engineer", company: "Acme Corp" },
  resumes: [],
  profile: {
    fullName: "Jordan Avery Lee",
    email: "jordan.lee@example.com",
    phone: "(512) 555-0142",
    city: "Austin",
    state: "Texas",
    country: "United States",
    zip: "78701",
    linkedinUrl: "https://linkedin.com/in/jordanlee",
    githubUrl: "https://github.com/jordanlee",
    portfolioUrl: "https://jordanlee.dev",
    yearsExperience: 4,
    workAuthorization: "US citizen",
    needsSponsorship: false,
    willingToRelocate: true,
    desiredSalaryMin: 95000,
    desiredSalaryMax: 115000,
    earliestStartDate: "2026-11-02",
    eeoGender: "Decline to self-identify",
    eeoRace: "Decline to self-identify",
    eeoVeteran: "I am not a protected veteran",
    eeoDisability: "Decline to self-identify",
  },
};
const VALUES = profileValues(ACCOUNT);
const RESUME = { name: "Jordan-Lee-Resume.pdf", type: "application/pdf", base64: btoa("%PDF-1.4 test") };

// the value of a control found by a css selector
const valueOf = (selector: string) => (document.querySelector(selector) as HTMLInputElement | HTMLSelectElement).value;
// the visible text of a select's chosen option
const chosen = (selector: string) => {
  const select = document.querySelector(selector) as HTMLSelectElement;
  return select.options[select.selectedIndex]?.text;
};

describe("picking the adapter", () => {
  it("goes by the address of the page", () => {
    expect(adapterFor("boards.greenhouse.io").id).toBe("greenhouse");
    expect(adapterFor("job-boards.greenhouse.io").id).toBe("greenhouse");
    expect(adapterFor("jobs.lever.co").id).toBe("lever");
    expect(adapterFor("jobs.ashbyhq.com").id).toBe("ashby");
    expect(adapterFor("apply.workable.com").id).toBe("workable");
    expect(adapterFor("acme.wd5.myworkdayjobs.com").id).toBe("workday");
    expect(adapterFor("careers.lakeside.example").id).toBe("generic");
    // a look alike address is not the real thing
    expect(adapterFor("greenhouse.io.evil.example").id).toBe("generic");
  });
});

describe("matching labels", () => {
  it("tells the common questions apart", () => {
    expect(matchKey(["First Name *"])).toBe("firstName");
    expect(matchKey(["Family name"])).toBe("lastName");
    expect(matchKey(["", "contact_email"])).toBe("email");
    expect(matchKey(["Are you legally authorized to work in the United States?"])).toBe("workAuthorization");
    expect(matchKey(["Will you now or in the future require sponsorship for employment visa status?"])).toBe("sponsorship");
    expect(matchKey(["How did you hear about this job?"])).toBe("howHeard");
    expect(matchKey(["Years of experience"])).toBe("yearsExperience");
    expect(matchKey(["How many years of experience do you have with SQL?"])).toBeNull();
    expect(matchKey(["Favorite ice cream"])).toBeNull();
  });
});

describe("greenhouse form", () => {
  it("maps every field", () => {
    const fields = findFields(load("greenhouse"), greenhouse);
    expect(mapping(fields)).toEqual({
      first_name: "firstName",
      last_name: "lastName",
      email: "email",
      phone: "phone",
      resume: "resume",
      cover_letter: "coverLetter",
      q_linkedin: "linkedin",
      q_website: "website",
      q_auth: "workAuthorization",
      q_sponsor: "sponsorship",
      q_why: "question",
      job_application_gender: "eeoGender",
      job_application_race: "eeoRace",
      job_application_veteran_status: "eeoVeteran",
      job_application_disability_status: "eeoDisability",
    });
    expect(looksLikeApplication(fields)).toBe(true);
    expect(fields.find((field) => field.key === "firstName")?.required).toBe(true);
    expect(fields.find((field) => field.key === "phone")?.required).toBe(false);
  });

  it("fills it from the profile, attaches the resume and never submits", () => {
    const doc = load("greenhouse");
    let submitted = false;
    doc.querySelector("form")?.addEventListener("submit", () => (submitted = true));
    doc.querySelector("#submit_app")?.addEventListener("click", () => (submitted = true));

    const report = fillForm(findFields(doc, greenhouse), VALUES, RESUME);
    expect(valueOf("#first_name")).toBe("Jordan");
    expect(valueOf("#last_name")).toBe("Avery Lee");
    expect(valueOf("#email")).toBe("jordan.lee@example.com");
    expect(valueOf("#q_linkedin")).toBe("https://linkedin.com/in/jordanlee");
    expect(chosen("#q_auth")).toBe("Yes");
    expect(chosen("#q_sponsor")).toBe("No");
    expect((doc.querySelector("#resume") as HTMLInputElement).files?.[0]?.name).toBe("Jordan-Lee-Resume.pdf");
    expect(submitted).toBe(false);

    // each field reports how it went
    const status = Object.fromEntries(report.map((field) => [field.key === "question" ? "question" : field.label.replace(/\s*\*$/, ""), field.status]));
    expect(status["First Name"]).toBe("filled");
    expect(status["Cover Letter"]).toBe("skipped");
    // the free text question is required and waits for the person
    expect(status.question).toBe("missing");
  });

  it("answers demographic questions only with what the person chose, decline by default", () => {
    load("greenhouse");
    fillForm(findFields(document, greenhouse), VALUES, null);
    expect(chosen("#job_application_gender")).toBe("Decline To Self Identify");
    expect(chosen("#job_application_race")).toBe("Decline To Self Identify");
    // differently worded ways of declining still count
    expect(chosen("#job_application_disability_status")).toBe("I do not want to answer");
    // this one the person did answer
    expect(chosen("#job_application_veteran_status")).toBe("I am not a protected veteran");
  });

  it("marks required fields red when the profile has no answer", () => {
    load("greenhouse");
    const report = fillForm(findFields(document, greenhouse), { firstName: "Jordan" }, null);
    const byLabel = (start: string) => report.find((field) => field.label.startsWith(start));
    expect(byLabel("Email")?.status).toBe("missing");
    expect(byLabel("Resume")?.status).toBe("missing");
    expect(byLabel("Phone")?.status).toBe("skipped");
    expect(valueOf("#email")).toBe("");
  });
});

describe("lever form", () => {
  it("maps every field and leaves the marketing checkbox alone", () => {
    const fields = findFields(load("lever"), lever);
    expect(mapping(fields)).toEqual({
      "resume-upload-input": "resume",
      name: "fullName",
      email: "email",
      phone: "phone",
      location: "location",
      org: "currentCompany",
      "urls[LinkedIn]": "linkedin",
      "urls[GitHub]": "github",
      "urls[Portfolio]": "website",
      "cards[a][field0]": "relocation",
      // years with one tool is not something the profile knows, so it becomes a question for the person
      "cards[a][field1]": "question",
      comments: "question",
      "eeo[gender]": "eeoGender",
    });
  });

  it("fills text, picks the radio button and never submits", () => {
    const doc = load("lever");
    let submitted = false;
    doc.querySelector("#btn-submit")?.addEventListener("click", () => (submitted = true));
    fillForm(findFields(doc, lever), VALUES, RESUME);
    expect(valueOf('input[name="name"]')).toBe("Jordan Avery Lee");
    expect(valueOf('input[name="location"]')).toBe("Austin, Texas");
    expect(valueOf('input[name="org"]')).toBe("Acme Corp");
    expect(valueOf('input[name="urls[GitHub]"]')).toBe("https://github.com/jordanlee");
    expect((doc.querySelector('input[name="cards[a][field0]"][value="Yes"]') as HTMLInputElement).checked).toBe(true);
    expect(valueOf('input[name="cards[a][field1]"]')).toBe("");
    expect((doc.querySelector('input[name="consent[marketing]"]') as HTMLInputElement).checked).toBe(false);
    expect(submitted).toBe(false);
  });
});

describe("ashby form", () => {
  it("maps system fields and custom questions", () => {
    expect(mapping(findFields(load("ashby"), ashby))).toEqual({
      _systemfield_name: "fullName",
      _systemfield_email: "email",
      phone_field: "phone",
      _systemfield_resume: "resume",
      q1: "linkedin",
      q2: "salary",
      "q3-yes": "sponsorship",
      q4: "question",
    });
  });

  it("answers the sponsorship question from the profile", () => {
    load("ashby");
    fillForm(findFields(document, ashby), VALUES, RESUME);
    expect((document.querySelector("#q3-no") as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector("#q3-yes") as HTMLInputElement).checked).toBe(false);
    expect(valueOf("#q2")).toBe("95000");
  });
});

describe("workday, first page", () => {
  it("maps by automation id and fills only the page that is showing", () => {
    const doc = load("workday");
    let moved = false;
    doc.querySelector("#next")?.addEventListener("click", () => (moved = true));
    const fields = findFields(doc, workday);
    expect(mapping(fields)).toEqual({ src: "howHeard", cty: "country", fn: "firstName", ln: "lastName", ci: "city", pc: "zip", em: "email", ph: "phone" });

    const report = fillForm(fields, VALUES, null);
    expect(valueOf("#fn")).toBe("Jordan");
    expect(valueOf("#pc")).toBe("78701");
    // "United States" in the profile finds "United States of America" in the list
    expect(chosen("#cty")).toBe("United States of America");
    // we have no answer for how they heard, so that is left for the person and marked
    expect(report.find((field) => field.key === "howHeard")?.status).toBe("missing");
    // the person presses next themselves
    expect(moved).toBe(false);
    expect(workday.multiPage).toBe(true);
  });
});

describe("a form on any other site", () => {
  it("matches by label, placeholder, aria label and nearby text", () => {
    const fields = findFields(load("generic"), generic);
    expect(mapping(fields)).toEqual({ applicant: "fullName", contact_email: "email", f_3: "phone", f_4: "zip", st: "state", start: "startDate", pay: "salary", cv: "resume", f_9: "eeoDisability" });
    // the search box, the password and the terms checkbox are not ours to touch
    expect(fields.some((field) => /search|password|terms/i.test(field.label))).toBe(false);
  });

  it("fills what it can and declines the demographic question", () => {
    const doc = load("generic");
    fillForm(findFields(doc, generic), VALUES, RESUME);
    expect(valueOf('input[name="applicant"]')).toBe("Jordan Avery Lee");
    expect(chosen("#st")).toBe("Texas");
    expect(valueOf("#start")).toBe("2026-11-02");
    expect((doc.querySelector('input[name="f_9"][value="x"]') as HTMLInputElement).checked).toBe(true);
    expect((doc.querySelector('input[name="terms"]') as HTMLInputElement).checked).toBe(false);
    expect(valueOf("#pw")).toBe("");
  });
});

describe("filling the way frameworks expect", () => {
  it("fires input and change so controlled inputs pick the value up", () => {
    document.body.innerHTML = '<input id="x" />';
    const input = document.querySelector("#x") as HTMLInputElement;
    const seen: string[] = [];
    input.addEventListener("input", () => seen.push("input"));
    input.addEventListener("change", () => seen.push("change"));
    setNativeValue(input, "hello");
    expect(input.value).toBe("hello");
    expect(seen).toEqual(["input", "change"]);
  });

  it("never guesses an option", () => {
    const options = [{ text: "Select", value: "" }, { text: "Asian", value: "1" }, { text: "White", value: "2" }];
    // the person declined and this form has no way to decline, so nothing is picked
    expect(pickOption(options, "Decline to self-identify", "eeoRace")).toBe(-1);
    expect(pickOption(options, "Purple", null)).toBe(-1);
    expect(pickOption(options, "White", "eeoRace")).toBe(2);
  });
});

describe("reading the page", () => {
  it("reads a posting from structured data, keeping the list structure", () => {
    const job = readJob(load("posting"), "https://careers.northwind.example/jobs/42");
    expect(job).toMatchObject({ title: "Senior Data Analyst", company: "Northwind Health", location: "Denver, CO", url: "https://careers.northwind.example/jobs/42" });
    expect(job?.description).toContain("Requirements\n");
    expect(job?.description).toContain("• Strong SQL and Tableau skills");
  });

  it("falls back to the biggest block of text on a plain page", () => {
    const job = readJob(load("plain-posting"), "https://ironworks.example/careers/welder");
    expect(job?.title).toBe("Structural Welder");
    expect(job?.company).toBe("Ironworks Co");
    expect(job?.description).toContain("AWS D1.1 certification");
    expect(job?.description).not.toContain("Privacy");
  });

  it("does not call a form page a job posting", () => {
    expect(readJob(load("generic"), "https://lakeside.example/apply")).toBeNull();
  });

  it("spots a captcha and a thank you page", () => {
    document.body.innerHTML = '<div class="g-recaptcha" data-sitekey="x"></div>';
    expect(hasCaptcha(document)).toBe(true);
    document.body.innerHTML = "<main><h1>Thank you for applying!</h1><p>We will be in touch.</p></main>";
    expect(hasCaptcha(document)).toBe(false);
    expect(looksConfirmed(document)).toBe(true);
    expect(looksConfirmed(load("greenhouse"))).toBe(false);
  });
});

describe("profile values", () => {
  it("leaves out what the profile does not say", () => {
    const blank = profileValues({ ...ACCOUNT, current: { title: null, company: null }, profile: { ...ACCOUNT.profile, phone: null, needsSponsorship: null, workAuthorization: null, desiredSalaryMin: null, desiredSalaryMax: null } });
    for (const key of ["phone", "sponsorship", "workAuthorization", "salary", "currentCompany"] as const) expect(blank[key]).toBeUndefined();
    expect(blank.eeoGender).toBe("Decline to self-identify");
  });

  it("says no to work authorization only when the person said so", () => {
    expect(profileValues({ ...ACCOUNT, profile: { ...ACCOUNT.profile, workAuthorization: "Not authorized" } }).workAuthorization).toBe("No");
    expect(VALUES.workAuthorization).toBe("Yes");
  });
});
