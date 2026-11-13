import { adapterFor } from "./lib/adapters";
import { findApplyLink } from "./lib/apply-link";
import { fillBlocked } from "./lib/blocked";
import { fillDropdowns, setDropdown } from "./lib/dropdowns";
import { findFields, looksLikeApplication, type FormField } from "./lib/fields";
import { currentValue, fillField, fillForm, highlight, optionsOf } from "./lib/fill";
import { hasCaptcha, looksConfirmed, readJob } from "./lib/job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./lib/linkedin-page";
import type { FieldReport, PageInfo, PageRequest } from "./lib/types";

// this file is put into the page only when the person asks for it. it reads the page and fills in answers.
// it never presses submit, next or anything else that sends an application or moves it along

declare global {
  interface Window {
    __resumefitLoaded?: boolean;
  }
}

// the fields found on the last look at the page
let fields: FormField[] = [];

// what we can tell the side panel about a field right now
function report(field: FormField, status: FieldReport["status"]): FieldReport {
  return { id: field.id, key: field.key, label: field.label, kind: field.kind, required: field.required, status, value: currentValue(field), options: optionsOf(field) };
}

// how a field was left by the last fill, skipped when it was never touched
const statusOf = (field: FormField) => (field.elements[0]?.getAttribute("data-resumefit-status") as FieldReport["status"] | null) ?? "skipped";

// looks the page over: is it a job posting, is it an application form, which system is it
function readPage(): PageInfo {
  const adapter = adapterFor(location.hostname);
  const blocked = fillBlocked(location.hostname);
  // on a site that forbids it the form is not even looked at
  fields = blocked ? [] : findFields(document, adapter);
  const hasForm = looksLikeApplication(fields);
  return {
    url: location.href,
    job: readJob(document, location.href),
    linkedinProfile: isLinkedinProfile(location.href),
    ats: adapter.id === "generic" ? null : { id: adapter.id, name: adapter.name },
    hasForm,
    multiPage: adapter.multiPage === true,
    fields: hasForm ? fields.map((field) => report(field, statusOf(field))) : [],
    captcha: hasCaptcha(document),
    confirmed: looksConfirmed(document),
    fillBlocked: blocked,
  };
}

if (!window.__resumefitLoaded) {
  window.__resumefitLoaded = true;

  chrome.runtime.onMessage.addListener((request: PageRequest, _sender, respond) => {
    if (request.type === "read-page") {
      respond(readPage());
    } else if (request.type === "autofill") {
      // never on a site whose rules forbid it
      if (fillBlocked(location.hostname)) {
        respond([]);
        return false;
      }
      // look again first, forms like workday swap their fields as you move between pages
      fields = findFields(document, adapterFor(location.hostname));
      // on a later step of a long form, what was already filled or fixed by the person is left alone
      const kept = request.onlyNew ? fields.filter((field) => field.elements[0]?.hasAttribute("data-resumefit-status")) : [];
      const results = fillForm(fields.filter((field) => !kept.includes(field)), request.values, request.resume, request.coverLetter);
      for (const result of results) {
        const field = fields.find((entry) => entry.id === result.id);
        if (field) highlight(field, result.status);
      }
      const before = kept.map((field) => ({ ...report(field, statusOf(field)), fresh: false }));
      // then the dropdowns that have to be clicked open, which takes a moment each
      void fillDropdowns(document, request.values, request.onlyNew === true)
        .catch(() => [])
        .then((dropdowns) => respond([...before, ...results, ...dropdowns]));
      return true;
    } else if (request.type === "set-field") {
      // one field changed from the side panel, like an edited answer
      const field = fields.find((entry) => entry.id === request.id);
      if (field) {
        // a question matched to a saved answer comes with what kind of answer it is, so choices are picked with the same care
        const result = fillField({ ...field, key: request.key ?? field.key }, request.value, null);
        const done = result === "filled" || result === "review";
        const status = done ? request.status : field.required ? "missing" : "skipped";
        highlight(field, status);
        respond({ ...report(field, status), value: currentValue(field) || (done ? request.value : "") });
      } else {
        // not a normal field, so it may be one of the dropdowns that has to be clicked open
        void setDropdown(document, request.id, request.value, request.key ?? null, request.status)
          .catch(() => null)
          .then(respond);
        return true;
      }
    } else if (request.type === "focus-field") {
      // scrolls to a field and puts the cursor in it, for the Jump to field buttons
      const element = fields.find((entry) => entry.id === request.id)?.elements[0] ?? document.querySelector<HTMLElement>(`[data-resumefit-field="${CSS.escape(request.id)}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus({ preventScroll: true });
      respond(true);
    } else if (request.type === "find-apply") {
      // where this posting's Apply button leads. the link is only read here, never clicked
      respond(findApplyLink(document, location.href));
    } else if (request.type === "read-linkedin") {
      // the profile on screen, read only because the person pressed the import button
      respond(readLinkedinProfile(document, location.href));
    } else if (request.type === "selection") {
      respond(String(getSelection() ?? ""));
    }
    return false;
  });
}
