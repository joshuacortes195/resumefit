import type { Adapter } from "./adapters";
import { AUTOCOMPLETE, matchKey } from "./synonyms";
import type { FieldKey, FieldReport } from "./types";

// a form control, or a group of radio buttons or checkboxes that answer one question
export type FormField = {
  id: string;
  key: FieldKey | null;
  label: string;
  kind: FieldReport["kind"];
  required: boolean;
  // one element, or every option of a radio or checkbox group
  elements: (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// input types that are never something to fill in
const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "password", "search", "range", "color"]);

// the text of an element with the extra white space squeezed out
function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// the visible label for one control, tried from the most trustworthy source down
export function labelFor(control: Element, doc: Document): string {
  const aria = control.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();
  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => textOf(doc.getElementById(id)))
      .join(" ")
      .trim();
    if (text) return text;
  }
  if (control.id) {
    const label = [...doc.querySelectorAll("label")].find((entry) => entry.getAttribute("for") === control.id);
    if (label && textOf(label)) return textOf(label);
  }
  const wrapping = control.closest("label");
  if (wrapping && textOf(wrapping)) return textOf(wrapping);
  // some forms put the question in a sibling right before the input, or right before the box the input sits in
  let node: Element | null = control;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    const previous = node.previousElementSibling;
    if (previous && /^(LABEL|SPAN|DIV|P)$/.test(previous.tagName) && !previous.querySelector("input, select, textarea") && textOf(previous) && textOf(previous).length < 200) return textOf(previous);
    if (previous) break;
  }
  return control.getAttribute("placeholder")?.trim() ?? "";
}

// the question a group of radio buttons or checkboxes is answering
function groupLabel(control: Element, doc: Document): string {
  const fieldset = control.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend && textOf(legend)) return textOf(legend);
  const group = control.closest('[role="radiogroup"], [role="group"]');
  if (group) {
    const label = labelFor(group, doc);
    if (label) return label;
  }
  // otherwise the first bit of text inside the smallest box that holds every option
  const name = control.getAttribute("name") ?? "";
  const total = name ? doc.querySelectorAll(`input[name="${CSS.escape(name)}"]`).length : 1;
  let parent = control.parentElement;
  for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
    if (name && parent.querySelectorAll(`input[name="${CSS.escape(name)}"]`).length < total) continue;
    const heading = [...parent.children].find((child) => !child.querySelector("input, select, textarea") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(child.tagName) && textOf(child));
    if (heading) return textOf(heading);
  }
  return "";
}

// true when the form marks this field as one that has to be answered
function isRequired(control: Element, label: string): boolean {
  return control.hasAttribute("required") || control.getAttribute("aria-required") === "true" || /\*\s*$|\(required\)/i.test(label);
}

// finds every field on the page and works out what each one is asking for
export function findFields(doc: Document, adapter: Adapter): FormField[] {
  const controls = [...doc.querySelectorAll<Control>("input, select, textarea")].filter((control) => {
    if (control instanceof HTMLInputElement && SKIP_TYPES.has(control.type)) return false;
    return !control.disabled && !control.closest('[aria-hidden="true"], [hidden]');
  });

  const fields: FormField[] = [];
  const groups = new Map<string, FormField>();

  for (const control of controls) {
    const type = control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase();
    const isChoice = type === "radio" || type === "checkbox";
    const name = control.getAttribute("name") ?? "";

    // radio buttons and same named checkboxes are one question with several answers
    const grouped = isChoice && name !== "" && (type === "radio" || doc.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(name)}"]`).length > 1);
    if (grouped) {
      const existing = groups.get(name);
      if (existing) {
        existing.elements.push(control);
        continue;
      }
    }
    // a lone checkbox is a promise only the person can make, like "I agree to the terms"
    if (type === "checkbox" && !grouped) continue;

    const label = grouped ? groupLabel(control, doc) || labelFor(control, doc) : labelFor(control, doc);
    // adapter hints first, then the browser's own hint, then the words around the field
    const hinted = adapter.hints.find((hint) => control.matches(hint.selector))?.key ?? null;
    const autocomplete = AUTOCOMPLETE[(control.getAttribute("autocomplete") ?? "").split(" ").at(-1) ?? ""] ?? null;
    let key: FieldKey | null = hinted ?? autocomplete ?? matchKey([label, name, control.id, control.getAttribute("placeholder") ?? ""]);

    const kind: FormField["kind"] = type === "file" ? "file" : type === "radio" ? "radio" : type === "checkbox" ? "checkbox" : type === "select" || type === "select-one" ? "select" : type === "textarea" ? "textarea" : "text";
    // file inputs we do not recognize are assumed to want the resume only when nothing else on the page does
    if (kind === "file" && key !== "resume" && key !== "coverLetter") key = null;
    // long free text questions get an answer drafted for them
    if (!key && (kind === "textarea" || (kind === "text" && /\?\s*\*?$/.test(label) && label.length > 25))) key = "question";
    // big text boxes are always a question to answer in words, whatever their placeholder says
    if (kind === "textarea" && !hinted) key = "question";

    const field: FormField = { id: `rf-${fields.length}`, key, label: label || name || control.id || "Unlabelled field", kind, required: isRequired(control, label), elements: [control] };
    for (const element of field.elements) element.setAttribute("data-resumefit-field", field.id);
    fields.push(field);
    if (grouped) groups.set(name, field);
  }

  // grouped options share their group's id
  for (const field of groups.values()) for (const element of field.elements) element.setAttribute("data-resumefit-field", field.id);

  // if there is exactly one unclaimed file input and no resume field, it is the resume
  if (!fields.some((field) => field.key === "resume")) {
    const loose = fields.filter((field) => field.kind === "file" && field.key === null);
    if (loose.length === 1 && loose[0]) loose[0].key = "resume";
  }
  return fields;
}

// true when the fields look like a job application and not, say, a newsletter box
export function looksLikeApplication(fields: FormField[]): boolean {
  const keys = new Set(fields.map((field) => field.key));
  const hasName = keys.has("firstName") || keys.has("fullName") || keys.has("lastName");
  return (hasName && keys.has("email")) || keys.has("resume");
}
