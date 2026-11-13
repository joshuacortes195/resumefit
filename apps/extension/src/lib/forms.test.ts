// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adapterFor, generic, greenhouse, lever, ashby, workday } from "./adapters";
import { findApplyLink } from "./apply-link";
import { fillBlocked } from "./blocked";
import { fillDropdowns } from "./dropdowns";
import { findFields, looksLikeApplication, type FormField } from "./fields";
import { fillField, fillForm, matchOption, pickOption, setNativeValue } from "./fill";
import { hasCaptcha, looksConfirmed } from "./job-page";
import { pressAnswer, wouldSubmit } from "./press";
import { matchKey } from "./synonyms";
import type { Account, FieldKey, Profile } from "./types";
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
// the profile on its own, for tests that change one answer
const PROFILE = ACCOUNT.profile as Profile;
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

describe("what the page is showing", () => {
  it("spots a captcha and a thank you page", () => {
    document.body.innerHTML = '<div class="g-recaptcha" data-sitekey="x"></div>';
    expect(hasCaptcha(document)).toBe(true);
    document.body.innerHTML = "<main><h1>Thank you for applying!</h1><p>We will be in touch.</p></main>";
    expect(hasCaptcha(document)).toBe(false);
    expect(looksConfirmed(document)).toBe(true);
    expect(looksConfirmed(load("greenhouse"))).toBe(false);
  });

  it("is not fooled by a thank you message that is still tucked away", () => {
    document.body.innerHTML = '<main><form><input name="email"></form><script>const done = "Thank you for applying";</script><div hidden>Your application has been submitted</div></main>';
    expect(looksConfirmed(document)).toBe(false);
  });
});

describe("profile values", () => {
  it("leaves out what the profile does not say", () => {
    const blank = profileValues({ ...ACCOUNT, current: { title: null, company: null }, profile: { ...PROFILE, phone: null, needsSponsorship: null, workAuthorization: null, desiredSalaryMin: null, desiredSalaryMax: null } });
    for (const key of ["phone", "sponsorship", "workAuthorization", "salary", "currentCompany"] as const) expect(blank[key]).toBeUndefined();
    expect(blank.eeoGender).toBe("Decline to self-identify");
  });

  it("says no to work authorization only when the person said so", () => {
    expect(profileValues({ ...ACCOUNT, profile: { ...PROFILE, workAuthorization: "Not authorized" } }).workAuthorization).toBe("No");
    expect(VALUES.workAuthorization).toBe("Yes");
  });
});

describe("finding the way to the form", () => {
  it("follows a plain Apply link and ignores links that only mention applying", () => {
    document.body.innerHTML = `<a href="/about">How to apply for jobs here</a><a href="/jobs/77/apply"> Apply   now </a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBe("https://careers.example.com/jobs/77/apply");
  });

  it("goes to a greenhouse form that sits in a frame", () => {
    // read into a page of its own that never loads anything, so the test stays off the internet
    const page = new DOMParser().parseFromString(`<body><iframe src="https://boards.greenhouse.io/embed/job_app?for=acme&amp;token=12"/></body>`, "application/xml");
    expect(findApplyLink(page, "https://acme.example.com/careers?gh_jid=12")).toBe("https://boards.greenhouse.io/embed/job_app?for=acme&token=12");
  });

  it("gives up on anchors, insecure pages and pages with no button", () => {
    document.body.innerHTML = `<a href="#apply">Apply</a><a href="http://old.example.com/apply">Apply now</a><a href="mailto:jobs@example.com">Apply</a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBeNull();
  });
});

