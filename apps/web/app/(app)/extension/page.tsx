import { Suspense } from "react";
import { ExtensionConnect } from "@/components/extension-connect";
import { CARD } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { extensionStatus } from "@/lib/data/extension";

export const metadata = { title: "Chrome Extension" };

// sites with their own fine tuned form reading, the rest are matched by label
const SUPPORTED = ["Greenhouse", "Lever", "Ashby", "Workable", "Workday", "SmartRecruiters"];
const BEST_EFFORT = ["iCIMS", "Jobvite", "BambooHR", "Taleo", "and most other application forms"];

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// install steps, connecting, what it works on and what it does with your data
export default function ExtensionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Chrome Extension</h1>
        <p className="mt-1 text-muted">Save jobs, scan them and fill in applications right from the page you are on. You always review and press submit yourself.</p>
      </div>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">1. Install it</h2>
        <p className="mt-2 text-sm text-muted">The extension is not in the Chrome Web Store yet, so it is loaded by hand. It takes a minute.</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Get the extension folder. If you have the project, run <code className="rounded bg-background px-1">pnpm --filter @resumefit/extension build</code> and use <code className="rounded bg-background px-1">apps/extension/dist</code>. Otherwise unzip the file you were sent.</li>
          <li>Open <code className="rounded bg-background px-1">chrome://extensions</code> in Chrome.</li>
          <li>Turn on <strong>Developer mode</strong>, top right.</li>
          <li>Press <strong>Load unpacked</strong> and pick the folder.</li>
          <li>Pin ResumeFit from the puzzle icon in the toolbar so it is easy to reach.</li>
        </ol>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">2. Connect it to your account</h2>
        <div className="mt-4">
          <Suspense fallback={<Skeleton className="h-32" />}>
            <ConnectLoader />
          </Suspense>
        </div>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">What it does</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li><strong>On a job posting:</strong> save the job to your tracker, or scan it against your resume and see your match rate and the top missing skills without leaving the page.</li>
          <li><strong>On any page:</strong> highlight a job description, right click and choose &quot;Scan this job description with ResumeFit&quot;.</li>
          <li><strong>On an application form:</strong> press Autofill. It fills in your details, attaches your resume and colors each field: green is filled from your profile, amber is a draft to review, red needs you.</li>
          <li><strong>Written questions:</strong> it uses an answer you saved before when one fits, otherwise it can draft one from your resume for you to edit.</li>
        </ul>
        <h3 className="mt-5 font-semibold">Where autofill works</h3>
        <p className="mt-1 text-sm">
          <strong>Tuned for:</strong> {SUPPORTED.join(", ")}.
        </p>
        <p className="mt-1 text-sm">
          <strong>Best effort:</strong> {BEST_EFFORT.join(", ")}. Workday and Taleo spread a form over several pages: press the site&apos;s Next button yourself, then Fill again on each page.
        </p>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">What it never does</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>It never presses Submit, Apply or Next for you. You review every field and send the application yourself.</li>
          <li>It never solves or skips a captcha.</li>
          <li>It never runs by itself. Nothing happens on a page until you open the panel and press a button.</li>
          <li>It never guesses demographic answers. Those come only from what you chose in your profile, which starts on &quot;Decline to self-identify&quot;.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="mt-2 text-sm">
          The extension asks Chrome for access one site at a time, the first time you use it there. It reads the job posting or form on the page you are looking at, only when you press a button. On your computer it stores your
          connection key and nothing else. Everything it sends goes to your own ResumeFit account.
        </p>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">If something is not working</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">The panel says it is not connected</dt>
            <dd className="text-muted">Press Connect again above and paste the new code. A connection lasts 90 days, and connecting again replaces the old one.</dd>
          </div>
          <div>
            <dt className="font-semibold">&quot;Check this page&quot; asks for permission</dt>
            <dd className="text-muted">That is Chrome asking whether ResumeFit may read this one site. Choose Allow and press the button again.</dd>
          </div>
          <div>
            <dt className="font-semibold">A field was not filled</dt>
            <dd className="text-muted">Red fields are ones we had no answer for. Add the detail to your profile in Settings, or type it in on the page. Custom dropdowns on some sites have to be picked by hand.</dd>
          </div>
          <div>
            <dt className="font-semibold">The resume did not attach</dt>
            <dd className="text-muted">Some sites only accept a file you choose yourself. Download your resume from the Resume Manager and attach it on the page.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

// loads whether an extension is connected right now
async function ConnectLoader() {
  const user = await getCurrentUser();
  const status = await extensionStatus(user.id);
  return <ExtensionConnect connected={status.connected} lastUsed={status.lastUsedAt ? WHEN.format(status.lastUsedAt) : null} />;
}
