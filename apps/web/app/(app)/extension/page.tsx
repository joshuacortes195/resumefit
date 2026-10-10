import { Suspense } from "react";
import { Download } from "lucide-react";
import { CopyText } from "@/components/copy-text";
import { ExtensionConnect } from "@/components/extension-connect";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/buttons";
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
        <p className="mt-1 text-muted">Auto Apply only works with this extension. It saves jobs, scans them and fills applications in for you. Nothing is sent unless you press Submit or switch on Submit for me.</p>
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
          <li><strong>From Auto Apply:</strong> press Auto Apply on a job and the extension opens the application, fills it in and puts a small bar on the page that says what still needs you. Up to five can be started together.</li>
          <li><strong>On an application form you opened yourself:</strong> press Autofill. It fills in your details, attaches your resume and colors each field: green is filled from your profile, amber is a draft to review, red needs you.</li>
          <li><strong>On your LinkedIn profile:</strong> press Import my profile and the LinkedIn Optimizer opens with your headline, About, experience and skills filled in.</li>
          <li><strong>Written questions:</strong> it drafts an answer from your resume and the job description and marks it amber for you to read and edit. An answer you saved from the panel is reused when a form asks something similar.</li>
          <li><strong>After you submit:</strong> when the site shows its thank you page, the job moves to Applied on your tracker by itself.</li>
        </ul>
        <h3 className="mt-5 font-semibold">Where autofill works</h3>
        <p className="mt-1 text-sm">
          <strong>Tuned for:</strong> {SUPPORTED.join(", ")}.
        </p>
        <p className="mt-1 text-sm">
          <strong>Best effort:</strong> {BEST_EFFORT.join(", ")}. Workday and Taleo spread a form over several steps, and usually want you to sign in first: press the site&apos;s Next button and each step is filled in as it opens.
        </p>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">What it never does</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>It never presses Submit for you, unless you switched on Submit for me on the Auto Apply page. Even then it only sends a form that is completely filled from your profile, after a countdown you can cancel.</li>
          <li>It never presses Next, and never ticks an &quot;I agree&quot; box for you.</li>
          <li>It never solves or skips a captcha.</li>
          <li>It never starts by itself. It only opens or fills an application when you press Auto Apply here or Autofill in the panel.</li>
          <li>It never guesses demographic answers. Those come only from what you chose in your profile, which starts on &quot;Decline to self-identify&quot;.</li>
        </ul>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="mt-2 text-sm">
          When you connect it, Chrome asks once whether it may work on websites, because every company keeps its applications on a different site. Press Allow, or nothing can be read or filled. It only reads a page when you open its panel
          there or when Auto Apply opened that page for you. On your computer it stores your connection key and nothing else. Everything it sends goes to
          your own ResumeFit account.
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
            <dt className="font-semibold">Auto Apply opened the page but did not fill it</dt>
            <dd className="text-muted">
              Download the extension again and reload it on chrome://extensions so you have the newest one, then click the ResumeFit icon and press Allow in its panel. Without that, Chrome does not let it see the page.
            </dd>
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
