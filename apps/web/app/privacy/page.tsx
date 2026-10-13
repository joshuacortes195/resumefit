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
        <p className="mt-2">Only you can see your resumes, scans, tracker and everything you write here. Uploaded files are kept in private storage and are never public.</p>
        <p className="mt-2">
          The person who runs this copy of ResumeFit can see a list of members: each email address and name, the day they joined, the invite code they used and how many scans they have run. They cannot
          open anyone's resumes, scans or tracker.
        </p>
      </section>

      <section>
        <h2>What the AI features send, and where</h2>
        <p>
          AI features send redacted resume and job text to a free AI provider: Groq, Google Gemini or Cloudflare Workers AI, whichever is set up and answering. Free tiers may use what they are sent to
          improve their models. Before anything is sent, the app looks for your name, email, phone number, street address, links and date of birth and swaps them for placeholders, then puts them
          back when the answer arrives. A hiring manager's name you type for a cover letter is swapped out the same way.
        </p>
        <p className="mt-2">
          This is a best effort. It works from the usual ways these details are written and from what the app read off the top of your resume, so something written in an unusual way can slip through.
          Leave out anything you would not want an AI provider to see.
        </p>
        <p className="mt-2">Your resume is only ever sent when you press a button that uses AI.</p>
        <p className="mt-2">
          Running a scan sends the job description, never your resume, for a smarter read of the skills the posting asks for. Emails and phone numbers in the posting are hidden first, and the read is
          saved so the same posting is not sent again. The match score itself is worked out by plain code inside the app.
        </p>
        <p className="mt-2">The tracker and exports never use AI and never leave the app.</p>
      </section>

      <section>
        <h2>Company logos</h2>
        <p>
          Find Jobs shows a small logo next to each company. Your browser loads it from DuckDuckGo's icon service using the company's web address, so DuckDuckGo sees that address and, like any site
          you load an image from, your IP address. Nothing about your account or your resume goes with it.
        </p>
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
