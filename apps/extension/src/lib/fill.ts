import type { FormField } from "./fields";
import { DECLINE_PATTERN, normalize } from "./synonyms";
import type { FieldKey, FieldReport, FillStatus } from "./types";

// keys where the answer is a personal choice we must never guess at
const EEO_KEYS: FieldKey[] = ["eeoGender", "eeoHispanic", "eeoRace", "eeoVeteran", "eeoDisability"];

// sets a value the way typing would, so react, vue and angular forms all notice it
export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const view = element.ownerDocument.defaultView ?? window;
  const prototype = element instanceof view.HTMLTextAreaElement ? view.HTMLTextAreaElement.prototype : element instanceof view.HTMLSelectElement ? view.HTMLSelectElement.prototype : view.HTMLInputElement.prototype;
  // frameworks replace the value setter on the element itself, the original one on the prototype is the one that counts
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new view.Event("input", { bubbles: true }));
  element.dispatchEvent(new view.Event("change", { bubbles: true }));
  element.dispatchEvent(new view.Event("blur", { bubbles: true }));
}

// finds the option that means the same as our answer, or null when none clearly does
export function pickOption(options: { text: string; value: string }[], answer: string, key: FieldKey | null): number {
  const wanted = normalize(answer);
  const texts = options.map((option) => normalize(option.text));
  const real = (index: number) => texts[index] !== "" && !/^(select|choose|please select|--)/.test(texts[index] ?? "");

  // "decline to self identify" is worded differently on every form
  if (DECLINE_PATTERN.test(answer)) return texts.findIndex((text, index) => real(index) && DECLINE_PATTERN.test(text));

  const exact = texts.findIndex((text, index) => real(index) && (text === wanted || normalize(options[index]?.value ?? "") === wanted));
  if (exact !== -1) return exact;

  // yes and no answers match options that start with the word
  if (wanted === "yes" || wanted === "no") return texts.findIndex((text, index) => real(index) && new RegExp(`^${wanted}\\b`).test(text));

  // demographic answers have to match closely or not at all
  if (key && EEO_KEYS.includes(key)) return texts.findIndex((text, index) => real(index) && (text.startsWith(wanted) || wanted.startsWith(text)));

  // otherwise an option that contains the answer, or the other way round, like "United States" and "United States of America"
  return texts.findIndex((text, index) => real(index) && text.length > 1 && (text.includes(wanted) || wanted.includes(text)));
}

