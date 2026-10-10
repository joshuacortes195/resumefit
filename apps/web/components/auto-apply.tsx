"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Briefcase, Check, CircleAlert, ExternalLink, Settings2, Zap } from "lucide-react";
import type { ApplicationStatus } from "@resumefit/shared";
import { findJobs, saveFoundJob } from "@/app/actions/find-jobs";
import { CompanyLogo } from "@/components/company-logo";
import { FitBadge } from "@/components/fit-badge";
import type { ResumeOption } from "@/components/scan-form";
import { ScoreRing } from "@/components/score-ring";
import { CARD, INPUT, LIFT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { applyUrl } from "@/lib/apply-url";
import { extensionState, rememberExtensionId, savedExtensionId, sendApplications, tellExtension, type ApplyRequest, type ExtensionState } from "@/lib/extension-client";
import type { JobResult } from "@/lib/jobs-feed";

// a tracked job that has somewhere to apply
export type ApplyJob = { id: string; title: string; company: string | null; url: string; matchRate: number | null; createdAt: string };
export type ApplicationEntry = { id: string; jobId: string | null; jobTitle: string | null; company: string | null; ats: string | null; applyUrl: string | null; status: ApplicationStatus; fieldsFilled: number; fieldsNeedingAttention: number; updatedAt: string };

type AutoApplyProps = { jobs: ApplyJob[]; applications: ApplicationEntry[]; resumes: ResumeOption[]; suggest: boolean; profileReady: boolean; extensionConnected: boolean; extensionId: string };

// something Auto Apply can be pressed on: a card from the tracker, or an opening we suggested
type Target = { key: string; url: string; jobId?: string; found?: JobResult };

// how many applications can be started in one go
const MAX_AT_ONCE = 5;

// how long the page keeps checking on applications it started
const WATCH_MS = 3 * 60_000;

// how a running application reads on its card
const PROGRESS: Record<ApplicationStatus, string> = { queued: "Opening", autofilling: "Filling it in", needs_review: "Filled, ready for you to review", applied: "Applied", failed: "Could not fill this one" };

// remembers that the "how this works" pop up was read
const CONSENT_KEY = "resumefit-auto-apply-consent";

// how each application status reads on screen
const STATUS_LABELS: Record<ApplicationStatus, string> = { queued: "Queued", autofilling: "Autofilling", needs_review: "Needs review", applied: "Applied", failed: "Failed" };
const STATUS_LOOKS: Record<ApplicationStatus, string> = { queued: "text-muted", autofilling: "text-primary", needs_review: "text-warning", applied: "text-success", failed: "text-danger" };

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// how long ago a job was added
function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "Added today" : days === 1 ? "Added yesterday" : `Added ${days} days ago`;
}