describe("the application profile", () => {
  it("recognizes the extra questions forms ask", () => {
    const keys = (label: string) => matchKey([label]);
    expect(keys("Are you Hispanic/Latino?")).toBe("eeoHispanic");
    expect(keys("Race / Ethnicity")).toBe("eeoRace");
    expect(keys("Pronouns")).toBe("pronouns");
    expect(keys("Are you at least 18 years of age?")).toBe("over18");
    expect(keys("Preferred first name")).toBe("preferredName");
    expect(keys("First Name")).toBe("firstName");
    expect(keys("Street address")).toBe("address");
    expect(keys("School")).toBe("school");
    expect(keys("Degree")).toBe("degree");
    expect(keys("Field of study")).toBe("major");
    expect(keys("Expected graduation date")).toBe("graduationDate");
    expect(keys("Graduation year")).toBe("graduationYear");
    expect(keys("GPA")).toBe("gpa");
  });

  it("answers them from what the person saved, and nothing else", () => {
    const account = { ...ACCOUNT, profile: { ...PROFILE, eeoRace: "Asian", eeoHispanic: "No", over18: true, pronouns: "They/them", school: "State University", degree: "Bachelor's degree", major: "Biology", graduationYear: "2024", streetAddress: "12 Elm St" } } as Account;
    expect(profileValues(account)).toMatchObject({ eeoHispanic: "No", over18: "Yes", pronouns: "They/them", school: "State University", degree: "Bachelor's degree", major: "Biology", graduationYear: "2024", address: "12 Elm St", preferredName: "Jordan" });
    // an older account that never saw these questions declines and leaves the rest alone
    const older = profileValues(ACCOUNT);
    expect(older.eeoHispanic).toBe("Decline to self-identify");
    expect(older.over18).toBeUndefined();
    expect(older.school).toBeUndefined();
    // choosing Hispanic or Latino as race answers the separate question too
    expect(profileValues({ ...ACCOUNT, profile: { ...PROFILE, eeoRace: "Hispanic or Latino" } } as Account).eeoHispanic).toBe("Yes");
  });

  it("picks the matching choice on the form", () => {
    document.body.innerHTML = `<form>
      <label for="h">Are you Hispanic/Latino?</label><select id="h"><option value="">Select</option><option>Yes</option><option>No</option><option>I don't wish to answer</option></select>
      <label for="d">Degree</label><select id="d"><option value="">Select</option><option>High School</option><option>Bachelor's Degree</option><option>Master's Degree</option></select>
      <fieldset><legend>Are you at least 18 years of age?</legend><label><input type="radio" name="age" value="1">Yes</label><label><input type="radio" name="age" value="0">No</label></fieldset>
      <label for="e">Email</label><input id="e"><label for="n">Full name</label><input id="n">
    </form>`;
    const account = { ...ACCOUNT, profile: { ...PROFILE, eeoHispanic: "Decline to self-identify", degree: "Bachelor's degree", over18: true } } as Account;
    fillForm(findFields(document, adapterFor("careers.example.com")), profileValues(account), null);
    const chosen = (id: string) => (document.getElementById(id) as HTMLSelectElement).selectedOptions[0]?.text;
    expect(chosen("h")).toBe("I don't wish to answer");
    expect(chosen("d")).toBe("Bachelor's Degree");
    expect((document.querySelector('input[name="age"][value="1"]') as HTMLInputElement).checked).toBe(true);
  });
});

