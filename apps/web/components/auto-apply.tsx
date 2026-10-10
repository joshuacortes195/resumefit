"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Briefcase, ExternalLink, Settings2, Zap } from "lucide-react";
import type { ApplicationStatus } from "@resumefit/shared";
import { ScoreRing } from "@/components/score-ring";
import { CARD, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { tellExtension } from "@/lib/extension-client";

// a tracked job that has somewhere to apply
export type ApplyJob = { id: string; title: string; company: string | null; url: string; matchRate: number | null; createdAt: string };
export type ApplicationEntry = { id: string; jobTitle: string | null; company: string | null; ats: string | null; applyUrl: string | null; status: ApplicationStatus; fieldsFilled: number; fieldsNeedingAttention: number; updatedAt: string };

type AutoApplyProps = { jobs: ApplyJob[]; applications: ApplicationEntry[]; profileReady: boolean; extensionConnected: boolean };

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
export function AutoApply({ jobs, applications, profileReady, extensionConnected }: AutoApplyProps) {
  const [tab, setTab] = useState<"jobs" | "applications">("jobs");
  const [consenting, setConsenting] = useState<ApplyJob | null>(null);
  const [notifications, setNotifications] = useState<"unknown" | NotificationPermission>("unknown");

  // whether browser notifications are already allowed
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ("Notification" in window) setNotifications(Notification.permission);
  }, []);

  // opens the application in a new tab and lets the extension know which job it is for
  function start(job: ApplyJob) {
    void tellExtension({ type: "resumefit-autofill", jobId: job.id });
    window.open(job.url, "_blank", "noopener");
  }

  // the first time, explain what will and will not happen
  function apply(job: ApplyJob) {
    if (localStorage.getItem(CONSENT_KEY) === "1") start(job);
    else setConsenting(job);
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings#profile" className={SECONDARY_BUTTON}>
              Preferences
            </Link>
            {!extensionConnected && (
              <Link href="/extension" className={SECONDARY_BUTTON}>
                Set up the extension
              </Link>
            )}
          </div>
        </section>
      </div>

      <div>
        <div role="tablist" aria-label="Auto apply views" className="flex gap-6 border-b border-border font-medium">
          {(
            [
              ["jobs", "Auto-Apply Jobs"],
              ["applications", "All Applications"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 pb-3 transition-colors duration-150 ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* tracked jobs that have a link to apply at */}
        {tab === "jobs" && (
          <div className="pt-5">
            {jobs.length === 0 ? (
              <EmptyState icon={Briefcase} title="No jobs to apply to yet" text="Jobs on your tracker that have a link to the posting show up here. Save one with the extension, or add the link on a job's card.">
                <Link href="/tracker" className={PRIMARY_BUTTON}>
                  Open the tracker
                </Link>
              </EmptyState>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {jobs.map((job) => {
                  const host = new URL(job.url).hostname.replace(/^www\./, "");
                  return (
                    <li key={job.id} className={`${CARD} flex flex-wrap items-center gap-x-4 gap-y-3 p-4`}>
                      {/* the site's own icon, straight from the site */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://${host}/favicon.ico`} alt="" width={32} height={32} className="size-8 shrink-0 rounded" onError={(event) => (event.currentTarget.style.visibility = "hidden")} />
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
                      <button type="button" onClick={() => apply(job)} className={`${PRIMARY_BUTTON} px-3 py-2`}>
                        <Zap className="size-4" aria-hidden />
                        Auto Apply
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* every autofill run and where it stands */}
        {tab === "applications" && (
          <div className="pt-5">
            {applications.length === 0 ? (
              <EmptyState icon={Zap} title="You don't have any applications yet" text="When you autofill an application with the extension, it is listed here with how many fields were filled and whether it has been sent." />
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
                        <td className={`py-3 pr-4 font-medium ${STATUS_LOOKS[application.status]}`}>{STATUS_LABELS[application.status]}</td>
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

      {/* shown once, before the first application */}
      <Modal open={consenting !== null} onClose={() => setConsenting(null)} title="Before your first Auto Apply">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>We open the application in a new tab. In the extension&apos;s side panel, press Autofill and it fills in the form from your profile.</li>
          <li>
            <strong>You always submit.</strong> The extension never presses Submit and never does a captcha. Read every field, fix what needs fixing, then send it yourself.
          </li>
          <li>Demographic questions are answered only with what you chose in your profile.</li>
          <li>There are no credits and no limits on how many applications you fill.</li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConsenting(null)} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(CONSENT_KEY, "1");
              if (consenting) start(consenting);
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