// the tabs, the jobs you can apply to and the list of applications so far
export function AutoApply({ jobs, applications, resumes, suggest, profileReady, extensionConnected, extensionId }: AutoApplyProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"jobs" | "applications">("jobs");
  const [consenting, setConsenting] = useState<Target[] | null>(null);
  // what the extension on this computer can do, null until it has answered
  const [extension, setExtension] = useState<ExtensionState | null>(null);
  // the cards ticked to be started together
  const [picked, setPicked] = useState<Target[]>([]);
  // which tracker card each started suggestion became
  const [savedAs, setSavedAs] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  // while this is in the future, the page keeps asking how the applications are going
  const [watchUntil, setWatchUntil] = useState(0);
  const [resumeId, setResumeId] = useState((resumes.find((resume) => resume.isBase) ?? resumes[0])?.id ?? "");
  const [suggested, setSuggested] = useState<JobResult[] | null>(null);
  const [started, setStarted] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startSuggest] = useTransition();

  // finds openings that suit the chosen resume, on job sites the extension can fill in
  function loadSuggestions(forResume: string) {
    startSuggest(async () => {
      setSuggested(null);
      const result = await findJobs({ query: "", location: "", remoteOnly: false, internOnly: false, days: null, sort: "relevance", resumeId: forResume || null, autofillOnly: true });
      setSuggested(result.ok ? result.jobs.slice(0, 12) : []);
    });
  }

  // suggestions are there as soon as the page opens
  useEffect(() => {
    if (suggest && resumes.length > 0) loadSuggestions(resumeId);
    // only once, when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [notifications, setNotifications] = useState<"unknown" | NotificationPermission>("unknown");

  // whether browser notifications are already allowed
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ("Notification" in window) setNotifications(Notification.permission);
  }, []);

  // finds the extension. the server tells us its id once it has called in, so nobody has to type it
  useEffect(() => {
    if (extensionId && savedExtensionId() !== extensionId) rememberExtensionId(extensionId);
    void extensionState().then(setExtension);
  }, [extensionId]);

  // the latest props, for the timer below to read
  const live = useRef(applications);
  useEffect(() => {
    live.current = applications;
  }, [applications]);

  // after a start, ask every few seconds how it is going, until everything has been filled or time is up
  useEffect(() => {
    if (watchUntil === 0) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const moving = live.current.some((application) => application.status === "queued" || application.status === "autofilling");
      if (Date.now() > watchUntil || (!moving && Date.now() - started > 20_000)) setWatchUntil(0);
      else router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [watchUntil, router]);

  // the old way, for when the extension cannot open tabs for us: open the form ourselves and line the job up
  function openOne(target: Target) {
    // the tab opens straight away, while the click still counts as the person's own
    window.open(applyUrl(target.url), "_blank", "noopener");
    if (target.jobId) {
      void tellExtension({ type: "resumefit-autofill", jobId: target.jobId });
      return;
    }
    // a suggested opening goes onto the tracker as Saved first, with the resume it was picked for
    const found = target.found;
    if (!found) return;
    void saveFoundJob({ id: found.id, title: found.title, company: found.company, location: found.location, url: found.url, resumeId: resumeId || null }).then((result) => {
      if (result.ok) void tellExtension({ type: "resumefit-autofill", jobId: result.jobId });
      else setError(result.error);
    });
  }

  // starts the applications: each one is saved to the tracker if it is new, then handed to the extension to open and fill
  async function start(targets: Target[]) {
    setError(null);
    setStarted((all) => ({ ...all, ...Object.fromEntries(targets.map((target) => [target.key, true as const])) }));
    const first = targets[0];
    if (!first) return;
    if (!extension?.canApply) return openOne(first);

    setStarting(true);
    const requests: ApplyRequest[] = [];
    for (const target of targets) {
      let jobId = target.jobId ?? savedAs[target.key];
      // a suggested opening goes onto the tracker as Saved first, with the resume it was picked for
      if (!jobId && target.found) {
        const found = target.found;
        const result = await saveFoundJob({ id: found.id, title: found.title, company: found.company, location: found.location, url: found.url, resumeId: resumeId || null });
        if (!result.ok) {
          setError(result.error);
          continue;
        }
        jobId = result.jobId;
        setSavedAs((all) => ({ ...all, [target.key]: result.jobId }));
      }
      if (jobId) requests.push({ url: applyUrl(target.url), jobId, resumeId: resumeId || undefined });
    }
    const taken = requests.length > 0 && (await sendApplications(requests));
    setStarting(false);
    setPicked([]);
    if (taken) {
      setWatchUntil(Date.now() + WATCH_MS);
      router.refresh();
    } else if (requests.length > 0) setError("The extension did not answer. Check that it is still connected on the Chrome Extension page, then try again.");
  }

  // the first time, explain what will and will not happen
  function apply(targets: Target[]) {
    if (localStorage.getItem(CONSENT_KEY) === "1") void start(targets);
    else setConsenting(targets);
  }

  // ticks or unticks a card for starting several at once
  function togglePick(target: Target) {
    setPicked((all) => (all.some((entry) => entry.key === target.key) ? all.filter((entry) => entry.key !== target.key) : all.length < MAX_AT_ONCE ? [...all, target] : all));
  }

  // the newest application for a tracker card, to show how it is going
  const progressOf = (jobId: string | undefined) => (jobId ? applications.find((application) => application.jobId === jobId) : undefined);

  // the tick box and the button on a card, and under them how the application is going
  function controls(target: Target) {
    const progress = progressOf(target.jobId ?? savedAs[target.key]);
    const ticked = picked.some((entry) => entry.key === target.key);
    return (
      <>
        {/* starting several together needs the extension to open the tabs */}
        {extension?.canApply && (
          <input
            type="checkbox"
            aria-label={`Add ${target.found?.title ?? "this job"} to the batch`}
            checked={ticked}
            disabled={!ticked && picked.length >= MAX_AT_ONCE}
            onChange={() => togglePick(target)}
            className="size-4 shrink-0 accent-(--primary) transition-transform duration-150 active:scale-90"
          />
        )}
        <button type="button" disabled={starting} onClick={() => apply([target])} className={`group ${PRIMARY_BUTTON} px-3 py-2`}>
          <Zap className="size-4 transition-transform duration-200 ease-settle group-hover:scale-110" aria-hidden />
          {progress || started[target.key] ? "Open again" : "Auto Apply"}
        </button>
        {progress && (
          <p key={progress.status} className={`flex w-full animate-swap items-center gap-2 border-t border-border pt-3 text-sm font-medium ${STATUS_LOOKS[progress.status]}`}>
            {progress.status === "applied" ? <Check className="size-4" aria-hidden /> : <span aria-hidden className={`size-2 rounded-full bg-current ${progress.status === "queued" || progress.status === "autofilling" ? "animate-beat" : ""}`} />}
            {PROGRESS[progress.status]}
            {progress.status === "needs_review" && (
              <span className="font-normal text-muted">
                {progress.fieldsFilled} filled{progress.fieldsNeedingAttention > 0 ? `, ${progress.fieldsNeedingAttention} to check` : ""}
              </span>
            )}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* things to set up before the first run */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className="flex items-center gap-2 font-semibold">
            <BellRing className="size-4 text-muted" aria-hidden />
            Stay updated
          </h2>
          <p className="mt-2 text-sm text-muted">Get a browser notification when an application is marked as applied.</p>
          <button
            type="button"
            disabled={notifications === "granted" || notifications === "denied"}
            onClick={async () => setNotifications(await Notification.requestPermission())}
            className={`${SECONDARY_BUTTON} mt-3`}
          >
            <Bell className="size-4" aria-hidden />
            {notifications === "granted" ? "Notifications are on" : notifications === "denied" ? "Blocked in your browser settings" : "Enable browser notifications"}
          </button>
        </section>
        <section className={`${CARD} p-5`}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings2 className="size-4 text-muted" aria-hidden />
            Preferences
          </h2>
          <p className="mt-2 text-sm text-muted">
            {profileReady ? "Your profile has the basics autofill needs." : "Autofill types in what is in your profile. Yours is missing your name, email or phone."}{" "}
            {extensionConnected ? "The extension is connected." : "The extension is not connected yet."}
          </p>
          {/* whether this browser can do the opening and filling by itself */}
          {extension && (
            <p key={String(extension.canApply) + String(extension.handsFree)} className="mt-2 flex animate-swap items-start gap-2 text-sm">
              {extension.canApply && extension.handsFree ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
              <span>
                {!extension.installed
                  ? "We could not find the extension in this browser, so Auto Apply only opens the application. Install and connect it and we fill the form in too."
                  : !extension.canApply
                    ? "Your extension is an older version. Download the new one from the Chrome Extension page and Auto Apply will open and fill applications by itself."
                    : !extension.handsFree
                      ? "Almost there: open the extension's side panel and press Turn it on, so applications are filled in as soon as they open."
                      : "Hands free is on. Auto Apply opens the application and fills it in for you."}
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings#profile" className={SECONDARY_BUTTON}>
              Preferences
            </Link>
            {(!extensionConnected || (extension !== null && !extension.canApply)) && (
              <Link href="/extension" className={SECONDARY_BUTTON}>
                {extension?.installed && extensionConnected ? "Get the new extension" : "Set up the extension"}
              </Link>
            )}
          </div>
        </section>
      </div>

      <div>
        <Tabs
          label="Auto apply views"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "jobs", label: "Auto-Apply Jobs" },
            { key: "applications", label: "All Applications" },
          ]}
        />

        {tab === "jobs" && (
          <div className="animate-swap space-y-8 pt-5">
            {/* openings picked for the chosen resume */}
            {suggest && (
              <section aria-labelledby="suggested-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="suggested-heading" className="text-lg font-semibold">
                      Jobs that fit your resume
                    </h2>
                    <p className="mt-0.5 max-w-xl text-sm text-muted">Open roles on job sites the extension can fill in, ranked for the resume you pick. Auto Apply saves the job to your tracker, opens the application and fills it in.</p>
                  </div>
                  {resumes.length > 0 && (
                    <label className="block w-full text-sm font-medium sm:w-64">
                      Resume to use
                      <select
                        value={resumeId}
                        onChange={(event) => {
                          setResumeId(event.target.value);
                          loadSuggestions(event.target.value);
                        }}
                        className={`${INPUT} mt-1 font-normal`}
                      >
                        {resumes.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resume.name}
                            {resume.isBase ? " (base)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                  </p>
                )}
                {resumes.length === 0 ? (
                  <p className={`${CARD} mt-4 p-5 text-sm text-muted`}>
                    Add a resume and we will line up jobs that suit it.{" "}
                    <Link href="/resumes" className={LINK_BUTTON}>
                      Open Resume Manager
                    </Link>
                  </p>
                ) : suggested === null ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2" role="status" aria-label="Finding jobs">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-24" />
                    ))}
                  </div>
                ) : suggested.length === 0 ? (
                  <p className={`${CARD} mt-4 p-5 text-sm text-muted`}>
                    Nothing to suggest right now. We are still gathering openings, so check back in a few minutes, or search yourself in{" "}
                    <Link href="/jobs" className={LINK_BUTTON}>
                      Find Jobs
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="stagger mt-4 grid gap-3 md:grid-cols-2">
                    {suggested.map((job) => (
                      <li key={job.id} className={`${CARD} ${LIFT} flex flex-wrap items-center gap-x-4 gap-y-3 p-4`}>
                        <CompanyLogo company={job.company} domain={job.domain} size={40} />
                        <div className="min-w-32 flex-1">
                          <a href={job.url} target="_blank" rel="noreferrer" className="block font-semibold leading-snug hover:text-primary">
                            {job.title}
                          </a>
                          <p className="truncate text-sm text-muted">{[job.company, job.location].filter(Boolean).join(", ")}</p>
                          <p className="mt-1.5">
                            <FitBadge fit={job.fit} />
                          </p>
                        </div>
                        {controls({ key: job.id, url: job.url, found: job })}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* tracked jobs that have a link to apply at */}
            <section aria-labelledby="tracked-heading">
              <h2 id="tracked-heading" className="text-lg font-semibold">
                From your tracker
              </h2>
              {jobs.length === 0 ? (
                <div className="mt-4">
                  <EmptyState icon={Briefcase} title="No jobs to apply to yet" text="Jobs on your tracker that have a link to the posting show up here. Save one with the extension, or add the link on a job's card.">
                    <Link href="/tracker" className={PRIMARY_BUTTON}>
                      Open the tracker
                    </Link>
                  </EmptyState>
                </div>
              ) : (
                <ul className="stagger mt-4 grid gap-3 md:grid-cols-2">
                  {jobs.map((job) => {
                    const host = new URL(job.url).hostname.replace(/^www\./, "");
                    return (
                      <li key={job.id} className={`${CARD} ${LIFT} flex flex-wrap items-center gap-x-4 gap-y-3 p-4`}>
                        <CompanyLogo company={job.company ?? host} size={40} />
                        <div className="min-w-32 flex-1">
                          <Link href={`/tracker/${job.id}/job`} className="block truncate font-semibold hover:text-primary">
                            {job.title}
                          </Link>
                          <p className="truncate text-sm text-muted">{job.company ?? host}</p>
                          <p className="text-xs text-muted">
                            {age(job.createdAt)}
                            {job.matchRate !== null && job.matchRate >= 75 ? ", top match" : job.matchRate !== null && job.matchRate >= 50 ? ", good match" : ""}
                          </p>
                        </div>
                        {job.matchRate !== null && <ScoreRing score={job.matchRate} size="sm" />}
                        {controls({ key: job.id, url: job.url, jobId: job.id })}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* every autofill run and where it stands */}
        {tab === "applications" && (
          <div className="animate-swap pt-5">
            {applications.length === 0 ? (
              <EmptyState icon={Zap} title="You don't have any applications yet" text="Every application Auto Apply opens is listed here, with how many fields were filled and whether it has been sent." />
            ) : (
              <div className={`${CARD} overflow-x-auto`}>
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-3 pl-4 font-medium">Job</th>
                      <th className="py-3 font-medium">Site</th>
                      <th className="py-3 font-medium">Status</th>
                      <th className="py-3 font-medium">Fields</th>
                      <th className="py-3 pr-4 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id} className="border-b border-border last:border-0">
                        <td className="max-w-56 py-3 pl-4 pr-4">
                          <span className="block truncate font-semibold">{application.jobTitle ?? "Application"}</span>
                          <span className="block truncate text-muted">{application.company ?? ""}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {application.applyUrl && /^https?:\/\//.test(application.applyUrl) ? (
                            <a href={application.applyUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}>
                              {application.ats ?? (URL.canParse(application.applyUrl) ? new URL(application.applyUrl).hostname.replace(/^www\./, "") : "Job site")}
                              <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          ) : (
                            (application.ats ?? "")
                          )}
                        </td>
                        <td className={`py-3 pr-4 font-medium ${STATUS_LOOKS[application.status]}`}>
                          <span className="inline-flex items-center gap-2">
                            {/* the dot breathes while an application is still being opened or filled */}
                            <span aria-hidden className={`size-2 rounded-full bg-current ${application.status === "queued" || application.status === "autofilling" ? "animate-beat" : ""}`} />
                            {STATUS_LABELS[application.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted">
                          {application.fieldsFilled} filled{application.fieldsNeedingAttention > 0 ? `, ${application.fieldsNeedingAttention} to check` : ""}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-muted">{DATE.format(new Date(application.updatedAt))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* shows up when cards are ticked, to start them all together */}
      {picked.length > 0 && (
        <div className="sticky bottom-4 z-10 flex animate-dock justify-center">
          <div className={`${CARD} flex flex-wrap items-center gap-3 px-4 py-3 shadow-lg`}>
            <p className="text-sm font-medium">
              {picked.length} of {MAX_AT_ONCE} picked
            </p>
            <button type="button" disabled={starting} onClick={() => apply(picked)} className={`${PRIMARY_BUTTON} px-3 py-2`}>
              <Zap className="size-4" aria-hidden />
              {starting ? "Starting..." : `Auto Apply to ${picked.length === 1 ? "this one" : `all ${picked.length}`}`}
            </button>
            <button type="button" onClick={() => setPicked([])} className={LINK_BUTTON}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* shown once, before the first application */}
      <Modal open={consenting !== null} onClose={() => setConsenting(null)} title="Before your first Auto Apply">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>We save the job to your tracker and open the application in a new tab. The extension fills in your details, attaches your resume and drafts the written answers, then a bar on the page tells you what is left.</li>
          <li>
            <strong>You always submit.</strong> The extension never presses Submit and never does a captcha. Read every field, fix what needs fixing, then send it yourself.
          </li>
          <li>Written answers use what you saved in your profile when one fits. A fresh draft is marked amber so you read it first.</li>
          <li>Demographic questions are answered only with what you chose in your profile.</li>
          <li>There are no credits. You can start up to {MAX_AT_ONCE} applications at a time.</li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConsenting(null)} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(CONSENT_KEY, "1");
              if (consenting) void start(consenting);
              setConsenting(null);
            }}
            className={PRIMARY_BUTTON}
          >
            I understand, open the application
          </button>
        </div>
      </Modal>
    </div>
  );
}
