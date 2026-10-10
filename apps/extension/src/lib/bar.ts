import type { BarState } from "./types";

// the little bar we put at the bottom of an application page, so the person can see what happened without opening the side panel

const HOST_ID = "resumefit-bar";

// styling for the bar. it lives in its own shadow root so the job site's styles cannot touch it, and ours cannot touch theirs
const STYLES = `
  :host { all: initial; }
  .bar {
    position: fixed; left: 50%; bottom: 18px; z-index: 2147483647;
    display: flex; align-items: center; gap: 12px; max-width: min(640px, calc(100vw - 24px));
    padding: 10px 12px 10px 14px; border-radius: 14px; border: 1px solid #e4e2da; background: #ffffff; color: #1c1b18;
    font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    box-shadow: 0 1px 2px rgb(28 27 24 / 0.06), 0 12px 32px rgb(28 27 24 / 0.16);
    transform: translate(-50%, 0); opacity: 1;
    transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease-out;
  }
  /* slides up from the edge when it first shows */
  @starting-style { .bar { transform: translate(-50%, 16px); opacity: 0; } }
  .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: #2a7a4b; }
  .dot.warn { background: #a86400; }
  .dot.bad { background: #c2362b; }
  /* spinner shown while the form is being filled */
  .dot.spin { background: none; width: 14px; height: 14px; border: 2px solid #e4e2da; border-top-color: #a34707; animation: turn 0.7s linear infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  .text { flex: 1; min-width: 0; }
  .title { font-weight: 650; }
  .note { color: #5f5e58; font-size: 12px; }
  /* styling for buttons */
  button {
    all: unset; flex: none; cursor: pointer; padding: 6px 10px; border-radius: 9px; border: 1px solid #e4e2da;
    font: 600 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1c1b18; background: #ffffff;
    transition: transform 0.15s ease-out, background 0.15s ease;
  }
  button:hover { background: #f7f6f2; }
  button:active { transform: scale(0.97); }
  button:focus-visible { outline: 2px solid #a34707; outline-offset: 2px; }
  button.main { background: #a34707; border-color: #a34707; color: #ffffff; }
  button.main:hover { background: #863a06; }
  button.close { border: 0; padding: 4px 6px; color: #5f5e58; font-size: 16px; line-height: 1; }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } .dot.spin { animation-duration: 2s; } }
`;

// the headline, the small print and the dot color for each thing the bar can say
function wording(bar: BarState): { title: string; note: string; dot: string } {
  if (bar.state === "working") return { title: "ResumeFit is filling this in", note: "Your details, your resume and the written questions. Nothing is sent.", dot: "spin" };
  if (bar.state === "applied") return { title: "Application sent", note: "Marked as applied on your tracker.", dot: "" };
  if (bar.state === "sending") return { title: countdownTitle(bar.seconds), note: "Everything is filled from your profile. Press Cancel to send it yourself.", dot: "spin" };
  if (bar.state === "sent") return { title: "Submit pressed, waiting for the site", note: "We mark it as applied when the site says thanks.", dot: "spin" };
  if (bar.state === "held") return { title: "Left for you to send", note: bar.message, dot: "warn" };
  if (bar.state === "no-form") return { title: "No application form on this page yet", note: "Press the site's Apply button. We fill the form in when it shows.", dot: "warn" };
  if (bar.state === "error") return { title: "Could not fill this one", note: bar.message, dot: "bad" };
  const fields = `${bar.filled} ${bar.filled === 1 ? "field" : "fields"}`;
  const note = [
    bar.needs === 0 ? "Read it over, then press the site's own Submit button." : `Check ${bar.needs === 1 ? "it" : "those"}, then press the site's own Submit button.`,
    bar.captcha ? "The captcha is yours to do." : "",
    bar.multiPage ? "On the next page, press Fill this page." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { title: bar.needs === 0 ? `Filled ${fields}. Ready for you to review` : `Filled ${fields}, ${bar.needs} ${bar.needs === 1 ? "needs" : "need"} you`, note, dot: bar.needs === 0 ? "" : "warn" };
}

// the headline while counting down to Submit
const countdownTitle = (seconds: number) => `Sending this application in ${seconds}s`;

// changes the number in the countdown without redrawing the whole bar
export function tickBar(doc: Document, seconds: number): void {
  const title = doc.getElementById(HOST_ID)?.shadowRoot?.querySelector(".title");
  if (title) title.textContent = countdownTitle(seconds);
}

// shows the bar, or changes what it says when it is already there
export function showBar(doc: Document, bar: BarState, actions: { onNext: () => void; onRefill: () => void; onCancel?: () => void }): void {
  doc.getElementById(HOST_ID)?.remove();
  const host = doc.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  style.textContent = STYLES;
  const box = doc.createElement("div");
  box.className = "bar";
  box.setAttribute("role", "status");

  // a small helper for the text bits, everything goes in as plain text
  const make = (tag: string, className: string, text = "") => {
    const element = doc.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };
  const { title, note, dot } = wording(bar);
  const text = make("div", "text");
  text.append(make("div", "title", title), make("div", "note", note));
  box.append(make("span", `dot ${dot}`), text);

  // jump to the next field that wants checking
  if (bar.state === "done" && bar.needs > 0) {
    const next = make("button", "main", "Show next");
    next.addEventListener("click", actions.onNext);
    box.append(next);
  }
  // fill again, for the next page of a long form or after a change to the profile
  if (bar.state === "done" || bar.state === "error") {
    const again = make("button", "", bar.state === "done" && bar.multiPage ? "Fill this page" : "Fill again");
    again.addEventListener("click", actions.onRefill);
    box.append(again);
  }
  // stops the countdown, the application is then the person's to send
  if (bar.state === "sending") {
    const cancel = make("button", "main", "Cancel");
    cancel.addEventListener("click", () => actions.onCancel?.());
    box.append(cancel);
  }
  if (bar.state !== "working" && bar.state !== "sending" && bar.state !== "sent") {
    const close = make("button", "close", "×");
    close.setAttribute("aria-label", "Hide ResumeFit");
    close.addEventListener("click", () => host.remove());
    box.append(close);
  }

  root.append(style, box);
  doc.documentElement.append(host);
}
