// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { findApplyLink } from "./apply-link";
import { showBar, tickBar } from "./bar";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adapterFor } from "./adapters";
import { findFields } from "./fields";
import { fillForm, highlight } from "./fill";
import { canAutoSubmit, fillEverything, MAX_DRAFTS, pickResume, tally, worthDrafting, type Ask } from "./pipeline";
import { findSubmit, pressSubmit } from "./submit";
import { matchKey } from "./synonyms";
import { profileValues } from "./values";
import type { Account, FieldReport, PageRequest } from "./types";

// a field as the page reports it, with only the interesting bits spelled out
const field = (id: string, extra: Partial<FieldReport> = {}): FieldReport => ({ id, key: "question", label: "Why do you want to work here?", kind: "textarea", required: true, status: "missing", value: "", ...extra });

const ACCOUNT = {
  user: { email: "jordan.lee@example.com", name: "Jordan Lee" },
  profileReady: true,
  current: { title: null, company: null },
  resumes: [
    { id: "base", name: "Base", isBase: true, linkedJobId: null },
    { id: "tailored", name: "For Acme", isBase: false, linkedJobId: "job-1" },
    { id: "other", name: "Other", isBase: false, linkedJobId: null },
  ],
  profile: { fullName: "Jordan Lee", email: "jordan.lee@example.com", eeoGender: "", eeoRace: "", eeoVeteran: "", eeoDisability: "" },
} as unknown as Account;

