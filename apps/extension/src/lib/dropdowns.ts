import { labelFor } from "./fields";
import { pickOption } from "./fill";
import { matchKey } from "./synonyms";
import type { FieldKey, FieldReport, FillStatus } from "./types";

// dropdowns that are not real select boxes: a button that opens a list of choices, the way workday and other newer forms build them

// what an empty one of these says on its button
const PLACEHOLDER = /^(select( one| an option)?|choose( one)?|please select|--+)?$/i;

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

// the question a dropdown button answers, without the "select one, required" that screen reader labels add
function questionOf(button: Element, doc: Document): string {
  return labelFor(button, doc)
    .replace(/\b(select one|required|optional)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// every button style dropdown on the page
export function findDropdowns(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]')].filter((button) => !(button as HTMLButtonElement).disabled && !button.closest('[aria-hidden="true"], [hidden]'));
}

// opens one dropdown, clicks the choice that matches the answer and says how it went. a list with no clear match is closed again untouched
async function choose(button: HTMLElement, answer: string, key: FieldKey, doc: Document): Promise<string | null> {
  button.click();
  const options = await until(() => {
    const found = [...doc.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"], [role="option"]')];
    return found.length > 0 ? found : null;
  }, 1500);
  const index = options ? pickOption(options.map((option) => ({ text: (option.textContent ?? "").replace(/\s+/g, " ").trim(), value: option.getAttribute("data-value") ?? "" })), answer, key) : -1;
  const choice = options?.[index];
  if (choice) {
    const words = (choice.textContent ?? "").replace(/\s+/g, " ").trim();
    choice.click();
    return words;
  }
  // nothing fits: close the list the way a person would, and leave the question for them
  const view = doc.defaultView ?? window;
  (doc.activeElement ?? button).dispatchEvent(new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((done) => setTimeout(done, 80));
  // still open: a second click on the button closes it
  if (options?.some((option) => option.isConnected)) button.click();
  return null;
}

// answers one dropdown that was matched to a saved answer after the first pass. null when there is no such dropdown
export async function setDropdown(doc: Document, id: string, value: string, key: FieldKey | null, status: FillStatus): Promise<FieldReport | null> {
  const button = findDropdowns(doc).find((entry) => entry.getAttribute("data-resumefit-field") === id);
  if (!button) return null;
  const required = button.getAttribute("aria-required") === "true" || /required/i.test(button.getAttribute("aria-label") ?? "");
  const picked = await choose(button, value, key ?? "question", doc);
  const result: FillStatus = picked ? status : required ? "missing" : "skipped";
  button.setAttribute("data-resumefit-status", result);
  const color = result === "filled" ? "#15803d" : result === "review" ? "#b45309" : result === "missing" ? "#b91c1c" : "";
  button.style.outline = color ? `2px solid ${color}` : "";
  button.style.outlineOffset = color ? "2px" : "";
  return { id, key, label: questionOf(button, doc) || "Dropdown", kind: "select", required, status: result, value: picked ?? "" };
}

// answers the button style dropdowns from the profile, one at a time, the way a person would click through them
export async function fillDropdowns(doc: Document, values: Partial<Record<FieldKey, string>>, onlyNew: boolean): Promise<FieldReport[]> {
  const reports: FieldReport[] = [];
  for (const [index, button] of findDropdowns(doc).entries()) {
    const id = button.getAttribute("data-resumefit-field") ?? `rf-d-${index}`;
    button.setAttribute("data-resumefit-field", id);
    const label = questionOf(button, doc);
    const key = matchKey([label, button.id, button.getAttribute("name") ?? ""]);
    const required = button.getAttribute("aria-required") === "true" || /required|\*\s*$/i.test(button.getAttribute("aria-label") ?? "") || /\*\s*$/.test(label);
    const shown = () => (button.textContent ?? "").replace(/\s+/g, " ").trim();
    let status = (button.getAttribute("data-resumefit-status") as FillStatus | null) ?? null;
    // the choice we clicked, kept because the button often shows it a moment later
    let picked = "";

    // ones already dealt with are left as they are when we are only filling what is new
    const skip = onlyNew && status !== null;
    if (!skip) {
      const answer = key && key !== "question" ? values[key] : undefined;
      const empty = PLACEHOLDER.test(shown());
      if (answer && key && empty) {
        picked = (await choose(button, answer, key, doc)) ?? "";
        status = picked ? "filled" : required ? "missing" : "skipped";
      }
      else status = !empty ? "filled" : required ? "missing" : "skipped";
      button.setAttribute("data-resumefit-status", status);
      // the same colors as every other field
      const color = status === "filled" ? "#15803d" : status === "missing" ? "#b91c1c" : "";
      button.style.outline = color ? `2px solid ${color}` : "";
      button.style.outlineOffset = color ? "2px" : "";
    }
    reports.push({ id, key, label: label || "Dropdown", kind: "select", required, status: status ?? "skipped", value: PLACEHOLDER.test(shown()) ? picked : shown(), fresh: !skip });
  }
  return reports;
}