describe("dropdowns that are not real select boxes", () => {
  // a button that opens a list of choices when clicked, the way workday builds its dropdowns
  function dropdown(label: string, choices: string[]) {
    const button = document.createElement("button");
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-label", `${label} select one required`);
    button.textContent = "Select One";
    button.addEventListener("click", () => {
      if (document.querySelector('[role="listbox"]')) return document.querySelector('[role="listbox"]')?.remove();
      const list = document.createElement("ul");
      list.setAttribute("role", "listbox");
      for (const choice of choices) {
        const option = document.createElement("li");
        option.setAttribute("role", "option");
        option.textContent = choice;
        option.addEventListener("click", () => {
          button.textContent = choice;
          list.remove();
        });
        list.append(option);
      }
      document.body.append(list);
    });
    document.body.append(button);
    return button;
  }

  it("opens each one, clicks the matching choice and closes one it cannot answer", async () => {
    document.body.innerHTML = "";
    const sponsor = dropdown("Will you now or in the future require sponsorship?", ["Yes", "No"]);
    const veteran = dropdown("Veteran status", ["I am a veteran", "I am not a veteran", "I do not wish to answer"]);
    const source = dropdown("How did you hear about us?", ["Job board", "Employee referral"]);
    const reports = await fillDropdowns(document, { sponsorship: "No", eeoVeteran: "Decline to self-identify", howHeard: "LinkedIn" }, false);
    expect(sponsor.textContent).toBe("No");
    expect(veteran.textContent).toBe("I do not wish to answer");
    // no choice says LinkedIn, so it is left for the person, with its list closed again
    expect(source.textContent).toBe("Select One");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(reports.map((report) => report.status)).toEqual(["filled", "filled", "missing"]);
    expect(reports[0]?.label).toBe("Will you now or in the future require sponsorship?");
  });

  it("leaves alone what was already dealt with on a later step", async () => {
    document.body.innerHTML = "";
    const first = dropdown("Are you legally authorized to work in the US?", ["Yes", "No"]);
    await fillDropdowns(document, { workAuthorization: "Yes" }, false);
    // the person changes it, then the next step opens
    first.textContent = "No";
    const second = dropdown("Willing to relocate?", ["Yes", "No"]);
    await fillDropdowns(document, { workAuthorization: "Yes", relocation: "Yes" }, true);
    expect(first.textContent).toBe("No");
    expect(second.textContent).toBe("Yes");
  });
});

describe("answers that are only close", () => {
  it("marks a loose match for the person to check, and a sure one as done", () => {
    const options = [{ text: "Select", value: "" }, { text: "United States of America", value: "US" }, { text: "Canada", value: "CA" }];
    expect(matchOption(options, "United States", "country")).toEqual({ index: 1, sure: false });
    expect(matchOption(options, "Canada", "country")).toEqual({ index: 2, sure: true });
    document.body.innerHTML = `<label for="c">Country</label><select id="c"><option value="">Select</option><option>United States of America</option></select><label for="e">Email</label><input id="e"><label for="n">Full name</label><input id="n">`;
    const report = fillForm(findFields(document, generic), { country: "United States", email: "a@example.com" }, null);
    expect(report.find((field) => field.key === "country")?.status).toBe("review");
    expect(report.find((field) => field.key === "email")?.status).toBe("filled");
  });

  it("gives a month picker a month and never guesses the day for a date", () => {
    document.body.innerHTML = `<label for="m">Expected graduation date</label><input id="m" type="month"><label for="d">Graduation date</label><input id="d" type="date">`;
    const [month, date] = findFields(document, generic);
    expect(fillField(month!, "May 2027", null)).toBe("filled");
    expect((document.getElementById("m") as HTMLInputElement).value).toBe("2027-05");
    expect(fillField(date!, "May 2027", null)).toBe("skipped");
    expect((document.getElementById("d") as HTMLInputElement).value).toBe("");
  });

  it("keeps a gpa to itself when asked, and writes a graduation date from the month and year", () => {
    const account = { ...ACCOUNT, profile: { ...PROFILE, gpa: "3.8", gpaNeverFill: true, graduationMonth: "May", graduationYear: "2027" } };
    expect(profileValues(account)).toMatchObject({ graduationDate: "May 2027", graduationYear: "2027" });
    expect(profileValues(account).gpa).toBeUndefined();
    expect(profileValues({ ...account, profile: { ...account.profile, gpaNeverFill: false } }).gpa).toBe("3.8");
    // no profile sent, like when auto apply is switched off: nothing to fill with
    expect(profileValues({ user: ACCOUNT.user, resumes: [] })).toEqual({});
  });

  it("attaches the cover letter to its own field and the resume to the other", () => {
    load("greenhouse");
    const letter = { name: "Cover-Letter.pdf", type: "application/pdf", base64: btoa("%PDF-1.4 letter") };
    const report = fillForm(findFields(document, greenhouse), VALUES, RESUME, letter);
    expect((document.querySelector("#cover_letter") as HTMLInputElement).files?.[0]?.name).toBe("Cover-Letter.pdf");
    expect((document.querySelector("#resume") as HTMLInputElement).files?.[0]?.name).toBe("Jordan-Lee-Resume.pdf");
    expect(report.find((field) => field.key === "coverLetter")?.status).toBe("filled");
  });
});

