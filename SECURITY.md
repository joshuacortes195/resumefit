# Security

ResumeFit holds resumes, job applications and application answers, so security is treated as part of every feature. This page explains how the app protects that data and how to report a problem.

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

- Use **Report a vulnerability** on the repository's Security tab (GitHub private vulnerability reporting), or
- write to the contact address listed at the bottom of the [Privacy Policy](https://resumefit-three.vercel.app/privacy).

The same details are in [`/.well-known/security.txt`](https://resumefit-three.vercel.app/.well-known/security.txt).

Include what you found, the steps to reproduce it and what an attacker could do with it. Please do not access other people's data, run automated scans against the live site, or do anything that slows it down for others. Only test against your own account.

I will confirm the report within a few days, keep you updated while it is fixed and credit you if you want. ResumeFit is a free personal project, so there is no bug bounty.

## What is covered

- The web app at https://resumefit-three.vercel.app and the code in this repository
- The newest version of the ResumeFit browser extension

## How the app protects data

**Accounts and access**
- Sign in is by one time email link or Google, so there are no passwords to steal. New accounts need an invite code while the app is invite only, and sign in attempts are rate limited per email and per connection.
- The email sign in form can also show a Cloudflare Turnstile check. It is off unless its keys are set, and when it is on the sign in service checks the answer before any email is sent.
- The admin can clear out sign in records that never got past the invite code once they are over a week old. It is a button on the admin page, never a scheduled job, and it never touches anyone who has an account in the app.
- Every page, API route and server action works out the signed in user on the server and every query is scoped to that user. Ids from the browser are never trusted on their own. Tests check that one person can never read or change another person's data.
- Row level security is on for every database table with no public policies, so the database cannot be read through the public Supabase API. The service role key is only read in server code.
- Session cookies are `HttpOnly`, `Secure` and `SameSite=Lax`, and run out after 90 days without a visit. The one time cookies used while signing in are cleared as soon as sign in finishes.
- The admin page answers a plain 404 to anyone who is not the admin, the same as an address that does not exist.

**Browser protections**
- A strict Content Security Policy with a fresh nonce on every request, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, `nosniff`, a strict referrer policy, a locked down Permissions Policy and `Cross-Origin-Opener-Policy`. API answers also carry `Cross-Origin-Resource-Policy: same-origin`.
- API requests and server actions that change something are refused when they come from another site, on top of the framework's own origin check for server actions, including when the browser leaves the origin out.
- Private pages are sent with `Cache-Control: private, no-store` and `noindex`.
- No user content is ever rendered as raw HTML, and links that come from job sites or users are only kept when they are plain `http`/`https` addresses.

**Uploads and outside requests**
- Uploaded files are identified by their own bytes, not their name, capped at 4 MB, and only PDF and DOCX are read. PDFs have a page limit and a time limit, and DOCX files are checked for zip bombs (entry count, unpacked size and XML size) before they are read.
- Importing a job from a link only fetches public `https` pages. Every redirect hop is checked again, and private, local and reserved addresses are refused at the moment of connecting, not only when the link is first checked. Responses are capped in size and time.
- Expensive and AI routes are rate limited per user, with daily caps on AI features, a daily cap per person across all of them and one shared daily cap across everyone. Every request to a model has a ceiling on how long its reply can be.

**AI features**
- Names, emails, phone numbers, addresses, links and dates of birth are swapped for placeholders before text is sent to a model.
- Resume, posting and form text is quoted and treated as material, never as instructions, and quote marks inside it cannot close the quotes early.
- Model output is only ever shown to the user or typed into a form field. It is never used to decide what the app does.

**Stored secrets**
- Work authorization, self identification answers, saved answers to application questions (including ones remembered from an application), the answers used on each application and any API key a user adds are encrypted with AES-256-GCM before they are stored.
- Extension connection keys are stored only as a hash and expire after 90 days.

**Browser extension**
- No host access by default. Access to pages is asked for when it is needed, and no remote code is ever loaded.
- Only the ResumeFit web app can message the extension, and a connection it offers has to be approved in the side panel. The other way round, the app's extension endpoints only answer cross site requests from the ResumeFit extension's own id.
- Submitting an application is off by default. When a user switches it on, it only happens on Greenhouse, Lever and Ashby forms, never on LinkedIn or Indeed, never past a captcha, and never more than the user's daily number. The daily number is counted by both the app and the extension.

**Your data**
- Anyone can download everything stored for them, or delete their account, from Settings. Deleting removes their files, every row of their data, their sign in record and the sign in counter kept under a hash of their email.
- Deleting a resume also takes its text, and everything read from it, out of the scans run with it. The scans keep their score and report, and their AI Optimize drafts are deleted.

## Dependencies

`pnpm audit` is run during security passes and high or critical advisories are fixed straight away.
