import { Suspense } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { CopyText } from "@/components/copy-text";
import { ExtensionConnect } from "@/components/extension-connect";
import { CARD, LINK_BUTTON, PRIMARY_BUTTON } from "@/components/ui/buttons";
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
        <p className="mt-1 text-muted">Scan any job posting against your resume without leaving the page, save it to your tracker in one click, and have application forms filled in for you to check.</p>
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
          <li>
            <strong>On an application form (Auto Apply):</strong> press Fill this application and it types in the answers from your{" "}
            <Link href="/settings/application" className={LINK_BUTTON}>
              application profile
            </Link>
            , attaches the resume you picked and the cover letter saved for that job, and drafts answers to the written questions. Then it stops and lists what it filled, what needs a look and what is still empty. You read it over and press the site&apos;s own Submit button.
          </li>
        </ul>
      </section>

      {/* exactly how auto apply behaves, since it is the one thing here that changes a page */}
      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">How Auto Apply stays safe</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>It never presses Submit, Next or Continue. Sending an application is always your own click.</li>
          <li>One application at a time, and only when you press the button. Nothing is filled in the background.</li>
          <li>It does not run on LinkedIn or Indeed, whose rules forbid it, and it never touches a captcha.</li>
          <li>A field outlined in yellow is a draft or a close match, so read it. One outlined in red is required and still empty.</li>
          <li>Gender, race, veteran, disability and sponsorship questions are only ever answered with what you chose in your application profile. Each one starts on &quot;Decline to self-identify&quot;.</li>
          <li>A drafted answer uses your resume and the job description, with your name and contact details taken out before anything is sent to a model, and it is always marked for you to check.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">What it never does</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>It never sends an application. It can fill a form in when you ask, and pressing Submit is left to you.</li>
          <li>It never looks at a page by itself. It reads the page you are on only while its panel is open there.</li>
          <li>It never changes anything on a page unless you press Fill this application, and then only the form&apos;s own fields.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="mt-2 text-sm">
          When you connect it, Chrome asks once whether it may read websites, because job postings live on all kinds of sites. Press Allow, or it cannot see the posting. It only reads the page you have its panel open on. On your
          computer it stores your connection key and nothing else. Everything it sends goes to your own ResumeFit account. For Auto Apply it fetches your application profile and the resume file from your account each time, uses them on the form in front of you and keeps no
          copy.
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
