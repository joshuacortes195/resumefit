import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getConnection, parseConnectionCode, saveConnection, type Connection } from "../lib/api";
import type { Account, FieldReport, PageInfo } from "../lib/types";
import { profileValues } from "../lib/values";
import { askPage, localToday, readPage } from "./page";

// a message from anything that can go wrong, ready to show
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");

// what each color in the field list means
const STATUS_TEXT: Record<FieldReport["status"], string> = { filled: "Filled from your profile", review: "Drafted, please review", missing: "Needs you", skipped: "Left empty" };

// the whole side panel
export function App() {
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Connection | null>(null);

  // loads the saved connection and the account behind it
  const load = useCallback(async () => {
    const saved = await getConnection();
    setConnection(saved);
    if (!saved) return;
    try {
      setAccount(await api.me());
      setError(null);
    } catch (problem) {
      // a key that stopped working means connecting again
      if (problem instanceof ApiError && problem.status === 401) {
        await saveConnection(null);
        setConnection(null);
      }
      setError(messageOf(problem));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // the web app can connect us while the panel is open
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => changes.connection && void load();
    chrome.storage.local.onChanged.addListener(onChange);
    // an offer may already be waiting, or may arrive while the panel is open
    void chrome.storage.session.get("connectionOffer").then((stored) => setOffer((stored.connectionOffer as Connection | undefined) ?? null));
    const onOffer = (changes: Record<string, chrome.storage.StorageChange>) => changes.connectionOffer && setOffer((changes.connectionOffer.newValue as Connection | undefined) ?? null);
    chrome.storage.session.onChanged.addListener(onOffer);
    return () => {
      chrome.storage.local.onChanged.removeListener(onChange);
      chrome.storage.session.onChanged.removeListener(onOffer);
    };
  }, [load]);

  // a connection the web app offered, waiting for a yes
  if (offer) {
    return (
      <div className="panel">
        <div className="card">
          <h1>Connect to this account?</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            <strong style={{ color: "var(--foreground)" }}>{offer.apiBase}</strong> wants to connect this extension to your ResumeFit account there. Only say yes if you just pressed Connect extension on that site.
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="primary"
              onClick={async () => {
                await saveConnection(offer);
                await chrome.storage.session.remove("connectionOffer");
                setOffer(null);
              }}
            >
              Connect
            </button>
            <button
              onClick={async () => {
                await chrome.storage.session.remove("connectionOffer");
                setOffer(null);
              }}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (connection === undefined) return <div className="panel muted">Loading...</div>;
  if (!connection) return <Connect error={error} onConnected={load} />;
  if (!account) return <div className="panel">{error ? <p className="error">{error}</p> : <p className="muted">Loading your account...</p>}</div>;
  return <Workspace connection={connection} account={account} onDisconnect={() => saveConnection(null).then(load)} />;
}

// first run: paste the code from the web app
function Connect({ error, onConnected }: { error: string | null; onConnected: () => void }) {
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(error);
  return (
    <div className="panel">
      <div className="card">
        <h1>Connect to ResumeFit</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Open ResumeFit, go to Chrome Extension in the menu and press Connect extension. If it does not connect by itself, copy the connection code from that page and paste it here.
        </p>
        <textarea aria-label="Connection code" rows={3} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste your connection code" style={{ marginTop: 10 }} />
        {problem && (
          <p role="alert" className="error small" style={{ marginTop: 6 }}>
            {problem}
          </p>
        )}
        <button
          className="primary"
          style={{ marginTop: 10 }}
          disabled={code.trim() === ""}
          onClick={async () => {
            const parsed = parseConnectionCode(code);
            if (!parsed) {
              setProblem("That does not look like a connection code. Copy it again from the Chrome Extension page.");
              return;
            }
            await saveConnection(parsed);
            onConnected();
          }}
        >
          Connect
        </button>
      </div>
    </div>
  );
}

// the connected panel: look at the page, then offer what makes sense for it
function Workspace({ connection, account, onDisconnect }: { connection: Connection; account: Account; onDisconnect: () => void }) {
  const [page, setPage] = useState<PageInfo | null>(null);
  const [pasted, setPasted] = useState<{ text: string; url: string; title: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reads the tab again, used on open and whenever the person moves on
  const check = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setPage(await readPage());
    } catch (problem) {
      setPage(null);
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // text sent from the right click menu, and a job the web app asked us to fill
    void chrome.storage.session.get(["pendingScan", "pendingJobId"]).then((stored) => {
      if (stored.pendingScan) setPasted(stored.pendingScan as { text: string; url: string; title: string });
      if (stored.pendingJobId) setJobId(stored.pendingJobId as string);
      void chrome.storage.session.remove(["pendingScan", "pendingJobId"]);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  const open = (path: string) => void chrome.tabs.create({ url: `${connection.apiBase}${path}` });

  return (
    <div className="panel">
      <div className="row">
        <h1 style={{ flex: 1 }}>ResumeFit</h1>
        <button onClick={check} disabled={busy}>
          {busy ? "Looking..." : "Check this page"}
        </button>
      </div>

      {!account.profileReady && (
        <p className="notice warn small">
          Your profile is missing your name, email or phone, so autofill has little to work with.{" "}
          <button className="link" onClick={() => open("/settings#profile")}>
            Fill in your profile
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {/* highlighted text sent from the right click menu */}
      {pasted && <JobCard job={{ title: pasted.title, company: "", location: "", description: pasted.text, url: pasted.url }} account={account} jobId={jobId} onJob={setJobId} open={open} heading="Selected text" />}

      {page?.confirmed && <p className="notice">This page looks like your application went through. Nice work.</p>}
      {page?.hasForm && <Autofill page={page} account={account} jobId={jobId} onPage={setPage} />}
      {page?.job && !page.hasForm && <JobCard job={page.job} account={account} jobId={jobId} onJob={setJobId} open={open} heading="Job on this page" />}
      {page && !page.job && !page.hasForm && !pasted && (
        <div className="card">
          <p>We did not find a job posting or an application form on this page.</p>
          <p className="muted small" style={{ marginTop: 6 }}>
            You can also highlight a job description, right click it and choose &quot;Scan this job description with ResumeFit&quot;.
          </p>
        </div>
      )}

      <p className="muted small row">
        <span style={{ flex: 1 }}>Connected as {account.user.email}</span>
        <button className="link" onClick={() => open("/tracker")}>
          Tracker
        </button>
        <button className="link" onClick={onDisconnect}>
          Disconnect
        </button>
      </p>
    </div>
  );
}

type JobCardProps = {
  job: NonNullable<PageInfo["job"]>;
  account: Account;
  jobId: string | null;
  onJob: (id: string) => void;
  open: (path: string) => void;
  heading: string;
};

// a job we read off the page: save it, scan it, or go and optimize for it
function JobCard({ job, account, jobId, onJob, open, heading }: JobCardProps) {
  const [busy, setBusy] = useState<"save" | "scan" | null>(null);
  const [saved, setSaved] = useState(false);
  const [scan, setScan] = useState<{ scanId: string; matchRate: number; missing: string[]; resumeName: string } | null>(null);
  const [resumeId, setResumeId] = useState(account.resumes.find((resume) => resume.isBase)?.id ?? account.resumes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  // runs one of the two actions and shows what went wrong if it fails
  async function run(kind: "save" | "scan", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const result = await api.saveJob({ title: job.title, company: job.company || undefined, location: job.location || undefined, url: job.url || undefined, description: job.description });
      onJob(result.jobId);
      setSaved(true);
    });

  const runScan = () =>
    run("scan", async () => {
      setScan(await api.scan({ jdText: job.description, title: job.title || undefined, company: job.company || undefined, url: job.url || undefined, resumeId: resumeId || undefined, jobId: jobId ?? undefined }));
    });

  const color = scan ? (scan.matchRate >= 75 ? "var(--success)" : scan.matchRate >= 40 ? "var(--warning)" : "var(--danger)") : undefined;

  return (
    <div className="card">
      <p className="muted small">{heading}</p>
      <h2 style={{ marginTop: 2 }}>{job.title || "Untitled job"}</h2>
      <p className="muted">{[job.company, job.location].filter(Boolean).join(", ")}</p>

      {account.resumes.length > 1 && (
        <label className="small" style={{ display: "block", marginTop: 10 }}>
          Scan against
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

      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={runScan} disabled={busy !== null || job.description.length < 50}>
          {busy === "scan" ? "Scanning..." : scan ? "Scan again" : "Scan"}
        </button>
        <button onClick={save} disabled={busy !== null || saved}>
          {busy === "save" ? "Saving..." : saved ? "Saved to tracker" : "Save job"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error small" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      {/* the score and the top things missing, right here in the panel */}
      {scan && (
        <div style={{ marginTop: 12 }}>
          <p className="row">
            <span className="score" style={{ color }}>
              {scan.matchRate}%
            </span>
            <span className="muted small">match with {scan.resumeName}. Aim for 75% or more.</span>
          </p>
          {scan.missing.length > 0 && (
            <>
              <p className="small" style={{ marginTop: 8 }}>
                Top skills missing from your resume
              </p>
              <ul className="chips">
                {scan.missing.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => open(`/scans/${scan.scanId}`)}>Open full report</button>
            <button onClick={() => open(`/optimize/${scan.scanId}`)}>Optimize resume for this job</button>
          </div>
        </div>
      )}
    </div>
  );
}

// an application form: fill it, review each field, then the person submits on the site
function Autofill({ page, account, jobId, onPage }: { page: PageInfo; account: Account; jobId: string | null; onPage: (page: PageInfo) => void }) {
  // the resume made for this job when there is one, otherwise the base resume
  const linked = jobId ? account.resumes.find((resume) => resume.linkedJobId === jobId) : undefined;
  const [resumeId, setResumeId] = useState(linked?.id ?? account.resumes.find((resume) => resume.isBase)?.id ?? account.resumes[0]?.id ?? "");
  const [fields, setFields] = useState<FieldReport[]>(page.fields);
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tells the web app how this application is going
  const reportStatus = (status: "needs_review" | "applied", list: FieldReport[]) =>
    api
      .reportApplication({
        jobId,
        ats: page.ats?.name ?? null,
        applyUrl: page.url,
        status,
        fieldsFilled: list.filter((field) => field.status === "filled" || field.status === "review").length,
        fieldsNeedingAttention: list.filter((field) => field.status === "missing" || field.status === "review").length,
        today: localToday(),
      })
      .catch(() => undefined);

  // fills the form from the profile. it stops there, nothing is submitted
  async function autofill() {
    setBusy(true);
    setError(null);
    try {
      const resume = resumeId ? await api.resumeFile(resumeId) : null;
      const results = await askPage<FieldReport[]>({ type: "autofill", values: profileValues(account), resume });
      setFields(results);
      setFilled(true);
      void reportStatus("needs_review", results);
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  // swaps in the new state of one field after it was changed from the panel
  const replace = (next: FieldReport | null) => next && setFields((all) => all.map((field) => (field.id === next.id ? next : field)));

  const needs = fields.filter((field) => field.status === "missing" || field.status === "review").length;

  return (
    <div className="card">
      <p className="muted small">{page.ats ? `${page.ats.name} application` : "Application form"}</p>
      <h2 style={{ marginTop: 2 }}>Autofill</h2>

      {page.captcha && <p className="notice warn small" style={{ marginTop: 8 }}>This page has a captcha. That part is yours to do, we never touch it.</p>}

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

      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={autofill} disabled={busy}>
          {busy ? "Filling..." : filled ? "Fill again" : "Autofill"}
        </button>
        {filled && (
          <button
            disabled={applied}
            onClick={async () => {
              await reportStatus("applied", fields);
              setApplied(true);
              void chrome.notifications?.create({ type: "basic", iconUrl: "icon-128.png", title: "Marked as applied", message: "The job moved to Applied on your tracker." });
            }}
          >
            {applied ? "Marked as applied" : "Mark as applied"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error small" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      {filled && (
        <p className="notice" style={{ marginTop: 10 }}>
          <strong>Review everything, then click the site&apos;s Submit button.</strong>{" "}
          {needs === 0 ? "Every field we found is filled in." : `${needs} ${needs === 1 ? "field needs" : "fields need"} your attention.`}
          {page.ats?.id === "workday" || page.ats?.id === "taleo" ? " This form has several pages. Press its Next button yourself, then press Fill again on each page." : ""}
        </p>
      )}

      <ul className="fields">
        {fields.map((field) => (
          <FieldRow key={field.id} field={field} jdText={page.job?.description ?? ""} resumeId={resumeId} onChange={replace} />
        ))}
      </ul>
      {fields.length > 0 && (
        <button className="link small" style={{ marginTop: 10 }} onClick={async () => onPage(await readPage())}>
          Refresh this list
        </button>
      )}
    </div>
  );
}

// one field: its status, what is in it, and ways to change it
function FieldRow({ field, jdText, resumeId, onChange }: { field: FieldReport; jdText: string; resumeId: string; onChange: (next: FieldReport | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const editable = field.kind === "text" || field.kind === "textarea";

  // writes a value into the page and marks how sure we are about it
  const apply = async (value: string, status: FieldReport["status"]) => onChange(await askPage<FieldReport | null>({ type: "set-field", id: field.id, value, status }));

  // answers a free text question, from the saved answers when one fits, otherwise a draft
  async function answer() {
    setBusy(true);
    setNote(null);
    try {
      const result = await api.answer({ question: field.label, jdText, resumeId: resumeId || undefined });
      setDraft(result.answer);
      // a saved answer is the person's own words, a draft has to be read first
      await apply(result.answer, result.source === "saved" ? "filled" : "review");
      setNote(result.source === "saved" ? "Used your saved answer." : "Drafted from your resume. Read it before you send it.");
      setEditing(true);
    } catch (problem) {
      setNote(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="field">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <span className={`dot ${field.status}`} title={STATUS_TEXT[field.status]} />
        <button className="link field-label" style={{ textAlign: "left", color: "inherit" }} title="Show this field on the page" onClick={() => askPage({ type: "focus-field", id: field.id })}>
          {field.label}
          {field.required ? " *" : ""}
        </button>
        <span className="muted small" style={{ whiteSpace: "nowrap" }}>
          {STATUS_TEXT[field.status]}
        </span>
      </div>

      {editing && editable ? (
        <div style={{ marginTop: 6 }}>
          {field.kind === "textarea" || field.key === "question" ? <textarea aria-label={field.label} rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} /> : <input aria-label={field.label} value={draft} onChange={(event) => setDraft(event.target.value)} />}
          <div className="row" style={{ marginTop: 6 }}>
            <button
              onClick={async () => {
                await apply(draft, "filled");
                setEditing(false);
              }}
            >
              Use this
            </button>
            {field.key === "question" && draft.trim() !== "" && (
              <button
                className="link small"
                onClick={async () => {
                  await api.saveAnswer({ question: field.label, answer: draft }).then(
                    () => setNote("Saved. We will reuse it when a form asks something similar."),
                    (problem) => setNote(messageOf(problem)),
                  );
                }}
              >
                Save this answer to my Q&amp;A bank
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="field-value">{field.value ? (field.value.length > 160 ? `${field.value.slice(0, 160)}...` : field.value) : "Empty"}</p>
      )}

      <div className="row small" style={{ marginTop: 4 }}>
        {editable && !editing && (
          <button
            className="link"
            onClick={() => {
              setDraft(field.value);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        {field.key === "question" && (
          <button className="link" disabled={busy} onClick={answer}>
            {busy ? "Writing..." : "Draft an answer"}
          </button>
        )}
        {note && <span className="muted">{note}</span>}
      </div>
    </li>
  );
}
