// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Ask } from "./pipeline";
import { runApplication } from "./runner";
import { fillEverything } from "./pipeline";
import { aboutCompany, sendApplication, waitingOn, whyNotSend } from "./send";
import { findSubmit, pressSubmit } from "./submit";
import type { Account, FieldReport, PageInfo, PageRequest } from "./types";

// loads one of the saved form pages into the test document
function load(name: string): Document {
  document.documentElement.innerHTML = readFileSync(path.join(import.meta.dirname, "../../test/fixtures", `${name}.html`), "utf8");
  return document;
}

// counts every press of a button and every send of a form on the page
function watch(doc: Document): string[] {
  const pressed: string[] = [];
  for (const button of doc.querySelectorAll("button, input[type=submit]")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      pressed.push((button.textContent || button.getAttribute("value") || "").trim());
    });
  }
  return pressed;
}

const field = (id: string, extra: Partial<FieldReport> = {}): FieldReport => ({ id, key: "email", label: "Email", kind: "text", required: true, status: "filled", value: "jordan.lee@example.com", ...extra });

const PAGE: PageInfo = { url: "https://boards.greenhouse.io/acme/jobs/1", job: null, linkedinProfile: false, ats: { id: "greenhouse", name: "Greenhouse" }, hasForm: true, multiPage: false, fields: [], captcha: false, confirmed: false, fillBlocked: false };

// an account with sending switched on the way the person chose
const account = (autoSend: "off" | "safe" | "all", sendsLeft = 5) =>
  ({ user: { email: "jordan.lee@example.com", name: "Jordan Lee" }, autoApply: true, profileReady: true, sendsLeft, resumes: [{ id: "base", name: "Base", isBase: true }], profile: { fullName: "Jordan Lee", email: "jordan.lee@example.com", autoSend } }) as unknown as Account;

describe("finding and pressing Submit", () => {
  it("finds the one button that sends each known form", () => {
    expect(findSubmit(load("greenhouse"))?.id).toBe("submit_app");
    expect(findSubmit(load("lever"))?.id).toBe("btn-submit");
    expect(findSubmit(load("ashby"))?.textContent).toBe("Submit Application");
  });

  it("presses it once", () => {
    const pressed = watch(load("lever"));
    expect(pressSubmit(document, "jobs.lever.co")).toEqual({ pressed: true });
    expect(pressed).toEqual(["Submit application"]);
  });

  it("will not guess between two buttons, or press one that is switched off or says something else", () => {
    document.body.innerHTML = '<form><input data-resumefit-field="a"><button type="submit">Submit application</button><button type="button">Apply now</button></form>';
    expect(findSubmit(document)).toBeNull();
    document.body.innerHTML = '<form><input data-resumefit-field="a"><button type="submit" disabled>Submit application</button></form>';
    expect(findSubmit(document)).toBeNull();
    document.body.innerHTML = '<form><input data-resumefit-field="a"><button type="submit">Next</button><button>Save and continue</button><a href="/x">Submit</a></form>';
    expect(findSubmit(document)).toBeNull();
    const pressed = watch(document);
    expect(pressSubmit(document, "boards.greenhouse.io").pressed).toBe(false);
    expect(pressed).toEqual([]);
  });

  it("looks only inside the form that was filled", () => {
    document.body.innerHTML = '<form id="search"><button type="submit">Apply</button></form><form id="real"><input data-resumefit-field="a"><button type="submit">Submit application</button></form>';
    expect(findSubmit(document)?.closest("form")?.id).toBe("real");
  });

  it("never presses on linkedin or indeed, or past a captcha", () => {
    const pressed = watch(load("lever"));
    expect(pressSubmit(document, "www.linkedin.com").pressed).toBe(false);
    expect(pressSubmit(document, "www.indeed.com").pressed).toBe(false);
    document.body.insertAdjacentHTML("beforeend", '<div class="h-captcha"></div>');
    expect(pressSubmit(document, "jobs.lever.co")).toMatchObject({ pressed: false, reason: expect.stringContaining("captcha") });
    expect(pressed).toEqual([]);
  });
});

