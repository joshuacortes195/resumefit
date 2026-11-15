// the one place the extension is allowed to click something on a page.
// it clicks answers (a radio button, a checkbox, a choice in a dropdown list, the button that opens that list, a Yes or No button in a pair) and nothing else.
// anything that could send the form, or move it to its next page, is refused, so the person is always the one who submits

// what the buttons that send or move an application say
const MOVES_FORM = /\b(submit|apply|send|next|continue|finish|save|confirm|review|sign in|log in|create account)\b/i;

// the words on a button
function wordsOn(element: Element): string {
  return (element.textContent || element.getAttribute("value") || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
}

// true when clicking this could send the form or move it along
export function wouldSubmit(element: Element): boolean {
  const tag = element.tagName;
  const type = (element.getAttribute("type") ?? "").toLowerCase();
  if (tag === "INPUT") return type === "submit" || type === "image" || type === "button" || type === "reset";
  // a button that opens a list of choices is how newer forms build their dropdowns
  const opensList = element.getAttribute("aria-haspopup") === "listbox" || element.getAttribute("role") === "combobox";
  // a Yes or No button that is one of a pair is how some forms ask a yes or no question. it is an answer, as long as it is not a form's own submit button
  const answersYesNo = /^(yes|no)$/i.test(wordsOn(element)) && type !== "submit" && (type === "button" || element.closest("form") === null) && [...(element.parentElement?.querySelectorAll(":scope > button") ?? [])].length === 2;
  if (tag === "BUTTON" && answersYesNo) return false;
  if (tag === "BUTTON") return !opensList || type === "submit" || MOVES_FORM.test(wordsOn(element).replace(/\bselect one\b/i, ""));
  // a link can be dressed up as a button
  if (tag === "A") return true;
  return element.getAttribute("role") === "button" && MOVES_FORM.test(wordsOn(element));
}

// clicks an answer. false when the thing was not safe to click, and it is left alone
export function pressAnswer(element: HTMLElement): boolean {
  if (wouldSubmit(element)) return false;
  // a real press is a pointer going down and up before the click. many dropdowns open, and many choices are taken, on the press and not on the click
  const view = element.ownerDocument.defaultView ?? window;
  const at = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1 };
  const pointer = (name: string) => (typeof view.PointerEvent === "function" ? new view.PointerEvent(name, { ...at, pointerId: 1, pointerType: "mouse", isPrimary: true }) : new view.MouseEvent(name, at));
  element.dispatchEvent(pointer("pointerdown"));
  element.dispatchEvent(new view.MouseEvent("mousedown", at));
  element.dispatchEvent(pointer("pointerup"));
  element.dispatchEvent(new view.MouseEvent("mouseup", { ...at, buttons: 0 }));
  element.click();
  return true;
}
