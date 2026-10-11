import { Suspense } from "react";
import { Download } from "lucide-react";
import { CopyText } from "@/components/copy-text";
import { ExtensionConnect } from "@/components/extension-connect";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { extensionStatus } from "@/lib/data/extension";

export const metadata = { title: "Chrome Extension" };

// install steps, connecting, what it works on and what it does with your data
export default function ExtensionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Chrome Extension</h1>
        <p className="mt-1 text-muted">Scan any job posting against your resume without leaving the page, and save it to your tracker in one click.</p>
      </div>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">1. Install it</h2>
        <p className="mt-2 text-sm text-muted">It is not in the Chrome Web Store yet, so you add it yourself. It takes about a minute and you only do it once.</p>
        {/* the folder Chrome needs, ready to download */}
        <a href="/resumefit-extension.zip" download className={`${PRIMARY_BUTTON} mt-4`}>
          <Download className="size-4" aria-hidden />
          Download the extension
        </a>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <strong>Download it</strong> with the button above. A file called <strong>resumefit-extension.zip</strong> lands in your Downloads folder.
          </li>
          <li>
            <strong>Open that file.</strong> On a Mac, double click it. On Windows, right click it and choose Extract All. Either way you end up with a folder called <strong>resumefit-extension</strong>.
          </li>
          <li>
            <strong>Open Chrome&apos;s extensions page.</strong> Copy this, paste it into the address bar and press Enter: <CopyText text="chrome://extensions" />
          </li>
          <li>
            <strong>Turn on Developer mode</strong> with the switch in the top right corner of that page.
          </li>
          <li>
            <strong>Press Load unpacked</strong> (top left) and pick the <strong>resumefit-extension</strong> folder from your Downloads.
          </li>
          <li>
            <strong>Pin it.</strong> Click the puzzle piece in Chrome&apos;s toolbar, then the pin next to ResumeFit, so it is always one click away.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted">Leave the folder where it is. Chrome runs the extension from it, so deleting or moving the folder removes the extension.</p>
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
          <li><strong>On your LinkedIn profile:</strong> press Import my profile and the LinkedIn Optimizer opens with your headline, About, experience and skills filled in.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">What it never does</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>It never fills in or sends an application. It only reads job postings, and your own LinkedIn profile when you ask.</li>
          <li>It never looks at a page by itself. It reads the page you are on only while its panel is open there.</li>
          <li>It never changes anything on the page.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="mt-2 text-sm">
          When you connect it, Chrome asks once whether it may read websites, because job postings live on all kinds of sites. Press Allow, or it cannot see the posting. It only reads the page you have its panel open on. On your
          computer it stores your connection key and nothing else. Everything it sends goes to your own ResumeFit account.
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
            <dt className="font-semibold">The panel says it is not allowed on this page</dt>
            <dd className="text-muted">Press Allow in the panel, then Allow again in the box Chrome shows. You only do this once.</dd>
          </div>
          <div>
            <dt className="font-semibold">It says there is no job posting on the page</dt>
            <dd className="text-muted">Highlight the job description, right click it and choose &quot;Scan this job description with ResumeFit&quot;. That works on any page.</dd>
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
  return <ExtensionConnect connected={status.connected} lastUsed={status.lastUsedAt ? status.lastUsedAt.toISOString() : null} />;
}