describe("deciding whether to send", () => {
  it("is off unless the person switched it on", () => {
    expect(whyNotSend(PAGE, [field("a")], account("off"))).toMatch(/switched off/);
    expect(whyNotSend(PAGE, [field("a")], { ...account("all"), profile: undefined })).toMatch(/switched off/);
    expect(whyNotSend(PAGE, [field("a")], account("safe"))).toBeNull();
  });

  it("holds back for anything it is not sure about", () => {
    const all = account("all");
    expect(whyNotSend({ ...PAGE, fillBlocked: true }, [field("a")], all)).toMatch(/does not allow/);
    expect(whyNotSend({ ...PAGE, ats: null }, [field("a")], all)).toMatch(/Greenhouse, Lever and Ashby/);
    expect(whyNotSend({ ...PAGE, ats: { id: "workday", name: "Workday" } }, [field("a")], all)).toMatch(/Greenhouse, Lever and Ashby/);
    expect(whyNotSend({ ...PAGE, multiPage: true }, [field("a")], all)).toMatch(/several pages/);
    expect(whyNotSend({ ...PAGE, captcha: true }, [field("a")], all)).toMatch(/captcha/);
    expect(whyNotSend(PAGE, [field("a")], account("all", 0))).toMatch(/in a day/);
    expect(whyNotSend(PAGE, [field("a"), field("b", { status: "missing", value: "" })], all)).toBe("1 required answer is still empty.");
    expect(whyNotSend(PAGE, [field("a"), field("r", { key: "resume", kind: "file", status: "missing" })], all)).toMatch(/empty|resume/);
    expect(whyNotSend(PAGE, [field("a"), field("r", { key: "resume", kind: "file", status: "skipped" })], all)).toMatch(/resume/);
  });

  it("tells a question about the employer from a general one", () => {
    for (const label of ["Why do you want to work here?", "Why are you interested in this role?", "What excites you about our mission?", "Why Acme?", "What interests you about working at Brightside Labs?", "Tell us why you want to join Stripe"]) expect(aboutCompany(label), label).toBe(true);
    expect(aboutCompany("How would you improve Checkout?", "Checkout")).toBe(true);
    for (const label of ["Describe a project you are proud of.", "How many years of experience do you have with SQL?", "What is your greatest strength?", "Tell us about a time you disagreed with a teammate.", "Are you willing to relocate?"]) expect(aboutCompany(label), label).toBe(false);
  });

  it("sends a general draft, and keeps a drafted answer about the employer for the person unless they handed that over too", () => {
    const general = [field("a"), field("q", { key: "question", label: "Describe a project you are proud of.", status: "review", value: "A draft." })];
    expect(whyNotSend(PAGE, general, account("safe"))).toBeNull();
    const theirs = [field("a"), field("q", { key: "question", label: "Why do you want to work here?", status: "review", value: "A draft." })];
    expect(whyNotSend(PAGE, theirs, account("safe"))).toBe("1 question is about this company, and that answer should be yours.");
    expect(whyNotSend(PAGE, theirs, account("all"))).toBeNull();
    // an answer the person saved or wrote is not a draft, so it goes
    expect(whyNotSend(PAGE, [field("a"), field("q", { key: "question", label: "Why do you want to work here?", status: "filled", value: "Mine." })], account("safe"))).toBeNull();
  });

  it("lists what a held form is waiting on, with the choices when it had some", () => {
    const fields = [
      field("a"),
      field("b", { key: "howHeard", kind: "select", label: "How did you hear about us?", status: "missing", value: "", options: ["LinkedIn", "A friend"] }),
      field("q", { key: "question", kind: "textarea", label: "Why do you want to work here?", status: "review", value: "A draft." }),
      field("g", { key: "question", kind: "textarea", label: "Describe a project you are proud of.", status: "review", value: "A draft." }),
      field("r", { key: "resume", kind: "file", label: "Resume", status: "missing", value: "" }),
    ];
    expect(waitingOn(fields, account("safe"))).toEqual([
      { label: "How did you hear about us?", written: false, options: ["LinkedIn", "A friend"] },
      { label: "Why do you want to work here?", written: true },
    ]);
    // hands-off: only what is truly empty
    expect(waitingOn(fields, account("all")).map((entry) => entry.label)).toEqual(["How did you hear about us?"]);
  });

  it("fills an empty required answer from what the person said before, and never drafts one", async () => {
    const page = [field("a"), field("b", { key: "howHeard", kind: "select", label: "How did you hear about us?", status: "missing", value: "" }), field("c", { key: null, kind: "select", label: "Shirt size", status: "missing", value: "" })];
    const asked: string[] = [];
    const ask = (async (request: PageRequest) => {
      if (request.type === "autofill") return page;
      if (request.type === "set-field") return { ...page.find((entry) => entry.id === request.id), value: request.value, status: request.status };
      return null;
    }) as Ask;
    const source = {
      resumeFile: async () => ({ name: "resume.pdf", type: "application/pdf", base64: "" }),
      coverLetterFile: async () => null as never,
      answer: async () => {
        throw new Error("nothing here should be drafted");
      },
      savedAnswer: async ({ question }: { question: string }) => {
        asked.push(question);
        return { answer: question.startsWith("How did") ? "LinkedIn" : null };
      },
    };
    const result = await fillEverything(ask, account("safe"), { resumeId: null, jobId: "job-1", jdText: "" }, source);
    expect(asked).toEqual(["How did you hear about us?", "Shirt size"]);
    expect(result.fields.map((entry) => [entry.status, entry.value])).toEqual([["filled", "jordan.lee@example.com"], ["filled", "LinkedIn"], ["missing", ""]]);
  });
});