describe("finding the way to the form", () => {
  it("follows a plain Apply link and ignores links that only mention applying", () => {
    document.body.innerHTML = `<a href="/about">How to apply for jobs here</a><a href="/jobs/77/apply"> Apply   now </a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBe("https://careers.example.com/jobs/77/apply");
  });

  it("goes to a greenhouse form that sits in a frame", () => {
    // read into a page of its own that never loads anything, so the test stays off the internet
    const page = new DOMParser().parseFromString(`<iframe src="https://boards.greenhouse.io/embed/job_app?for=acme&token=12"></iframe>`, "text/html");
    expect(findApplyLink(page, "https://acme.example.com/careers?gh_jid=12")).toBe("https://boards.greenhouse.io/embed/job_app?for=acme&token=12");
  });

  it("gives up on anchors, insecure pages and pages with no button", () => {
    document.body.innerHTML = `<a href="#apply">Apply</a><a href="http://old.example.com/apply">Apply now</a><a href="mailto:jobs@example.com">Apply</a>`;
    expect(findApplyLink(document, "https://careers.example.com/jobs/77")).toBeNull();
  });
});

describe("filling a whole form in one go", () => {
  it("drafts only the questions that need an answer", () => {
    expect(worthDrafting(field("a"))).toBe(true);
    // optional, and not really a question
    expect(worthDrafting(field("b", { required: false, label: "Additional information" }))).toBe(false);
    // already has something in it
    expect(worthDrafting(field("c", { value: "Because." }))).toBe(false);
    expect(worthDrafting(field("d", { key: "email", kind: "text" }))).toBe(false);
  });

  it("uses saved answers as they are and marks fresh drafts for review", async () => {
    const page = [field("rf-0", { key: "email", kind: "text", label: "Email", status: "filled", value: "jordan.lee@example.com" }), field("rf-1"), field("rf-2", { label: "Describe a hard week." }), field("rf-3", { required: false, label: "Anything else" })];
    const asked: PageRequest[] = [];
    const ask = (async (request: PageRequest) => {
      asked.push(request);
      if (request.type === "autofill") return page;
      if (request.type === "set-field") return { ...page.find((entry) => entry.id === request.id), value: request.value, status: request.status };
      return null;
    }) as Ask;
    const questions: string[] = [];
    const source = {
      resumeFile: async () => ({ name: "resume.pdf", type: "application/pdf", base64: "" }),
      answer: async ({ question, jobId }: { question: string; jobId?: string }) => {
        questions.push(`${question} (${jobId})`);
        return question.startsWith("Why") ? { answer: "I like the work.", source: "saved" as const } : { answer: "A draft.", source: "ai" as const };
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: "job-1", jdText: "" }, source);
    expect(questions).toEqual(["Why do you want to work here? (job-1)", "Describe a hard week. (job-1)"]);
    expect(result.map((entry) => entry.status)).toEqual(["filled", "filled", "review", "missing"]);
    expect(tally(result)).toEqual({ filled: 3, needs: 2 });
    // it only ever fills and sets fields
    expect(new Set(asked.map((request) => request.type))).toEqual(new Set(["autofill", "set-field"]));
  });

  it("keeps going when an answer cannot be drafted, and stops after a handful", async () => {
    const page = Array.from({ length: MAX_DRAFTS + 3 }, (_, index) => field(`rf-${index}`));
    let calls = 0;
    const ask = (async (request: PageRequest) => (request.type === "autofill" ? page : null)) as Ask;
    const source = {
      resumeFile: async () => {
        throw new Error("gone");
      },
      answer: async () => {
        calls++;
        throw new Error("busy");
      },
    };
    const result = await fillEverything(ask, ACCOUNT, { resumeId: "base", jobId: null, jdText: "" }, source);
    expect(calls).toBe(MAX_DRAFTS);
    expect(result.every((entry) => entry.status === "missing")).toBe(true);
  });

  it("attaches the resume made for the job, then the one asked for, then the base one", () => {
    expect(pickResume(ACCOUNT, "job-1", "other")).toBe("tailored");
    expect(pickResume(ACCOUNT, "job-2", "other")).toBe("other");
    expect(pickResume(ACCOUNT, null, null)).toBe("base");
  });
});

describe("the one application", () => {
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
    expect(keys("Expected graduation date")).toBe("graduationYear");
    expect(keys("GPA")).toBe("gpa");
  });

  it("answers them from what the person saved, and nothing else", () => {
    const account = { ...ACCOUNT, profile: { ...ACCOUNT.profile, eeoRace: "Asian", eeoHispanic: "No", over18: true, pronouns: "They/them", school: "State University", degree: "Bachelor's degree", major: "Biology", graduationYear: "2024", streetAddress: "12 Elm St" } } as Account;
    expect(profileValues(account)).toMatchObject({ eeoHispanic: "No", over18: "Yes", pronouns: "They/them", school: "State University", degree: "Bachelor's degree", major: "Biology", graduationYear: "2024", address: "12 Elm St", preferredName: "Jordan" });
    // an older account that never saw these questions declines and leaves the rest alone
    const older = profileValues(ACCOUNT);
    expect(older.eeoHispanic).toBe("Decline to self-identify");
    expect(older.over18).toBeUndefined();
    expect(older.school).toBeUndefined();
    // choosing Hispanic or Latino as race answers the separate question too
    expect(profileValues({ ...ACCOUNT, profile: { ...ACCOUNT.profile, eeoRace: "Hispanic or Latino" } } as Account).eeoHispanic).toBe("Yes");
  });

  it("picks the matching choice on the form", () => {
    document.body.innerHTML = `<form>
      <label for="h">Are you Hispanic/Latino?</label><select id="h"><option value="">Select</option><option>Yes</option><option>No</option><option>I don't wish to answer</option></select>
      <label for="d">Degree</label><select id="d"><option value="">Select</option><option>High School</option><option>Bachelor's Degree</option><option>Master's Degree</option></select>
      <fieldset><legend>Are you at least 18 years of age?</legend><label><input type="radio" name="age" value="1">Yes</label><label><input type="radio" name="age" value="0">No</label></fieldset>
      <label for="e">Email</label><input id="e"><label for="n">Full name</label><input id="n">
    </form>`;
    const account = { ...ACCOUNT, profile: { ...ACCOUNT.profile, eeoHispanic: "Decline to self-identify", degree: "Bachelor's degree", over18: true } } as Account;
    fillForm(findFields(document, adapterFor("careers.example.com")), profileValues(account), null);
    const chosen = (id: string) => (document.getElementById(id) as HTMLSelectElement).selectedOptions[0]?.text;
    expect(chosen("h")).toBe("I don't wish to answer");
    expect(chosen("d")).toBe("Bachelor's Degree");
    expect((document.querySelector('input[name="age"][value="1"]') as HTMLInputElement).checked).toBe(true);
  });
});

describe("submit for me", () => {
  // loads a saved form, fills it the way a run does and marks each field
  function filled(name: string, host: string, account = ACCOUNT) {
    document.documentElement.innerHTML = readFileSync(path.join(import.meta.dirname, "../../test/fixtures", `${name}.html`), "utf8");
    const fields = findFields(document, adapterFor(host));
    const reports = fillForm(fields, profileValues(account), { name: "resume.pdf", type: "application/pdf", base64: btoa("%PDF-1.4") });
    for (const report of reports) highlight(fields.find((entry) => entry.id === report.id)!, report.status);
    return { fields, reports };
  }

  it("only goes ahead when nothing at all is left for the person", () => {
    const ready = [field("a", { key: "email", status: "filled" }), field("b", { key: "firstName", status: "filled" }), field("c", { key: "resume", kind: "file", status: "filled" }), field("d", { required: false, status: "skipped" })];
    const page = { captcha: false, multiPage: false };
    expect(canAutoSubmit(ready, page)).toBe(true);
    expect(canAutoSubmit(ready, { ...page, captcha: true })).toBe(false);
    expect(canAutoSubmit(ready, { ...page, multiPage: true })).toBe(false);
    // a drafted answer has to be read first, and an empty required field has to be answered
    expect(canAutoSubmit([...ready, field("e", { status: "review", value: "A draft." })], page)).toBe(false);
    expect(canAutoSubmit([...ready, field("f", { status: "missing" })], page)).toBe(false);
    // a resume field we could not attach to
    expect(canAutoSubmit([...ready.slice(0, 2), field("c", { key: "resume", kind: "file", required: false, status: "skipped" }), ready[3]!], page)).toBe(false);
  });

  it("finds the button that sends each kind of form", () => {
    for (const [name, host, words] of [
      ["greenhouse", "boards.greenhouse.io", "Submit Application"],
      ["lever", "jobs.lever.co", "Submit application"],
      ["ashby", "jobs.ashbyhq.com", "Submit Application"],
      ["generic", "careers.example.com", "Send application"],
    ] as const) {
      const button = findSubmit(document, filled(name, host).fields);
      expect(button?.textContent || button?.getAttribute("value"), name).toBe(words);
    }
  });

  it("will not guess between two buttons, and never presses Next", () => {
    document.body.innerHTML = `<form><input name="email" id="email"><button type="submit">Next</button><button type="button">Save draft</button></form>`;
    expect(findSubmit(document, findFields(document, adapterFor("careers.example.com")))).toBeNull();
    document.body.innerHTML = `<form><input name="email" id="email"><button>Apply</button><button>Submit</button></form>`;
    expect(findSubmit(document, findFields(document, adapterFor("careers.example.com")))).toBeNull();
  });

  it("leaves the form alone while a field still needs checking", () => {
    // the greenhouse form has a written question, which a plain fill leaves red
    const { fields } = filled("greenhouse", "boards.greenhouse.io");
    let clicks = 0;
    document.querySelector("#submit_app")?.addEventListener("click", (event) => {
      event.preventDefault();
      clicks++;
    });
    expect(pressSubmit(document, fields)).toMatchObject({ sent: false });
    expect(clicks).toBe(0);
    // once every field is marked as filled, the site's own button is clicked, once
    for (const entry of fields) highlight(entry, "filled");
    for (const control of document.querySelectorAll("[required]")) control.removeAttribute("required");
    expect(pressSubmit(document, fields)).toEqual({ sent: true });
    expect(clicks).toBe(1);
  });

  it("lets the form's own rules stop it", () => {
    document.body.innerHTML = `<form><input name="email" id="email" value="a@example.com"><input type="checkbox" required><button type="submit">Submit application</button></form>`;
    const fields = findFields(document, adapterFor("careers.example.com"));
    let clicks = 0;
    document.querySelector("button")?.addEventListener("click", () => clicks++);
    // the box that only the person can tick is still empty
    expect(pressSubmit(document, fields)).toMatchObject({ sent: false });
    expect(clicks).toBe(0);
  });
});

describe("the bar on the page", () => {
  const read = () => document.getElementById("resumefit-bar")?.shadowRoot;

  it("says what was filled and what needs the person, and never offers to submit", () => {
    let next = 0;
    let refill = 0;
    showBar(document, { state: "done", filled: 12, needs: 2, captcha: true, multiPage: false }, { onNext: () => next++, onRefill: () => refill++ });
    const root = read();
    expect(root?.querySelector(".title")?.textContent).toBe("Filled 12 fields, 2 need you");
    expect(root?.querySelector(".note")?.textContent).toContain("press the site's own Submit button");
    expect(root?.querySelector(".note")?.textContent).toContain("captcha is yours");
    const buttons = [...(root?.querySelectorAll("button") ?? [])];
    expect(buttons.map((button) => button.textContent)).toEqual(["Show next", "Fill again", "×"]);
    buttons[0]?.click();
    buttons[1]?.click();
    expect([next, refill]).toEqual([1, 1]);
    // closing takes it off the page
    buttons[2]?.click();
    expect(document.getElementById("resumefit-bar")).toBeNull();
  });

  it("counts down with a way to cancel", () => {
    let cancelled = 0;
    showBar(document, { state: "sending", seconds: 8 }, { onNext: () => undefined, onRefill: () => undefined, onCancel: () => cancelled++ });
    expect(read()?.querySelector(".title")?.textContent).toBe("Sending this application in 8s");
    tickBar(document, 7);
    expect(read()?.querySelector(".title")?.textContent).toBe("Sending this application in 7s");
    const buttons = [...(read()?.querySelectorAll("button") ?? [])];
    expect(buttons.map((button) => button.textContent)).toEqual(["Cancel"]);
    buttons[0]?.click();
    expect(cancelled).toBe(1);
  });

  it("replaces itself when the state changes", () => {
    showBar(document, { state: "working" }, { onNext: () => undefined, onRefill: () => undefined });
    showBar(document, { state: "applied" }, { onNext: () => undefined, onRefill: () => undefined });
    expect(document.querySelectorAll("#resumefit-bar")).toHaveLength(1);
    expect(read()?.querySelector(".title")?.textContent).toBe("Application sent");
  });
});
