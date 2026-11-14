// the one place the extension presses a form's Submit button.
// it is only reached when the person has switched sending on in their application profile, and it refuses whenever it is not sure which button sends the form

import { fillBlocked } from "./blocked";
import { hasCaptcha } from "./job-page";
import type { SubmitResult } from "./types";

// what the button that sends an application says, and nothing longer than that
const SENDS = /^(submit|submit( my| your| the)? application|apply|apply now|send application|submit and apply)$/i;

// the words on a button
function wordsOn(element: Element): string {
  return (element.textContent || element.getAttribute("value") || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
}

// true when the button is hidden or switched off
function unusable(element: Element): boolean {
  return element.closest("[hidden], [aria-hidden='true']") !== null || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

// the button that sends the form. null unless there is exactly one, so two look-alikes never get a guess
export function findSubmit(doc: Document): HTMLElement | null {
  // the form our fields are in, when the page has one
  const form = doc.querySelector("[data-resumefit-field]")?.closest("form") ?? null;
  const within: ParentNode = form ?? doc;
  const found = [...within.querySelectorAll<HTMLElement>('button, input[type="submit"]')].filter((button) => !unusable(button) && SENDS.test(wordsOn(button)));
  return found.length === 1 ? (found[0] ?? null) : null;
}

// presses Submit on the form, or says why it would not
export function pressSubmit(doc: Document, hostname: string): SubmitResult {
  // never on a site whose rules forbid it, and never past a captcha
  if (fillBlocked(hostname)) return { pressed: false, reason: "This site does not allow tools to send applications." };
  if (hasCaptcha(doc)) return { pressed: false, reason: "The form has a captcha, which only you can do." };
  const button = findSubmit(doc);
  if (!button) return { pressed: false, reason: "We could not tell which button sends this form." };
  button.click();
  return { pressed: true };
}
