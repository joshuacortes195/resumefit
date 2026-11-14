import { keyFromWords, labelFor } from "./fields";
import { matchOption } from "./fill";
import { pressAnswer, wouldSubmit } from "./press";
import type { FieldKey, FieldReport, FillStatus } from "./types";

// answers that are not plain form controls: a button that opens a list of choices (workday), a search box that opens one (greenhouse),
// and a pair of Yes and No buttons (ashby). each is answered the way a person would, by opening it and clicking a choice

// what an empty one of these says
const PLACEHOLDER = /^(select( one| an option)?(\.\.\.)?|choose( one)?|please select|--+)?$/i;

// waits for something to be true, checking every few moments, and gives up after a while
async function until<T>(check: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const started = Date.now();
  for (;;) {
    const found = check();
    if (found) return found;
    if (Date.now() - started > timeoutMs) return null;
    await new Promise((done) => setTimeout(done, 60));
  }
}

const words = (element: Element | null | undefined) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
const usable = (element: Element) => !(element as HTMLButtonElement).disabled && !element.closest('[aria-hidden="true"], [hidden]');

// what a choice picked from a list was, and whether it matched the answer for sure
type Picked = { words: string; sure: boolean };

// one of these answers, whatever it is built from
type Widget = {
  element: HTMLElement;
  label: string;
  required: boolean;
  // the choices, when they can be seen without opening anything
  options?: string[];
  // what is chosen right now, empty when nothing is
  shown: () => string;
  choose: (answer: string, key: FieldKey) => Promise<Picked | null>;
};

