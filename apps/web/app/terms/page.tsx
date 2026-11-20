import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";
import { GOVERNING_LAW, MINIMUM_AGE, OPERATOR } from "@/lib/legal";

export const metadata = { title: "Terms of Service" };

// the rules for using the app, written to be read
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      {/* who the agreement is with */}
      <p>
        These terms are an agreement between you and {OPERATOR}, who runs ResumeFit (&quot;ResumeFit&quot;, &quot;we&quot;, &quot;us&quot;). They cover the ResumeFit website and browser extension
        (together, the &quot;service&quot;). By creating an account or using the service you agree to them. If you do not agree, do not use the service.
      </p>

      <section>
        <h2>1. Who can use it</h2>
        <p>
          You must be at least {MINIMUM_AGE} years old. You are responsible for your account and for anything done through it, so keep access to your email safe and tell us if you think someone else
          has used your account.
        </p>
      </section>

      <section>
        <h2>2. A free service</h2>
        <p>
          ResumeFit is free. There are no paid plans and we will not charge you for anything without new terms that you agree to first. Some features have daily limits so the free AI providers stay
          available for everyone. We may change, pause or stop any feature, or the whole service, at any time.
        </p>
      </section>

      <section>
        <h2>3. Your content</h2>
        <p>
          You own what you upload, paste or write in the service, such as resumes, job descriptions, notes and answers (&quot;your content&quot;). You give us a limited, worldwide, royalty free license
          to store, copy, process and display your content only as needed to run the service for you, including sending parts of it to the AI providers and other service providers described in the{" "}
          <Link href="/privacy" className="font-medium text-primary hover:underline">
            Privacy Policy
          </Link>
          . This license ends when you delete the content or your account, apart from copies our providers keep for a limited time in backups and logs.
        </p>
        <p className="mt-2">You promise that you have the right to use your content, and that what you put in a resume or an application about yourself is true.</p>
      </section>

      <section>
        <h2>4. AI features</h2>
        <p>
          Some features send your content to outside AI providers (currently Google Gemini, Groq and Cloudflare Workers AI) to draft suggestions, letters and answers. AI output can be wrong,
          incomplete or made up. It is a draft for you to check. Only keep what is accurate for you, and do not rely on it for legal, financial or immigration questions. Match scores and checks are
          estimates of how hiring software might read your resume. They do not promise an interview or a job.
        </p>
      </section>

      <section>
        <h2>5. Auto Apply</h2>
        <p>The extension can fill in job application forms for you and, only if you switch sending on in your application profile, press Submit for you. If you use it:</p>
        <ul>
          <li>You are responsible for every application submitted through the service on your behalf, and for every answer in it, drafted answers included. What is sent is your own statement to that employer.</li>
          <li>Review what it filled in before you send, or before you switch sending on. The tool can make mistakes, such as picking the wrong option, misreading a question or attaching the wrong file.</li>
          <li>
            Following each job site&apos;s and employer&apos;s terms is your responsibility. Do not use Auto Apply on a site whose terms forbid automated tools. The extension stays off LinkedIn and
            Indeed by itself, only sends on Greenhouse, Lever and Ashby forms, never solves a captcha and stops at the daily number you set, but that does not make any particular use allowed.
          </li>
          <li>We are not responsible for how an employer or job site treats an application, including one that was sent with a mistake in it, rejected, or caused your account there to be limited.</li>
        </ul>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Break the law, or use the service to mislead an employer with false information about yourself or anyone else.</li>
          <li>Upload content you do not have the right to use, or another person&apos;s resume or personal details without their permission.</li>
          <li>Try to get into another person&apos;s account or data, probe or break the service&apos;s security, or get around its limits.</li>
          <li>Send malware, run scripts or bots against the service, or use it in a way that uses up the shared limits for everyone else.</li>
          <li>Use the service to get around another site&apos;s rules, or to copy, resell or build a competing product from it.</li>
          <li>Try to make the AI features produce harmful, hateful or illegal content.</li>
        </ul>
        <p className="mt-2">Found a security problem? Please report it to us instead of testing it on other people&apos;s data.</p>
      </section>

      <section>
        <h2>7. No warranty</h2>
        <p className="uppercase">
          The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a
          particular purpose, accuracy and non infringement. We do not promise that the service will be uninterrupted, error free or secure, or that it will keep your data forever. Keep your own copies
          of anything important.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p className="uppercase">
          To the fullest extent the law allows, {OPERATOR} will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any lost profits, lost opportunities,
          lost data or job outcomes, arising from or related to the service or these terms, even if told they were possible. Since the service is free, our total liability for any claim is limited to
          one hundred US dollars (US $100). Some places do not allow some of these limits, so they may not all apply to you.
        </p>
      </section>

      <section>
        <h2>9. Indemnity</h2>
        <p>
          If someone makes a claim against us because of your content, your applications or your breaking these terms, you agree to cover the reasonable costs of that claim, to the extent the law
          allows.
        </p>
      </section>

      <section>
        <h2>10. Ending your use</h2>
        <p>
          You can stop using the service and delete your account from Settings at any time. We may suspend or close an account that breaks these terms, puts the service or other people at risk, or has
          to be closed by law. Sections 3 (the promises you make about your content), 5, 7, 8, 9 and 12 continue after your use ends.
        </p>
      </section>

      <section>
        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows the latest version, and for a change that matters we will also put a note in the app. If you keep using the service after a change, you
          accept the new terms.
        </p>
      </section>

      <section>
        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of {GOVERNING_LAW}, without regard to its conflict of law rules. Any dispute will be handled in the state or federal courts located in California, and
          both sides agree to that place. Nothing here takes away rights you have under the consumer laws of the place you live.
        </p>
      </section>

      <section>
        <h2>13. Everything else</h2>
        <p>
          These terms and the Privacy Policy are the whole agreement about the service. If part of them cannot be enforced, the rest still applies. Not enforcing a part right away does not mean we
          give it up. You may not transfer these terms to someone else.
        </p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <p>
          Questions about these terms: <Contact />.
        </p>
      </section>
    </LegalPage>
  );
}
