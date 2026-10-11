import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getConnection, parseConnectionCode, saveConnection, type Connection } from "../lib/api";
import type { Account, LinkedinImport, PageInfo } from "../lib/types";
import { askPage, NeedsAccess, readPage, SITE_ACCESS } from "./page";

// asks chrome, once, to let us read job pages. it has to be asked from a click
const askAccess = () => chrome.permissions.request({ origins: SITE_ACCESS }).catch(() => false);

// a message from anything that can go wrong, ready to show
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");

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
                // chrome asks about reading job pages in the same click
                await askAccess();
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
            // chrome asks about reading job pages in the same click
            await askAccess();
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
  const [allowed, setAllowed] = useState(true);

  // reads the tab again, used on open and whenever the person moves on
  const check = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setPage(await readPage());
    } catch (problem) {
      setPage(null);
      // not being allowed on the page gets its own card with a button, not a red error
      if (problem instanceof NeedsAccess) setAllowed(false);
      else setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // text sent from the right click menu
    void chrome.storage.session.get("pendingScan").then((stored) => {
      if (stored.pendingScan) setPasted(stored.pendingScan as { text: string; url: string; title: string });
      void chrome.storage.session.remove("pendingScan");
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    void chrome.permissions.contains({ origins: SITE_ACCESS }).then(setAllowed);
    // moving to another tab, or the tab going to another page, means looking again
    const onTab = () => void check();
    const onLoad = (_tabId: number, change: { status?: string }, tab: chrome.tabs.Tab) => change.status === "complete" && tab.active && void check();
    chrome.tabs.onActivated.addListener(onTab);
    chrome.tabs.onUpdated.addListener(onLoad);
    return () => {
      chrome.tabs.onActivated.removeListener(onTab);
      chrome.tabs.onUpdated.removeListener(onLoad);
    };
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

      {/* chrome has to be told once that we may read job pages. nothing works until then */}
      {!allowed && (
        <div className="card">
          <h2>Allow ResumeFit to read job pages</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            Job postings live on all kinds of sites, so Chrome needs your OK once. After that the panel reads the posting on the page you are on, so you can scan or save it. It only looks at a page while this panel is open on it.
          </p>
          <button
            className="primary"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const granted = await askAccess();
              setAllowed(granted);
              if (granted) void check();
            }}
          >
            Allow
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {/* highlighted text sent from the right click menu */}
      {pasted && <JobCard job={{ title: pasted.title, company: "", location: "", description: pasted.text, url: pasted.url }} account={account} jobId={jobId} onJob={setJobId} open={open} heading="Selected text" />}

      {page?.linkedinProfile && <LinkedinCard open={open} />}
      {page?.job && !page.linkedinProfile && <JobCard job={page.job} account={account} jobId={jobId} onJob={setJobId} open={open} heading="Job on this page" />}
      {page && !page.job && !pasted && !page.linkedinProfile && (
        <div className="card">
          <p>We did not find a job posting on this page.</p>
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

// on a linkedin profile: read it and hand it to the linkedin optimizer
function LinkedinCard({ open }: { open: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reads the profile on screen, sends it to the person's account and opens the optimizer with it filled in
  async function importProfile() {
    setBusy(true);
    setError(null);
    try {
      const profile = await askPage<LinkedinImport>({ type: "read-linkedin" });
      await api.importLinkedin(profile);
      open("/linkedin");
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="muted small">LinkedIn profile</p>
      <h2 style={{ marginTop: 2 }}>Import my profile</h2>
      <p className="muted small" style={{ marginTop: 6 }}>
        Use this on your own profile. Scroll down it once so every section has loaded, then press the button. We read the headline, About, experience and skills shown on this page and open the LinkedIn Optimizer with them filled in.
      </p>
      <button className="primary" style={{ marginTop: 10 }} onClick={importProfile} disabled={busy}>
        {busy ? "Reading your profile..." : "Import my profile"}
      </button>
      {error && (
        <p role="alert" className="error small" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
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
  const [scan, setScan] = useState<{ scanId: string; matchRate: number; missing: string[]; resumeName: string; jobId: string | null } | null>(null);
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
      const result = await api.scan({ jdText: job.description, title: job.title || undefined, company: job.company || undefined, url: job.url || undefined, resumeId: resumeId || undefined, jobId: jobId ?? undefined });
      setScan(result);
      // the scan lands on a tracker card, so the score shows up there too
      if (result.jobId) {
        onJob(result.jobId);
        setSaved(true);
      }
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
            <span className="muted small">match with {scan.resumeName}. Aim for 75% or more.{scan.jobId ? " Saved to your tracker with this score." : ""}</span>
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
