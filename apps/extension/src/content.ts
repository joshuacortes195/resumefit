import { adapterFor } from "./lib/adapters";
import { findApplyLink } from "./lib/apply-link";
import { showBar } from "./lib/bar";
import { findFields, looksLikeApplication, type FormField } from "./lib/fields";
import { currentValue, fillField, fillForm, highlight } from "./lib/fill";
import { hasCaptcha, looksConfirmed, readJob } from "./lib/job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./lib/linkedin-page";
import type { FieldReport, PageInfo, PageRequest, WorkerRequest } from "./lib/types";

// this file is put into the page only when the person asks for it. it reads and fills, and never submits anything

declare global {
  interface Window {
    __resumefitLoaded?: boolean;
  }
}

// the fields found on the last look at the page
let fields: FormField[] = [];

// what we can tell the side panel about a field right now
function report(field: FormField, status: FieldReport["status"]): FieldReport {
  return { id: field.id, key: field.key, label: field.label, kind: field.kind, required: field.required, status, value: currentValue(field) };
}

// looks the page over: is it a job posting, is it an application form, which system is it
function readPage(): PageInfo {
  const adapter = adapterFor(location.hostname);
  fields = findFields(document, adapter);
  const hasForm = looksLikeApplication(fields);
  return {
    url: location.href,
    ats: adapter.id === "generic" ? null : { id: adapter.id, name: adapter.name },
    job: readJob(document, location.href),
    hasForm,
    fields: hasForm ? fields.map((field) => report(field, (field.elements[0]?.getAttribute("data-resumefit-status") as FieldReport["status"] | null) ?? "skipped")) : [],
    captcha: hasCaptcha(document),
    confirmed: looksConfirmed(document),
    linkedinProfile: isLinkedinProfile(location.href),
  };
}

// tells the background worker something happened on this page
const tellWorker = (message: WorkerRequest) => void chrome.runtime.sendMessage(message).catch(() => undefined);

// which field the bar's "Show next" button stopped on last
let cursor = -1;

// scrolls to the next field that still wants the person's eyes
function showNext(): void {
  const waiting = fields.filter((field) => /^(missing|review)$/.test(field.elements[0]?.getAttribute("data-resumefit-status") ?? ""));
  if (waiting.length === 0) return;
  cursor = (cursor + 1) % waiting.length;
  const element = waiting[cursor]?.elements[0];
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  element?.focus({ preventScroll: true });
}

// true once we are watching for the "thanks for applying" page
let watching = false;

// after a fill, keeps an eye out for the form being swapped for a thank you message, on sites that never load a new page
function watchForConfirmation(): void {
  if (watching || looksConfirmed(document)) return;
  watching = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    // wait for the page to settle before reading it
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!looksConfirmed(document) || looksLikeApplication(findFields(document, adapterFor(location.hostname)))) return;
      observer.disconnect();
      tellWorker({ type: "rf-confirmed" });
    }, 1200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (!window.__resumefitLoaded) {
  window.__resumefitLoaded = true;

  chrome.runtime.onMessage.addListener((request: PageRequest, _sender, respond) => {
    if (request.type === "read-page") {
      respond(readPage());
    } else if (request.type === "autofill") {
      // look again first, forms like workday swap their fields as you move between pages
      fields = findFields(document, adapterFor(location.hostname));
      const results = fillForm(fields, request.values, request.resume);
      for (const result of results) {
        const field = fields.find((entry) => entry.id === result.id);
        if (field) highlight(field, result.status);
      }
      respond(results);
    } else if (request.type === "set-field") {
      // one field changed from the side panel, like an edited answer
      const field = fields.find((entry) => entry.id === request.id);
      if (field) {
        const status = fillField(field, request.value, null) === "filled" ? request.status : "missing";
        highlight(field, status);
        respond(report(field, status));
      } else respond(null);
    } else if (request.type === "focus-field") {
      const element = fields.find((entry) => entry.id === request.id)?.elements[0];
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus({ preventScroll: true });
      respond(true);
    } else if (request.type === "read-linkedin") {
      // the profile on screen, read only because the person pressed the import button
      respond(readLinkedinProfile(document, location.href));
    } else if (request.type === "find-apply") {
      // where this posting's Apply button leads
      respond(findApplyLink(document, location.href));
    } else if (request.type === "show-bar") {
      showBar(document, request.bar, { onNext: showNext, onRefill: () => tellWorker({ type: "rf-refill" }) });
      if (request.bar.state === "done") watchForConfirmation();
      respond(true);
    } else if (request.type === "selection") {
      respond(String(getSelection() ?? ""));
    }
    return false;
  });
}
