import type { FormField } from "./fields";

// what the button that sends an application says. Next and Continue are never on this list
const SUBMIT_TEXT = /^(submit|submit application|submit my application|submit your application|send application|send my application|apply|apply now)$/i;

// buttons that sit next to Submit and must never be pressed for the person
const NOT_SUBMIT = /cancel|back|previous|save|draft|next|continue|upload|attach|remove|delete|sign in|log in/i;

// the words on a button
function wordsOn(button: Element): string {
  return (button.textContent || button.getAttribute("value") || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
}

// the form most of the fields we filled sit in, null when the site does not use a real form
function formOf(fields: FormField[]): HTMLFormElement | null {
  const counts = new Map<HTMLFormElement, number>();
  for (const field of fields) {
    const form = field.elements[0]?.closest("form");
    if (form) counts.set(form, (counts.get(form) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// finds the one button that sends the application, null when we cannot be sure which it is
export function findSubmit(doc: Document, fields: FormField[]): HTMLElement | null {
  const form = formOf(fields);
  const buttons = [...(form ?? doc).querySelectorAll<HTMLElement>('button, input[type="submit"]')].filter((button) => !(button as HTMLButtonElement).disabled && !NOT_SUBMIT.test(wordsOn(button)));
  // a button that says so in plain words wins, then the form's own submit button when it has exactly one
  const named = buttons.filter((button) => SUBMIT_TEXT.test(wordsOn(button)));
  if (named.length === 1) return named[0] ?? null;
  const typed = form ? buttons.filter((button) => button.getAttribute("type") === "submit") : [];
  return named.length === 0 && typed.length === 1 ? (typed[0] ?? null) : null;
}

// how pressing submit went. held means we left it for the person, with the reason
export type SubmitResult = { sent: true } | { sent: false; reason: string };

// presses the site's own Submit button, the same as a click would. only ever called when the person switched this on
export function pressSubmit(doc: Document, fields: FormField[]): SubmitResult {
  // anything still marked for checking means the person sends it
  if (fields.some((field) => /^(missing|review)$/.test(field.elements[0]?.getAttribute("data-resumefit-status") ?? ""))) return { sent: false, reason: "A field still needs checking, so this one is yours to send." };
  const button = findSubmit(doc, fields);
  if (!button) return { sent: false, reason: "We could not tell which button sends this form, so it is yours to press." };
  // the form's own rules get the last word, like a box that has to be ticked by you
  const form = formOf(fields);
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return { sent: false, reason: "The form says something is still missing. Fix what it points at, then press Submit." };
  }
  button.click();
  return { sent: true };
}