// the question one of these answers, without the "select one, required" that screen reader labels add
function questionOf(element: Element, doc: Document): string {
  return labelFor(element, doc)
    .replace(/\b(select one|required|optional)\b/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// picks the choice that matches an answer out of a list that is showing
function pick(options: HTMLElement[], answer: string, key: FieldKey): { choice: HTMLElement; sure: boolean } | null {
  const { index, sure } = matchOption(options.map((option) => ({ text: words(option), value: option.getAttribute("data-value") ?? "" })), answer, key);
  const choice = options[index];
  return choice ? { choice, sure } : null;
}

// ---- a button that opens a list ----

// every button style dropdown on the page
export function findDropdowns(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]')].filter(usable);
}

// opens one dropdown, clicks the choice that matches the answer and says what it picked. a list with no clear match is closed again untouched
async function chooseFromButton(button: HTMLElement, answer: string, key: FieldKey, doc: Document): Promise<Picked | null> {
  // a button that could send the form is never pressed, whatever it claims to open
  if (!pressAnswer(button)) return null;
  const options = await until(() => {
    const found = [...doc.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"], [role="option"]')];
    return found.length > 0 ? found : null;
  }, 1500);
  const match = options ? pick(options, answer, key) : null;
  if (match) {
    const picked = words(match.choice);
    match.choice.click();
    return { words: picked, sure: match.sure };
  }
  // nothing fits: close the list the way a person would, and leave the question for them
  const view = doc.defaultView ?? window;
  (doc.activeElement ?? button).dispatchEvent(new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((done) => setTimeout(done, 80));
  // still open: a second click on the button closes it
  if (options?.some((option) => option.isConnected)) button.click();
  return null;
}

function buttonWidget(button: HTMLElement, doc: Document): Widget {
  const label = questionOf(button, doc);
  return {
    element: button,
    label,
    required: button.getAttribute("aria-required") === "true" || /required|\*\s*$/i.test(button.getAttribute("aria-label") ?? "") || /\*\s*$/.test(label),
    shown: () => (PLACEHOLDER.test(words(button)) ? "" : words(button)),
    choose: (answer, key) => chooseFromButton(button, answer, key, doc),
  };
}

// ---- a search box that opens a list ----

// every search box style dropdown on the page
export function findComboboxes(doc: Document): HTMLInputElement[] {
  return [...doc.querySelectorAll<HTMLInputElement>('input[role="combobox"]')].filter(usable);
}

// the box around a search box that also holds what was picked and, once open, the list
function shellOf(input: HTMLElement): HTMLElement {
  let node: HTMLElement = input;
  for (let depth = 0; depth < 6 && node.parentElement; depth++) {
    node = node.parentElement;
    if (/select|combobox|autocomplete|dropdown/i.test(node.className) && node.querySelector('[class*="control"], [class*="indicator"], [role="option"], [role="listbox"]')) return node;
  }
  return input.parentElement ?? input;
}

// the choices a search box is offering right now
function listOf(input: HTMLInputElement, doc: Document): HTMLElement[] {
  const listId = input.getAttribute("aria-controls") ?? input.getAttribute("aria-owns");
  const list = listId ? doc.getElementById(listId) : null;
  const inList = list ? [...list.querySelectorAll<HTMLElement>('[role="option"]')] : [];
  if (inList.length > 0) return inList;
  const near = [...shellOf(input).querySelectorAll<HTMLElement>('[role="option"]')];
  return near.length > 0 ? near : [...doc.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')];
}

// types into a search box the way a person would, without leaving it, so its list stays open
function type(input: HTMLInputElement, text: string): void {
  const view = input.ownerDocument.defaultView ?? window;
  const setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, text);
  else input.value = text;
  input.dispatchEvent(new view.Event("input", { bubbles: true }));
}

// opens a search box, finds the choice that matches the answer and clicks it. with no match the box is left empty and closed
async function chooseFromSearch(input: HTMLInputElement, answer: string, key: FieldKey, doc: Document): Promise<Picked | null> {
  const view = doc.defaultView ?? window;
  const press = (target: Element, event: string) => target.dispatchEvent(new view.MouseEvent(event, { bubbles: true, cancelable: true }));
  // pressing on the box is what opens the list
  input.focus();
  press(shellOf(input).querySelector<HTMLElement>('[class*="control"]') ?? input, "mousedown");
  let options = (await until(() => (listOf(input, doc).length > 0 ? listOf(input, doc) : null), 700)) ?? [];
  let match = pick(options, answer, key);
  if (!match) {
    // a long list, or one that is looked up as you type like a city: type the answer and see what it offers
    type(input, answer);
    options = (await until(() => (listOf(input, doc).some((option) => !/^(loading|no (options|results))/i.test(words(option))) ? listOf(input, doc) : null), 2500)) ?? [];
    match = pick(options, answer, key);
    // a place is offered in the site's own words, so the first one it suggests for what we typed is taken and marked for a look
    const real = options.filter((option) => !/^(loading|no (options|results))/i.test(words(option)));
    if (!match && (key === "location" || key === "city") && real[0]) match = { choice: real[0], sure: false };
  }
  if (match) {
    const picked = words(match.choice);
    press(match.choice, "mousedown");
    // a choice in a list is an answer, never something that sends the form
    if (pressAnswer(match.choice)) return { words: picked, sure: match.sure };
  }
  // nothing fits: clear what was typed and close the list, and leave the question for the person
  if (input.value) type(input, "");
  input.dispatchEvent(new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  input.blur();
  return null;
}

function searchWidget(input: HTMLInputElement, doc: Document): Widget {
  const label = questionOf(input, doc);
  const shell = shellOf(input);
  // what was picked sits next to the box, not in it
  const chosen = () => words(shell.querySelector('[class*="single-value"], [class*="singleValue"], [class*="selected-value"]')) || input.value.trim();
  return {
    element: input,
    label,
    required: input.getAttribute("aria-required") === "true" || input.required || /[*✱]\s*$/.test(label),
    shown: chosen,
    choose: (answer, key) => chooseFromSearch(input, answer, key, doc),
  };
}

// ---- a pair of yes and no buttons ----

// every box on the page that holds exactly a Yes button and a No button
export function findYesNo(doc: Document): HTMLElement[] {
  const groups = new Set<HTMLElement>();
  for (const button of doc.querySelectorAll<HTMLElement>("button")) {
    const parent = button.parentElement;
    // a button that could send a form is never one of these
    if (!parent || !usable(button) || !/^(yes|no)$/i.test(words(button)) || wouldSubmit(button)) continue;
    const said = [...parent.querySelectorAll(":scope > button")].map((entry) => words(entry).toLowerCase()).sort();
    if (said.length === 2 && said[0] === "no" && said[1] === "yes") groups.add(parent);
  }
  return [...groups];
}

function yesNoWidget(group: HTMLElement, doc: Document): Widget {
  const buttons = [...group.querySelectorAll<HTMLElement>(":scope > button")];
  const label = questionOf(group, doc);
  const on = (button: HTMLElement) => button.getAttribute("aria-pressed") === "true" || button.getAttribute("aria-checked") === "true" || /\b(active|selected|checked)\b/i.test(button.className);
  return {
    element: group,
    label,
    // the form marks these as required on the question, in a class or with a star
    required: /[*✱]\s*$/.test(label) || group.parentElement?.querySelector('[class*="required"]') != null,
    options: ["Yes", "No"],
    shown: () => words(buttons.find(on)),
    choose: async (answer) => {
      const wanted = /^\s*yes\b/i.test(answer) ? "yes" : /^\s*no\b/i.test(answer) ? "no" : null;
      const button = buttons.find((entry) => words(entry).toLowerCase() === wanted);
      // the guard lets a plain yes or no answer through and nothing that could send the form
      return button && pressAnswer(button) ? { words: words(button), sure: true } : null;
    },
  };
}

// ---- all of them together ----

// every answer on the page that is not a plain form control, in the order they appear
function findWidgets(doc: Document): Widget[] {
  const found: Widget[] = [...findDropdowns(doc).map((button) => buttonWidget(button, doc)), ...findComboboxes(doc).map((input) => searchWidget(input, doc)), ...findYesNo(doc).map((group) => yesNoWidget(group, doc))];
  return found.sort((a, b) => (a.element.compareDocumentPosition(b.element) & 4 ? -1 : 1));
}

// the outline color, the same colors as every other field
const colorOf = (status: FillStatus) => (status === "filled" ? "#15803d" : status === "review" ? "#ca8a04" : status === "missing" ? "#b91c1c" : "");

function mark(widget: Widget, status: FillStatus): void {
  widget.element.setAttribute("data-resumefit-status", status);
  // a search box is tiny, so the color goes on the box around it
  const box = widget.element instanceof HTMLInputElement ? shellOf(widget.element) : widget.element;
  box.style.outline = colorOf(status) ? `2px solid ${colorOf(status)}` : "";
  box.style.outlineOffset = colorOf(status) ? "2px" : "";
}

// answers one of these that was matched to a saved answer after the first pass. null when there is no such thing on the page
export async function setDropdown(doc: Document, id: string, value: string, key: FieldKey | null, status: FillStatus): Promise<FieldReport | null> {
  const widget = findWidgets(doc).find((entry) => entry.element.getAttribute("data-resumefit-field") === id);
  if (!widget) return null;
  const picked = await widget.choose(value, key ?? "question");
  const result: FillStatus = picked ? status : widget.required ? "missing" : "skipped";
  mark(widget, result);
  return { id, key, label: widget.label || "Dropdown", kind: "select", required: widget.required, status: result, value: picked?.words ?? "", ...(widget.options ? { options: widget.options } : {}) };
}

// answers these from the profile, one at a time, the way a person would click through them
export async function fillDropdowns(doc: Document, values: Partial<Record<FieldKey, string>>, onlyNew: boolean): Promise<FieldReport[]> {
  const reports: FieldReport[] = [];
  for (const [index, widget] of findWidgets(doc).entries()) {
    const element = widget.element;
    const id = element.getAttribute("data-resumefit-field") ?? `rf-d-${index}`;
    element.setAttribute("data-resumefit-field", id);
    const key = keyFromWords([widget.label, element.id, element.getAttribute("name") ?? ""]);
    let status = (element.getAttribute("data-resumefit-status") as FillStatus | null) ?? null;
    // the choice we clicked, kept because the page often shows it a moment later
    let picked = "";

    // ones already dealt with are left as they are when we are only filling what is new
    const skip = onlyNew && status !== null;
    if (!skip) {
      // a box that asks for a city usually wants to find the place, and "Portland, Oregon" finds it better than "Portland"
      const answer = key && key !== "question" ? (key === "city" && values.location ? values.location : values[key]) : undefined;
      const empty = widget.shown() === "";
      if (answer && key && empty) {
        const choice = await widget.choose(answer, key);
        picked = choice?.words ?? "";
        // a choice that only roughly matched is marked for the person to check
        status = choice ? (choice.sure ? "filled" : "review") : widget.required ? "missing" : "skipped";
      } else status = !empty ? "filled" : widget.required ? "missing" : "skipped";
      mark(widget, status);
    }
    reports.push({ id, key, label: widget.label || "Dropdown", kind: "select", required: widget.required, status: status ?? "skipped", value: widget.shown() || picked, fresh: !skip, ...(widget.options ? { options: widget.options } : {}) });
  }
  return reports;
}