// puts a file into a file input, the same way dropping one on it would
export function attachFile(input: HTMLInputElement, file: { name: string; type: string; base64: string }): boolean {
  try {
    const view = input.ownerDocument.defaultView ?? window;
    const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
    const transfer = new view.DataTransfer();
    transfer.items.add(new view.File([bytes], file.name, { type: file.type }));
    input.files = transfer.files;
    input.dispatchEvent(new view.Event("input", { bubbles: true }));
    input.dispatchEvent(new view.Event("change", { bubbles: true }));
    return (input.files?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// the words next to one radio button or checkbox
function optionText(element: Element): string {
  const doc = element.ownerDocument;
  const byFor = element.id ? [...doc.querySelectorAll("label")].find((label) => label.getAttribute("for") === element.id) : null;
  return (byFor?.textContent ?? element.closest("label")?.textContent ?? element.getAttribute("aria-label") ?? element.getAttribute("value") ?? "").replace(/\s+/g, " ").trim();
}

// what is in a field right now, as text the side panel can show
export function currentValue(field: FormField): string {
  const [first] = field.elements;
  if (!first) return "";
  if (field.kind === "radio" || field.kind === "checkbox") {
    return field.elements
      .filter((element) => (element as HTMLInputElement).checked)
      .map(optionText)
      .join(", ");
  }
  if (field.kind === "file") return (first as HTMLInputElement).files?.[0]?.name ?? "";
  if (field.kind === "select") {
    const select = first as HTMLSelectElement;
    const chosen = select.options[select.selectedIndex];
    return chosen && chosen.value !== "" ? chosen.text.trim() : "";
  }
  return first.value;
}

// the choices a dropdown or a group of radio buttons offers, as the words on them
export function optionsOf(field: FormField): string[] | undefined {
  const texts =
    field.kind === "select"
      ? [...(field.elements[0] as HTMLSelectElement).options].filter((option) => option.value !== "").map((option) => option.text)
      : field.kind === "radio" || field.kind === "checkbox"
        ? field.elements.map(optionText)
        : [];
  const clean = texts.map((text) => text.replace(/\s+/g, " ").trim().slice(0, 80)).filter(Boolean);
  return clean.length > 0 ? clean.slice(0, 15) : undefined;
}

// fills one field with an answer and says how it went
export function fillField(field: FormField, answer: string | undefined, resume: { name: string; type: string; base64: string } | null): FillStatus {
  const [first] = field.elements;
  if (!first) return "skipped";
  const empty: FillStatus = field.required ? "missing" : "skipped";

  if (field.kind === "file") {
    if (field.key !== "resume" || !resume) return empty;
    return attachFile(first as HTMLInputElement, resume) ? "filled" : "missing";
  }
  if (!answer) return empty;

  if (field.kind === "select") {
    const select = first as HTMLSelectElement;
    const index = pickOption([...select.options].map((option) => ({ text: option.text, value: option.value })), answer, field.key);
    if (index === -1) return empty;
    setNativeValue(select, select.options[index]?.value ?? "");
    return "filled";
  }

  if (field.kind === "radio" || field.kind === "checkbox") {
    const index = pickOption(field.elements.map((element) => ({ text: optionText(element), value: element.getAttribute("value") ?? "" })), answer, field.key);
    const choice = field.elements[index] as HTMLInputElement | undefined;
    if (!choice) return empty;
    // click is what a person would do, and what the form's own code listens for
    if (!choice.checked) choice.click();
    return "filled";
  }

  setNativeValue(first as HTMLInputElement | HTMLTextAreaElement, answer);
  return "filled";
}

// fills every field we have an answer for. it never presses submit, next or anything else that moves the form along
export function fillForm(fields: FormField[], values: Partial<Record<FieldKey, string>>, resume: { name: string; type: string; base64: string } | null): FieldReport[] {
  return fields.map((field) => {
    // free text questions are answered one at a time from the side panel, where the person can read each draft
    const answer = field.key && field.key !== "question" ? values[field.key] : undefined;
    const status = field.key === "question" ? (field.required ? "missing" : "skipped") : fillField(field, answer, resume);
    // some sites show the value a moment later, or in a way we cannot read back. what we put in is shown then, so a filled field never reads as empty
    const put = field.kind === "file" ? (resume?.name ?? "") : (answer ?? "");
    return { id: field.id, key: field.key, label: field.label, kind: field.kind, required: field.required, status, value: currentValue(field) || (status === "filled" ? put : ""), options: optionsOf(field) };
  });
}

// the colors drawn around fields after autofill
const OUTLINES: Record<FillStatus, string> = { filled: "#15803d", review: "#b45309", missing: "#b91c1c", skipped: "" };

// draws a colored outline on a field so the person can see at a glance what needs their eyes
export function highlight(field: FormField, status: FillStatus): void {
  for (const element of field.elements) {
    // radio buttons and checkboxes are tiny, so their wrapper gets the outline
    const target = field.kind === "radio" || field.kind === "checkbox" ? (element.closest("label") ?? element) : element;
    (target as HTMLElement).style.outline = OUTLINES[status] ? `2px solid ${OUTLINES[status]}` : "";
    (target as HTMLElement).style.outlineOffset = OUTLINES[status] ? "2px" : "";
    element.setAttribute("data-resumefit-status", status);
  }
}
