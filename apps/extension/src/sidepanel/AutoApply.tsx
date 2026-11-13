import { useEffect, useState } from "react";
import { api, type ApplicationReport } from "../lib/api";
import { getPending, type PendingApply } from "../lib/pending";
import { fillEverything, pickResume, tally } from "../lib/pipeline";
import type { Account, FieldReport, PageInfo } from "../lib/types";
import { activeTab, askPage, localToday, readPage } from "./page";

// a message from anything that can go wrong, ready to show
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");

// what each kind of row is called in the checklist
const GROUPS: { status: FieldReport["status"]; title: string; hint: string }[] = [
  { status: "missing", title: "Empty and required", hint: "We had no answer for these. They are outlined in red on the page." },
  { status: "review", title: "Needs a look", hint: "Drafts and close matches, outlined in yellow. Read each one before you send." },
  { status: "filled", title: "Filled in", hint: "Straight from your application profile." },
];

type AutoApplyProps = {
  page: PageInfo;
  account: Account;
  // the tracker card for the job on this page, when it was saved or scanned from the panel
  jobId: string | null;
  open: (path: string) => void;
  onPage: (page: PageInfo) => void;
};

// auto apply for the form on this page: fill it from the application profile, show what needs a look, and stop.
// the person reads it over and presses the site's own Submit button
export function AutoApply({ page, account, jobId: cardId, open, onPage }: AutoApplyProps) {
  // set when the web app opened this tab for one of the tracker's jobs
  const [pending, setPending] = useState<PendingApply | null>(null);
  const jobId = pending?.jobId ?? cardId;
  const [resumeId, setResumeId] = useState("");
  const [withLetter, setWithLetter] = useState(true);
  const [busy, setBusy] = useState<"fill" | "find" | "applied" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the fields as the last fill left them. before any fill, whatever the page already shows
  const [fields, setFields] = useState<FieldReport[]>(page.fields);
  const [filled, setFilled] = useState(page.fields.some((field) => field.status !== "skipped"));
  const [sentByMe, setSentByMe] = useState(false);
  const [applied, setApplied] = useState(false);
  const [letterUsed, setLetterUsed] = useState(false);

  // which job this tab was opened for, if any, and the resume that goes with it
  useEffect(() => {
    let current = true;
    void activeTab().then(async (tab) => {
      const found = tab?.id ? await getPending(tab.id) : null;
      if (!current) return;
      setPending(found);
      setResumeId(pickResume(account, found?.jobId ?? cardId, found?.resumeId ?? null) ?? "");
    });
    return () => {
      current = false;
    };
  }, [account, cardId]);

  // tells the web app how the run is going. a failed report never gets in the way of the fill
  const report = (status: ApplicationReport["status"], now: FieldReport[], extra: Partial<ApplicationReport> = {}) =>
    api
      .reportApplication({ jobId, ats: page.ats?.name ?? null, applyUrl: page.url, status, ...{ fieldsFilled: tally(now).filled, fieldsNeedingAttention: tally(now).needs }, answers: now.filter((field) => field.kind !== "file" && field.value).map(({ label, value, status: how }) => ({ label: label.slice(0, 300), value: value.slice(0, 3000), status: how })).slice(0, 120), resumeId: resumeId || null, today: localToday(), ...extra })
      .catch(() => undefined);

  // fills the form that is showing. onlyNew is for the next step of a long form
  async function fill(onlyNew = false) {
    setBusy("fill");
    setError(null);
    try {
      const result = await fillEverything(askPage, account, { resumeId: resumeId || null, jobId, jdText: page.job?.description ?? "", coverLetter: withLetter, onlyNew });
      setFields(result.fields);
      setFilled(true);
      setLetterUsed(result.coverLetter !== null && result.fields.some((field) => field.key === "coverLetter" && field.status === "filled"));
      void report("needs_review", result.fields, { coverLetter: result.coverLetter !== null });
      // a heads up for when the person has moved on to something else while it worked
      const { needs } = tally(result.fields);
      if (!document.hasFocus()) void chrome.notifications?.create({ type: "basic", iconUrl: "icon-128.png", title: "Application filled in", message: `${needs === 0 ? "Everything we could answer is in." : `${needs} ${needs === 1 ? "field needs" : "fields need"} a look.`} Nothing was sent, that part is yours.` });
    } catch (problem) {
      setError(messageOf(problem));
      void report("failed", fields);
    } finally {
      setBusy(null);
    }
  }

  // takes this tab from the posting to its application form, by following the posting's own Apply link
  async function goToForm() {
    setBusy("find");
    setError(null);
    try {
      const link = await askPage<string | null>({ type: "find-apply" });
      const tab = await activeTab();
      if (link && tab?.id) await chrome.tabs.update(tab.id, { url: link });
      else setError("We could not find a plain link to the form. Press the site's own Apply button, then come back to this panel.");
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(null);
    }
  }

  // the person sent it: note it on the tracker with the date, the resume and the answers
  async function markApplied() {
    setBusy("applied");
    setError(null);
    try {
      await api.reportApplication({ jobId, ats: page.ats?.name ?? null, applyUrl: page.url, status: "applied", fieldsFilled: tally(fields).filled, fieldsNeedingAttention: 0, resumeId: resumeId || null, coverLetter: letterUsed, today: localToday() });
      setApplied(true);
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(null);
    }
  }

  // one answer changed in the panel: put it on the page and keep our copy in step
  const swap = (next: FieldReport | null) => next && setFields((all) => all.map((field) => (field.id === next.id ? next : field)));

  // a site that forbids this gets a plain no, and the rest of the panel still works there
  if (page.fillBlocked) {
    return (
      <div className="card">
        <p className="muted small">Auto Apply</p>
        <p style={{ marginTop: 4 }}>Auto Apply stays off on this site.</p>
        <p className="muted small" style={{ marginTop: 6 }}>
          Its rules do not allow tools to fill in applications, so this one is yours to fill in. You can still scan and save the job from here.
        </p>
      </div>
    );
  }

  // the page said thanks, or the person told us they pressed Submit
  if (applied) {
    return (
      <div className="card">
        <p className="muted small">Auto Apply</p>
        <h2 style={{ marginTop: 2 }}>Marked as applied</h2>
        <p className="muted small" style={{ marginTop: 6 }}>
          {jobId ? "The card is in Applied on your tracker, with today's date, the resume you sent and the answers you used." : "It is in your list of applications with the answers you used."}
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={() => open(jobId ? `/tracker/${jobId}/application` : "/applications")}>{jobId ? "Open the card" : "All applications"}</button>
        </div>
      </div>
    );
  }

  // not on the form yet: offer the way there when this tab was opened for a job, or the page is a posting
  if (!page.hasForm && !(filled && fields.length > 0)) {
    if (page.confirmed && pending) {
      return (
        <div className="card">
          <p className="muted small">Auto Apply</p>
          <p style={{ marginTop: 4 }}>This page says your application went through.</p>
          <button className="primary" style={{ marginTop: 10 }} onClick={markApplied} disabled={busy !== null}>
            {busy === "applied" ? "Saving..." : "Mark as applied"}
          </button>
        </div>
      );
    }
    if (!pending && !page.job) return null;
    return (
      <div className="card">
        <p className="muted small">Auto Apply</p>
        <p style={{ marginTop: 4 }}>{pending ? "This is the posting. The form comes next." : "Want this one filled in for you?"}</p>
        <p className="muted small" style={{ marginTop: 6 }}>
          Open the application form and we fill in what we can from your application profile. You check it and press Submit yourself.
        </p>
        <button className="primary" style={{ marginTop: 10 }} onClick={goToForm} disabled={busy !== null}>
          {busy === "find" ? "Looking for the form..." : "Go to the application form"}
        </button>
        {error && (
          <p role="alert" className="error small" style={{ marginTop: 8 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  const { filled: done, needs } = tally(fields);
  const canLetter = Boolean(jobId) && fields.some((field) => field.key === "coverLetter");

  return (
    <div className="card">
      <p className="muted small">Auto Apply{page.ats ? `, ${page.ats.name} form` : ""}</p>
      <h2 style={{ marginTop: 2 }}>{filled ? `${done} filled in, ${needs} for you to check` : "Fill in this application"}</h2>

      {/* without the basics there is little to fill with */}
      {!account.profileReady && (
        <p className="notice warn small" style={{ marginTop: 8 }}>
          Your application profile is missing your name, email or phone.{" "}
          <button className="link" onClick={() => open("/settings/application")}>
            Fill it in
          </button>
        </p>
      )}

      {!filled && (
        <p className="muted small" style={{ marginTop: 6 }}>
          We type in your answers, attach your resume and draft the written questions. Then we stop. You read it over and press the site&apos;s own Submit button.
        </p>
      )}

      {account.resumes.length > 0 && (
        <label className="small" style={{ display: "block", marginTop: 10 }}>
          Resume to attach
          <select value={resumeId} onChange={(event) => setResumeId(event.target.value)} style={{ marginTop: 4 }}>
            {account.resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
                {resume.isBase ? " (base)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {canLetter && (
        <label className="small row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={withLetter} onChange={(event) => setWithLetter(event.target.checked)} style={{ width: "auto" }} />
          Attach the cover letter saved for this job
        </label>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={() => fill(false)} disabled={busy !== null}>
          {busy === "fill" ? "Filling in and drafting answers..." : filled ? "Fill again" : "Fill this application"}
        </button>
        {/* a long form shows its next page after the person presses Next. only what is new gets filled then */}
        {filled && page.multiPage && (
          <button onClick={() => fill(true)} disabled={busy !== null}>
            Fill this step
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error small" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      {filled && page.captcha && <p className="notice warn small" style={{ marginTop: 10 }}>This form has a captcha. That one is yours to do.</p>}
      {filled && page.multiPage && <p className="notice small" style={{ marginTop: 10 }}>This form has several pages. Press its Next button yourself, then press Fill this step here.</p>}

      {/* the checklist: what needs the person first, what went in last */}
      {filled &&
        GROUPS.map(({ status, title, hint }) => {
          const rows = fields.filter((field) => field.status === status);
          if (rows.length === 0) return null;
          const list = (
            <ul className="fields">
              {rows.map((field) => (
                <FieldRow key={field.id} field={field} jdText={page.job?.description ?? ""} resumeId={resumeId} jobId={jobId} onChange={swap} />
              ))}
            </ul>
          );
          // the ones that went in fine are tucked away, the list can be long
          return status === "filled" ? (
            <details key={status} style={{ marginTop: 12 }}>
              <summary className="small">
                {title} ({rows.length})
              </summary>
              {list}
            </details>
          ) : (
            <div key={status} style={{ marginTop: 12 }}>
              <p className="small">
                <strong>
                  {title} ({rows.length})
                </strong>
              </p>
              <p className="muted small">{hint}</p>
              {list}
            </div>
          );
        })}

      {/* marking it applied only shows once the page says thanks, or the person says they sent it */}
      {filled && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <p className="small">
            <strong>Nothing has been sent.</strong> <span className="muted">Check the form, then press its Submit button yourself.</span>
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={async () => onPage(await readPage())} disabled={busy !== null}>
              I sent it, check the page
            </button>
          </div>
          {page.confirmed || sentByMe ? (
            <button className="primary" style={{ marginTop: 8 }} onClick={markApplied} disabled={busy !== null}>
              {busy === "applied" ? "Saving..." : "Mark as applied"}
            </button>
          ) : (
            <label className="small row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={sentByMe} onChange={(event) => setSentByMe(event.target.checked)} style={{ width: "auto" }} />
              The page did not say so, but I pressed Submit
            </label>
          )}
        </div>
      )}
    </div>
  );
}

type FieldRowProps = { field: FieldReport; jdText: string; resumeId: string; jobId: string | null; onChange: (next: FieldReport | null) => void };

// one field in the checklist: what it asks, what went in, a way to jump to it, and for written questions a box to fix the answer
function FieldRow({ field, jdText, resumeId, jobId, onChange }: FieldRowProps) {
  const written = field.kind === "textarea" || field.key === "question";
  const [text, setText] = useState(field.value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // scrolls the page to the field and puts the cursor in it
  const jump = () => void askPage({ type: "focus-field", id: field.id }).catch(() => undefined);

  // puts what is in the box onto the form. an answer the person wrote or approved counts as done
  async function use(value: string, status: FieldReport["status"]) {
    setBusy(true);
    setError(null);
    try {
      onChange(await askPage<FieldReport | null>({ type: "set-field", id: field.id, value, status }));
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  // asks for an answer: the saved one when it fits, otherwise a fresh draft that stays marked for checking
  async function draft() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.answer({ question: field.label.slice(0, 500), jdText, resumeId: resumeId || undefined, jobId: jobId ?? undefined });
      setText(result.answer);
      onChange(await askPage<FieldReport | null>({ type: "set-field", id: field.id, value: result.answer, status: result.source === "saved" ? "filled" : "review" }));
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="field">
      <div className="row">
        <span className={`dot ${field.status}`} aria-hidden />
        <span className="field-label" title={field.label}>
          {field.label}
        </span>
        <button className="link small" onClick={jump}>
          Jump to field
        </button>
      </div>
      {written ? (
        <>
          <textarea aria-label={`Answer to: ${field.label}`} rows={4} value={text} onChange={(event) => setText(event.target.value)} style={{ marginTop: 6 }} />
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={() => use(text, "filled")} disabled={busy || text.trim() === ""}>
              Use this answer
            </button>
            <button onClick={draft} disabled={busy}>
              {busy ? "Working..." : text.trim() ? "Draft again" : "Draft an answer"}
            </button>
          </div>
        </>
      ) : (
        <p className="field-value">{field.value || (field.status === "missing" ? "Nothing to put here. Fill it in on the page." : "Left empty")}</p>
      )}
      {error && (
        <p role="alert" className="error small" style={{ marginTop: 4 }}>
          {error}
        </p>
      )}
    </li>
  );
}