describe("sending", () => {
  const instant = async () => undefined;

  it("presses once and waits for the page to say thanks", async () => {
    const asked: string[] = [];
    let looks = 0;
    const ask = (async (request: PageRequest) => {
      asked.push(request.type);
      if (request.type === "submit") return { pressed: true };
      return { ...PAGE, confirmed: ++looks >= 3 };
    }) as Ask;
    expect(await sendApplication(ask, instant)).toEqual({ sent: true });
    expect(asked.filter((type) => type === "submit")).toHaveLength(1);
  });

  it("says so when the page never confirms, and does not press again", async () => {
    const asked: string[] = [];
    const ask = (async (request: PageRequest) => {
      asked.push(request.type);
      if (request.type === "submit") return { pressed: true };
      throw new Error("the page is loading");
    }) as Ask;
    const result = await sendApplication(ask, instant, 4);
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/never said/);
    expect(asked.filter((type) => type === "submit")).toHaveLength(1);
  });

  it("passes on why the page would not press", async () => {
    const ask = (async () => ({ pressed: false, reason: "The form has a captcha, which only you can do." })) as Ask;
    expect(await sendApplication(ask, instant)).toEqual({ sent: false, reason: "The form has a captcha, which only you can do." });
  });
});

describe("working through one application alone", () => {
  // a pretend page: a posting that leads to a form, which fills cleanly and confirms after Submit
  function world(options: { fields?: FieldReport[]; page?: Partial<PageInfo>; confirms?: boolean } = {}) {
    const asked: string[] = [];
    const reports: { status: string; sentBy?: string }[] = [];
    let onForm = false;
    let pressed = false;
    const ask = (async (request: PageRequest) => {
      asked.push(request.type);
      if (request.type === "read-page") return { ...PAGE, hasForm: onForm, confirmed: pressed && options.confirms !== false, ...options.page };
      if (request.type === "find-apply") return "https://boards.greenhouse.io/acme/jobs/1/apply";
      if (request.type === "autofill") return options.fields ?? [field("a"), field("r", { key: "resume", kind: "file", label: "Resume", value: "resume.pdf" })];
      if (request.type === "submit") {
        pressed = true;
        return { pressed: true };
      }
      return null;
    }) as Ask;
    const hooks = {
      ask,
      goTo: async () => {
        onForm = true;
      },
      report: async (report: { status: string; sentBy?: string }) => reports.push({ status: report.status, sentBy: report.sentBy }),
      today: "2026-11-13",
      source: { resumeFile: async () => ({ name: "resume.pdf", type: "application/pdf", base64: "" }), coverLetterFile: async () => null as never, answer: async () => ({ answer: "A draft.", source: "ai" as const }) },
      pause: async () => undefined,
    };
    return { asked, reports, hooks };
  }
  const JOB = { url: "https://boards.greenhouse.io/acme/jobs/1", jobId: null, resumeId: null };

  it("follows the posting to its form, fills it, sends it and reports it as sent for the person", async () => {
    const { asked, reports, hooks } = world();
    expect(await runApplication(account("safe"), JOB, hooks)).toMatchObject({ sent: true, reason: null, filled: 2 });
    expect(asked.filter((type) => type === "submit")).toHaveLength(1);
    expect(reports).toEqual([
      { status: "needs_review", sentBy: undefined },
      { status: "applied", sentBy: "auto" },
    ]);
  });

  it("fills but never presses when sending is off", async () => {
    const { asked, reports, hooks } = world();
    expect(await runApplication(account("off"), JOB, hooks)).toMatchObject({ sent: false, reason: expect.stringContaining("switched off") });
    expect(asked).not.toContain("submit");
    expect(reports).toEqual([{ status: "needs_review", sentBy: undefined }]);
  });

  it("leaves a form with an empty required answer or a late captcha for the person", async () => {
    const empty = world({ fields: [field("a"), field("b", { status: "missing", value: "", key: "relocation", label: "Willing to relocate?" })] });
    expect((await runApplication(account("all"), JOB, empty.hooks)).reason).toBe("1 required answer is still empty.");
    expect(empty.asked).not.toContain("submit");
    const captcha = world({ page: { captcha: true } });
    expect((await runApplication(account("all"), JOB, captcha.hooks)).reason).toMatch(/captcha/);
    expect(captcha.asked).not.toContain("submit");
  });

  it("waits for a form that the page draws a few seconds after it loads", async () => {
    let looks = 0;
    const asked: string[] = [];
    const ask = (async (request: PageRequest) => {
      asked.push(request.type);
      // the form shows up on the fourth look
      if (request.type === "read-page") return { ...PAGE, hasForm: ++looks >= 4, confirmed: asked.includes("submit") };
      if (request.type === "find-apply") return null;
      if (request.type === "autofill") return [field("a")];
      if (request.type === "submit") return { pressed: true };
      return null;
    }) as Ask;
    const outcome = await runApplication(account("safe"), JOB, { ask, goTo: async () => undefined, report: async () => undefined, today: "2026-11-14", pause: async () => undefined, source: { resumeFile: async () => null as never, coverLetterFile: async () => null as never, answer: async () => ({ answer: "", source: "ai" as const }) } });
    expect(outcome.sent).toBe(true);
    // and a page that never shows one is given up on, not waited on forever
    looks = -1000;
    const none = await runApplication(account("safe"), JOB, { ask, goTo: async () => undefined, report: async () => undefined, today: "2026-11-14", pause: async () => undefined });
    expect(none).toMatchObject({ sent: false, reason: "We could not find the application form on this page." });
  });

  it("does not touch a site that forbids it, and does not call an unconfirmed send sent", async () => {
    const blocked = world({ page: { fillBlocked: true, hasForm: false } });
    expect(await runApplication(account("all"), JOB, blocked.hooks)).toMatchObject({ sent: false, filled: 0 });
    expect(blocked.asked).not.toContain("autofill");
    const silent = world({ confirms: false });
    const outcome = await runApplication(account("all"), JOB, silent.hooks);
    expect(outcome.sent).toBe(false);
    expect(silent.reports.map((report) => report.status)).toEqual(["needs_review"]);
  });
});