describe("never sending the form", () => {
  it("refuses to click anything that could submit or move the form along", () => {
    document.body.innerHTML = `<form>
      <button id="a">Submit application</button><button id="b" type="button">Next</button><input id="c" type="submit" value="Apply">
      <a id="d" href="/apply">Apply now</a><div id="e" role="button">Continue</div>
      <button id="f" type="button" aria-haspopup="listbox">Select One</button><button id="g" aria-haspopup="listbox">Submit</button>
      <input id="h" type="radio" name="r"><div id="i" role="option">Yes</div>
    </form>`;
    const risky = (id: string) => wouldSubmit(document.getElementById(id)!);
    expect(["a", "b", "c", "d", "e", "g"].map(risky)).toEqual([true, true, true, true, true, true]);
    expect(["f", "h", "i"].map(risky)).toEqual([false, false, false]);
    let clicks = 0;
    document.getElementById("a")?.addEventListener("click", (event) => {
      event.preventDefault();
      clicks++;
    });
    expect(pressAnswer(document.getElementById("a")!)).toBe(false);
    expect(clicks).toBe(0);
    expect(pressAnswer(document.getElementById("h")!)).toBe(true);
    expect((document.getElementById("h") as HTMLInputElement).checked).toBe(true);
  });

  it("fills every saved form without one click on a button or one submit", async () => {
    for (const [name, host] of [["greenhouse", "boards.greenhouse.io"], ["lever", "jobs.lever.co"], ["ashby", "jobs.ashbyhq.com"], ["workday", "acme.wd5.myworkdayjobs.com"], ["generic", "careers.lakeside.example"]] as const) {
      const doc = load(name);
      const pressed: string[] = [];
      for (const button of doc.querySelectorAll("button, input[type=submit], a")) button.addEventListener("click", () => pressed.push(`${name}: ${button.textContent}`));
      for (const form of doc.querySelectorAll("form")) form.addEventListener("submit", () => pressed.push(`${name}: submit`));
      fillForm(findFields(doc, adapterFor(host)), VALUES, RESUME, RESUME);
      await fillDropdowns(doc, VALUES, false);
      expect(pressed).toEqual([]);
    }
  });

  it("has no code that submits a form, and clicks only through the guard", () => {
    const folder = path.join(import.meta.dirname, "..");
    const files = ["content.ts", "background.ts", ...["adapters/index", "apply-link", "blocked", "dropdowns", "fields", "fill", "job-page", "press", "synonyms", "values"].map((name) => `lib/${name}.ts`)];
    for (const file of files) {
      const code = readFileSync(path.join(folder, file), "utf8").replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/\.submit\(|requestSubmit|dispatchEvent\([^)]*["']submit/);
      // the only clicks are on a radio button or a choice in an open list, and the guard itself
      const allowed = file === "lib/press.ts" ? 1 : file === "lib/dropdowns.ts" ? 2 : 0;
      expect(code.match(/\.click\(\)/g)?.length ?? 0, file).toBe(allowed);
    }
  });

  it("stays off the sites that forbid it", () => {
    expect(["www.linkedin.com", "linkedin.com", "www.indeed.com", "uk.indeed.com"].map(fillBlocked)).toEqual([true, true, true, true]);
    expect(["boards.greenhouse.io", "notlinkedin.com", "indeed.com.evil.example"].map(fillBlocked)).toEqual([false, false, false]);
  });
});
