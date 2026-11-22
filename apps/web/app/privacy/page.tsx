import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";
import { MINIMUM_AGE, OPERATOR } from "@/lib/legal";

export const metadata = { title: "Privacy Policy" };

// what we keep, why, who else touches it and how to get it back or get rid of it
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      {/* who this covers and the short version */}
      <p>
        ResumeFit is a free resume scanner, job tracker and application helper run by {OPERATOR} (&quot;ResumeFit&quot;, &quot;we&quot;, &quot;us&quot;). This policy covers the website and the ResumeFit
        browser extension. It explains what we collect, why, who helps us run the service, how long we keep things and what you can do about it.
      </p>
      <p>
        The short version: we only collect what the app needs to work, there are no ads, no analytics or tracking scripts, and we never sell or share your personal information. You can download or
        delete everything from Settings at any time.
      </p>

      {/* everything that gets stored or seen */}
      <section>
        <h2>1. What we collect</h2>
        <h3>Your account</h3>
        <ul>
          <li>Your email address, and your name and profile picture if you sign in with Google.</li>
          <li>The invite code you used, the day you joined and whether you are an admin of this copy of the app.</li>
        </ul>
        <h3>What you put into the app</h3>
        <ul>
          <li>Resumes you upload, paste or build, the files themselves and the text we read out of them.</li>
          <li>Job descriptions and job links you scan or save, and the scan reports made from them.</li>
          <li>Your job tracker: jobs, statuses, notes, dates, interviews, interviewer details you type in, cover letters and thank you notes.</li>
          <li>LinkedIn profile text you import or paste for a LinkedIn report, and your interview practice questions and answers.</li>
          <li>
            Your application profile for Auto Apply: contact details, links, education, work authorization and sponsorship answers, optional self identification answers (such as gender, race,
            veteran and disability status), salary and start date preferences, saved answers to application questions, and your sending settings.
          </li>
          <li>A record of each application the extension filled in or sent for you: the job, the form&apos;s address, the answers that were used and whether it was sent.</li>
          <li>Your own AI provider key, if you choose to add one.</li>
        </ul>
        <h3>What is recorded as you use it</h3>
        <ul>
          <li>Which AI features you used, when, which provider answered and how many tokens it took. The text that was sent is not kept in this record.</li>
          <li>Short lived counters used to stop too many requests in a short time. Sign in counters are kept under a scrambled form of your email and connection, not the real ones.</li>
          <li>
            Our hosting provider keeps standard request logs, such as IP address, browser, the page asked for and the time. Our own error messages are written so they leave out resume and job
            text.
          </li>
        </ul>
        <h3>Cookies and browser storage</h3>
        <p>
          We only use cookies the app needs to work: the sign in session cookies (which page scripts cannot read), a short lived cookie that carries your invite code while you confirm your email (one
          hour), and a cookie that remembers which resume draft you had open in the builder. The app also keeps a few conveniences in your browser&apos;s own storage, such as the extension&apos;s id
          and how far you got in Auto Apply setup. There are no advertising or analytics cookies, so there is nothing to opt out of.
        </p>
      </section>

      {/* why each thing is used */}
      <section>
        <h2>2. How we use it</h2>
        <ul>
          <li>To provide the features you ask for: scanning, scoring, the tracker, the resume builder, exports, writing help and Auto Apply.</li>
          <li>To sign you in and keep your account and data separate from everyone else&apos;s.</li>
          <li>To keep the service safe and working: limits on heavy requests, daily caps on AI features, spotting abuse and fixing errors.</li>
          <li>To answer you when you contact us.</li>
        </ul>
        <p className="mt-2">We do not use your data for advertising, we do not build profiles of you for anyone else, and we do not use your resumes to train any model of our own.</p>
      </section>

      {/* the ai part, in detail */}
      <section>
        <h2>3. AI features and what they send</h2>
        <p>
          Some features use outside AI models: resume suggestions, bullet and summary writing, cover letters and thank you notes, LinkedIn rewrites, interview practice coaching, and drafts for
          written application questions. When you press one of these, the relevant resume and job text is sent to an AI provider. Before anything is sent, the app looks for your name, email, phone
          number, street address, links and date of birth and swaps them for placeholders, then puts them back when the answer arrives. This is a best effort and can miss details written in an
          unusual way, so leave out anything you would not want an AI provider to see.
        </p>
        <p className="mt-2">
          Running a scan sends only the job description (with emails and phone numbers in it hidden first) for a better read of the skills it asks for. The match score itself is worked out by code
          inside the app. The tracker and exports never use AI.
        </p>
        <p className="mt-2">
          The providers are used on their free tiers, and free tiers may keep what they are sent and use it to improve their models under their own terms. AI output is treated as a draft: it is
          shown to you, or for Auto Apply it is only ever typed into a form, and it is never trusted to decide anything else in the app.
        </p>
      </section>

      {/* the extension, with the chrome web store wording */}
      <section>
        <h2>4. The browser extension</h2>
        <p>The extension only acts on a page when you use it there, or when you switch on sending and ask it to work through applications for you. Depending on what you press, it reads:</p>
        <ul>
          <li>The job posting on the page you have its panel open on, or text you highlight and send to it from the right click menu, so you can scan or save the job.</li>
          <li>Your own LinkedIn profile page, only when you press Import.</li>
          <li>The fields of an application form, so it can fill them in from your application profile and attach the resume and cover letter you picked.</li>
        </ul>
        <p className="mt-2">
          What it reads goes only to your ResumeFit account. It keeps its connection key and a short list of when it sent applications for you in the browser&apos;s extension storage. It does not
          read your browsing history, does not run on LinkedIn or Indeed application forms, does not load code from anywhere else, and does not pass your profile to the pages it fills beyond the
          answers it types into that form.
        </p>
        <p className="mt-2">
          <span className="font-semibold">Limited Use.</span> ResumeFit&apos;s use of information received from the extension adheres to the Chrome Web Store User Data Policy, including the Limited Use
          requirements. That information is used only to provide and improve the extension&apos;s single purpose of helping you scan, save and apply to jobs. It is not sold, not used for advertising,
          not used to decide credit or lending, and not read by people except with your permission, for security reasons or when the law requires it.
        </p>
      </section>

      {/* every outside company that touches data */}
      <section>
        <h2>5. Who helps us run it</h2>
        <p>We use a small number of service providers. They handle data only to run their part of the service.</p>
        <ul>
          <li>
            <span className="font-medium">Supabase</span>: the database, file storage for uploaded resumes, sign in, and the sign in emails.
          </li>
          <li>
            <span className="font-medium">Vercel</span>: hosts the website and the server code, and keeps request logs.
          </li>
          <li>
            <span className="font-medium">Google (Gemini API), Groq and Cloudflare (Workers AI)</span>: the AI providers, whichever is set up and answering. If you add your own Gemini key, your requests
            go to Google under your own key.
          </li>
          <li>
            <span className="font-medium">Google sign in</span>: only if you choose Continue with Google.
          </li>
          <li>
            <span className="font-medium">Job sources</span>: Find Jobs reads public job boards on Greenhouse, Lever and Ashby, and searches Remotive and Jobicy, and USAJOBS when it is set up, with the
            job title and place you typed. When you leave the title empty, the most recent job title on your resume is searched for instead. Importing a job from a link fetches that page. None
            of these are sent your resume or account details, only that title and place.
          </li>
          <li>
            <span className="font-medium">DuckDuckGo icons</span>: your browser loads the small company logos from DuckDuckGo using the company&apos;s web address, so DuckDuckGo sees that address and,
            like any site you load an image from, your IP address.
          </li>
          <li>
            <span className="font-medium">Your browser&apos;s speech service</span>: voice answers in interview practice use the speech recognition built into your browser, which may send the audio
            to your browser maker to turn it into text. Typing your answer avoids this.
          </li>
        </ul>
      </section>

      {/* who else can see it */}
      <section>
        <h2>6. Who can see your data</h2>
        <p>
          Only you can see your resumes, scans, tracker and everything you write in the app. Uploaded files sit in private storage and are never public. The admin of this copy of ResumeFit can see a
          list of members (email, name, the day they joined, the invite code used and how many scans they ran) and overall AI usage, but cannot open anyone else&apos;s resumes, scans or tracker
          through the app.
        </p>
        <p className="mt-2">
          We do not sell your personal information and we do not share it for cross context behavioral advertising. We only disclose it to the service providers above, when you ask us to, or if the
          law requires it.
        </p>
      </section>

      {/* how long things stay */}
      <section>
        <h2>7. How long we keep it</h2>
        <ul>
          <li>Your account and what you put into it are kept until you delete them or delete your account.</li>
          <li>Deleting your account removes your files and every row of your data from the app&apos;s database and file storage straight away, along with your sign in record.</li>
          <li>Extension connection keys stop working after 90 days. Request counters are cleared after a day. Saved job search results, which are not tied to you, are cleared after a week.</li>
          <li>The skills read from a job description are kept, without the emails and phone numbers that were hidden, so the same posting does not have to be sent again.</li>
          <li>Our providers&apos; logs and backups are kept for a limited time under their own policies.</li>
        </ul>
      </section>

      {/* what people can do */}
      <section>
        <h2>8. Your choices and rights</h2>
        <ul>
          <li>
            <span className="font-medium">See and download your data</span>: Settings has a Download everything button that gives you a zip with everything stored for you and the files you uploaded.
          </li>
          <li>
            <span className="font-medium">Correct it</span>: edit your resumes, tracker, profile and application answers in the app at any time.
          </li>
          <li>
            <span className="font-medium">Delete it</span>: delete single items where they are, or delete your whole account from Settings. Deleting is permanent.
          </li>
          <li>
            <span className="font-medium">Stop AI processing</span>: AI features only run when you press them, and Auto Apply only sends when you switch sending on.
          </li>
        </ul>
        <h3>California residents</h3>
        <p>
          Under the California Consumer Privacy Act as amended by the CPRA, you have the right to know what personal information we collect, use and disclose, to delete it, to correct it, and to opt
          out of its sale or sharing. We do not sell or share personal information, so there is nothing to opt out of, and we do not use sensitive personal information to infer things about you. You
          will not be treated differently for using any of these rights. You can use them in the app as described above, or by writing to us. We may need to confirm the request comes from the account
          holder, and you can name someone to make a request for you.
        </p>
        <h3>Visitors from the EU, the UK and similar places</h3>
        <p>
          You have the right to access, correct, delete and receive a copy of your data, to object to or restrict how it is used, and to withdraw consent where we rely on it. We process your data to
          provide the service you signed up for, for our legitimate interest in keeping it secure and working, and with your consent for optional features such as Auto Apply sending. Our providers
          may process data in the United States and other countries where they operate. You can also complain to your local data protection authority.
        </p>
      </section>

      {/* age */}
      <section>
        <h2>9. Children</h2>
        <p>
          ResumeFit is not for anyone under {MINIMUM_AGE}, and we do not knowingly collect data from them. If you believe a person under {MINIMUM_AGE} has made an account, write to us and we will
          delete it.
        </p>
      </section>

      {/* how it is protected */}
      <section>
        <h2>10. Security</h2>
        <p>
          The site only runs over https. Sign in uses one time email links or Google, so there is no password to steal. Every request is checked against the signed in account, work authorization,
          self identification answers and the answers used on each application are encrypted before they are stored, and API keys you add are encrypted too. No system is perfectly secure, so we
          cannot promise that nothing will ever go wrong. If you find a security problem, please tell us.
        </p>
      </section>

      {/* changes and contact */}
      <section>
        <h2>11. Changes to this policy</h2>
        <p>If this policy changes, the date at the top changes too. For a change that matters, we will also put a note in the app.</p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions, requests about your data or a security report: <Contact />. See also the <Link href="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
