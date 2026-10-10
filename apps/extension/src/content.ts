import { adapterFor } from "./lib/adapters";
import { findApplyLink } from "./lib/apply-link";
import { showBar, tickBar } from "./lib/bar";
import { fillDropdowns, setDropdown } from "./lib/dropdowns";
import { findFields, looksLikeApplication, type FormField } from "./lib/fields";
import { currentValue, fillField, fillForm, highlight, optionsOf } from "./lib/fill";
import { hasCaptcha, looksConfirmed, readJob } from "./lib/job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./lib/linkedin-page";
import { pressSubmit } from "./lib/submit";
import type { BarState, FieldReport, PageInfo, PageRequest, WorkerRequest } from "./lib/types";

// this file is put into the page only when the person asks for it. it reads and fills.
// it presses Submit only when the person switched on "Submit for me", after a countdown they can cancel

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
  const waiting = [...document.querySelectorAll<HTMLElement>('[data-resumefit-status="missing"], [data-resumefit-status="review"]')];
  if (waiting.length === 0) return;
  cursor = (cursor + 1) % waiting.length;
  waiting[cursor]?.scrollIntoView({ behavior: "smooth", block: "center" });
  waiting[cursor]?.focus({ preventScroll: true });
}

// true once we are watching the page for what happens next
let watching = false;

// true once this page has been filled in, which is when a thank you message starts to mean something
let wasFilled = false;

// how many times this page has asked for more filling, so a page that keeps changing cannot keep us busy forever
let asked = 0;

// keeps an eye on the page after we have looked at it, for the two things that happen without a new page loading:
// the form being swapped for a thank you message, and new questions showing up, like the next step of a long form
function watchPage(filled: boolean): void {
  wasFilled = wasFilled || filled;
  if (watching) return;
  watching = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    // wait for the page to settle before reading it
    clearTimeout(timer);
    timer = setTimeout(() => {
      const found = findFields(document, adapterFor(location.hostname));
      const isForm = looksLikeApplication(found);
      if (wasFilled && !isForm && looksConfirmed(document)) {
        observer.disconnect();
        return tellWorker({ type: "rf-confirmed" });
      }
      // fields nobody has dealt with yet. two or more means a new step opened, one is usually just a search box
      const fresh = found.filter((field) => !field.elements[0]?.hasAttribute("data-resumefit-status")).length;
      const formNow = isForm || (wasFilled && found.length > 0);
      if (formNow && fresh >= 2 && asked < 15) {
        asked++;
        tellWorker({ type: "rf-more" });
      }
    }, 1200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// what the bar's buttons do
const barActions = { onNext: showNext, onRefill: () => tellWorker({ type: "rf-refill" }) };

// counts down on the bar, then presses the site's Submit button. Cancel hands the application back to the person
function countDownToSubmit(seconds: number, done: BarState): void {
  let left = seconds;
  let timer: ReturnType<typeof setTimeout> | undefined;
  showBar(document, { state: "sending", seconds: left }, {
    ...barActions,
    onCancel: () => {
      clearTimeout(timer);
      showBar(document, done, barActions);
    },
  });
  const tick = () => {
    left--;
    if (left > 0) {
      tickBar(document, left);
      timer = setTimeout(tick, 1000);
      return;
    }
    const result = pressSubmit(document, fields);
    if (!result.sent) return showBar(document, { state: "held", message: result.reason }, barActions);
    showBar(document, { state: "sent" }, barActions);
    // if the site never says thanks, say so and leave it with the person
    setTimeout(() => {
      if (!looksConfirmed(document)) showBar(document, { state: "held", message: "We pressed Submit but the site has not confirmed it. Check the page for anything it is asking for." }, barActions);
    }, 12_000);
  };
  timer = setTimeout(tick, 1000);
}

if (!window.__resumefitLoaded) {
  window.__resumefitLoaded = true;

  chrome.runtime.onMessage.addListener((request: PageRequest, _sender, respond) => {
    if (request.type === "read-page") {
      respond(readPage());
    } else if (request.type === "autofill") {
      // look again first, forms like workday swap their fields as you move between pages
      fields = findFields(document, adapterFor(location.hostname));
      // on a later step of a long form, what was already filled or fixed by the person is left alone
      const kept = request.onlyNew ? fields.filter((field) => field.elements[0]?.hasAttribute("data-resumefit-status")) : [];
      const results = fillForm(fields.filter((field) => !kept.includes(field)), request.values, request.resume);
      for (const result of results) {
        const field = fields.find((entry) => entry.id === result.id);
        if (field) highlight(field, result.status);
      }
      const before = kept.map((field) => ({ ...report(field, (field.elements[0]?.getAttribute("data-resumefit-status") as FieldReport["status"] | null) ?? "skipped"), fresh: false }));
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
        const done = fillField({ ...field, key: request.key ?? field.key }, request.value, null) === "filled";
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
      const element = fields.find((entry) => entry.id === request.id)?.elements[0] ?? document.querySelector<HTMLElement>(`[data-resumefit-field="${CSS.escape(request.id)}"]`);
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
      showBar(document, request.bar, barActions);
      if (request.bar.state === "done" || request.bar.state === "no-form") watchPage(request.bar.state === "done");
      respond(true);
    } else if (request.type === "auto-submit") {
      watchPage(true);
      countDownToSubmit(request.seconds, request.done);
      respond(true);
    } else if (request.type === "selection") {
      respond(String(getSelection() ?? ""));
    }
    return false;
  });
}
