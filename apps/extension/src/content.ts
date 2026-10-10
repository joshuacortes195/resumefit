import { adapterFor } from "./lib/adapters";
import { findFields, looksLikeApplication, type FormField } from "./lib/fields";
import { currentValue, fillField, fillForm, highlight } from "./lib/fill";
import { hasCaptcha, looksConfirmed, readJob } from "./lib/job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./lib/linkedin-page";
import type { FieldReport, PageInfo, PageRequest } from "./lib/types";

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
    } else if (request.type === "selection") {
      respond(String(getSelection() ?? ""));
    }
    return false;
  });
}
