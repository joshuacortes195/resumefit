import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy" };

// what we keep, what leaves the app and how to get rid of it, in plain english
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="October 2026">
      <p>ResumeFit is a free tool I built for myself and my friends. It is not a business. There are no ads, nothing is sold and there is no tracking beyond what the app needs to work.</p>

      <section>
        <h2>What is stored</h2>
        <ul>
          <li>The resumes you upload or paste, and the text we read out of them.</li>
          <li>The job descriptions you scan, your scan reports, and the jobs, notes, interviews and cover letters on your tracker.</li>
          <li>Your email address, so you can sign in.</li>
        </ul>
        <p className="mt-2">Only you can see your own data. Uploaded files are kept in private storage and are never public.</p>
      </section>

      <section>
        <h2>What the AI features send, and where</h2>
        <p>
          AI features send redacted resume and job text to a free AI provider: Groq, Google Gemini or Cloudflare Workers AI, whichever is set up and answering. Free tiers may use what they are sent to
          improve their models. Your name and contact info are removed first: your name, email, phone number, street address and links are swapped for placeholders before anything is sent, and put
          back when the answer arrives.
        </p>
        <p className="mt-2">Nothing is sent to any of them until you press a button that uses AI.</p>
        <p className="mt-2">Match scores, reports, the tracker and exports never use AI and never leave the app.</p>
      </section>

      <section>
        <h2>The browser extension</h2>
        <p>The extension reads the job posting on the page you have its panel open on, and your own LinkedIn profile when you press Import. It never fills in or sends anything.</p>
      </section>

      <section>
        <h2>Your own API key</h2>
        <p>If you add your own Gemini key it is stored encrypted and only used for your requests. You can remove it in Settings at any time.</p>
      </section>

      <section>
        <h2>Leaving</h2>
        <p>You can download everything you have stored, or delete your account and all of its data, from Settings. Deleting is permanent.</p>
      </section>
    </LegalPage>
  );
}
