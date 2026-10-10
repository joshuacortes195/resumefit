import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms" };

// the ground rules, in plain english
export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="October 2026">
      <p>ResumeFit is a free personal project shared with friends. By using it you agree to the few things below.</p>

      <section>
        <h2>No guarantees</h2>
        <p>
          The app is provided as is, with no warranty of any kind. A high match rate does not promise an interview, and the checks are educated guesses about how hiring software behaves. The app may
          change, break or go away.
        </p>
      </section>

      <section>
        <h2>Your resume is yours</h2>
        <p>You keep all rights to what you upload and write. You are responsible for it being true. Suggestions from the AI features are drafts: only keep what is accurate for you.</p>
      </section>

      <section>
        <h2>AI features</h2>
        <p>They run on free tiers from outside providers, can be slow or unavailable, and have daily limits. See the privacy page for what is sent to them.</p>
      </section>

      <section>
        <h2>The extension fills, you submit</h2>
        <p>Autofill fills in forms. You review every application and press the site&apos;s own submit button yourself, unless you switch on Submit for me, which sends applications that are completely filled from your profile. Either way, what is sent is your responsibility, so keep your profile and saved answers correct.</p>
      </section>

      <section>
        <h2>Be reasonable</h2>
        <p>Do not use the app to break the law, to get around another site&apos;s rules, or in a way that uses up the shared free limits for everyone else.</p>
      </section>
    </LegalPage>
  );
}
