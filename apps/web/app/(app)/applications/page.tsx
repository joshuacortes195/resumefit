import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import { AutoApplyButton } from "@/components/auto-apply-button";
import { LocalTime } from "@/components/local-time";
import { CARD, LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { runLabel, type RunLabel } from "@/lib/application-status";
import { getCurrentUser } from "@/lib/auth";
import { AutoApplySetup } from "@/components/auto-apply-setup";
import { NeedsYou } from "@/components/needs-you";
import { listApplications, listWaiting } from "@/lib/data/applications";
import { extensionStatus } from "@/lib/data/extension";
import { getProfile, profileReady } from "@/lib/data/profile";
import { listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";

export const metadata = { title: "All Applications" };

// the color each kind of run wears
const TONES: Record<RunLabel["tone"], string> = { good: "bg-success/10 text-success", warn: "bg-warning/10 text-warning", muted: "bg-border/60 text-muted", bad: "bg-danger/10 text-danger" };

// every application the extension filled in, with how each one was left
export default function ApplicationsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">All Applications</h1>
      <p className="mt-1 mb-6 max-w-2xl text-muted">Every application Auto Apply filled in for you, and where each one stands. You press Submit yourself unless you switched sending on in your application profile. Anything sent for you is marked Sent for me.</p>
      <Suspense fallback={<TableSkeleton />}>
        <Runs />
      </Suspense>
    </div>
  );
}

// the list itself
async function Runs() {
  const user = await getCurrentUser();
  const [runs, flags, waiting, profile, resumes, extension] = await Promise.all([listApplications(user.id), featureFlags(), listWaiting(user.id), getProfile(user.id), listResumes(user.id), extensionStatus(user.id)]);
  // the one time setup, shown until it is done
  const setup = flags.autoApply ? <AutoApplySetup hasResume={resumes.length > 0} profileReady={profileReady(profile)} sending={profile.autoSend !== "off"} everConnected={extension.connected} /> : null;

  if (runs.length === 0) {
    return (
      <>
      {setup}
      <EmptyState icon={ClipboardList} title="No applications yet" text={flags.autoApply ? "Open a job on your tracker and press Auto Apply. The extension fills in the form, and you check it and press Submit unless you asked for it to be sent for you." : "Auto Apply is switched off for now."}>
        <Link href="/tracker" className={SECONDARY_BUTTON}>
          Open the tracker
        </Link>
      </EmptyState>
      </>
    );
  }

  return (
    <>
    {setup}
    {/* what is waiting on the person comes first */}
    {flags.autoApply && <NeedsYou runs={waiting} />}
    <div className={CARD}>
      {/* on a phone the form and date columns step aside, so the table never runs off the screen */}
      <table className="w-full table-fixed text-sm sm:table-auto">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Job</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Form</th>
            <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Last touched</th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const label = runLabel(run);
            return (
              <tr key={run.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-background/60">
                <th scope="row" className="break-words px-4 py-3 text-left font-normal">
                  {/* the tracker card when there is one, otherwise just where the form was */}
                  {run.jobId ? (
                    <Link href={`/tracker/${run.jobId}/application`} className="font-semibold hover:text-primary">
                      {run.jobTitle ?? "Untitled job"}
                    </Link>
                  ) : (
                    <span className="font-semibold">Not on your tracker</span>
                  )}
                  <span className="block text-muted">{run.company ?? (run.applyUrl ? new URL(run.applyUrl).hostname : "")}</span>
                </th>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium sm:whitespace-nowrap ${TONES[label.tone]}`}>{label.text}</span>
                  {/* a form we cannot send says why, so it is clear this one is finished on the job site */}
                  {run.stuck && run.stuck !== "Sending is switched off in your application profile." && <span className="mt-1 block text-xs text-muted">Yours to finish. {run.stuck}</span>}
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  {run.ats ? `${run.ats}, ` : ""}
                  {run.fieldsFilled} filled{run.fieldsNeedingAttention > 0 ? `, ${run.fieldsNeedingAttention} to check` : ""}
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  <LocalTime value={run.updatedAt.toISOString()} style="date" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-start sm:justify-end sm:gap-3">
                    {run.applyUrl && (
                      <a href={run.applyUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 whitespace-nowrap ${LINK_BUTTON}`}>
                        <ExternalLink className="size-3.5" aria-hidden />
                        Posting
                      </a>
                    )}
                    {/* a run that was not sent can be picked up again */}
                    {flags.autoApply && run.jobId && run.status !== "applied" && <AutoApplyButton jobId={run.jobId} url={run.applyUrl} label="Open again" className={`${SECONDARY_BUTTON} px-3 py-1.5`} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
