# Security

ResumeFit holds resumes, job applications and application answers, so security is treated as part of every feature. This page explains how the app protects that data and how to report a problem.

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

- Use **Report a vulnerability** on the repository's Security tab (GitHub private vulnerability reporting), or
- write to the contact address listed at the bottom of the [Privacy Policy](https://resumefit-three.vercel.app/privacy).

Include what you found, the steps to reproduce it and what an attacker could do with it. Please do not access other people's data, run automated scans against the live site, or do anything that slows it down for others. Only test against your own account.

I will confirm the report within a few days, keep you updated while it is fixed and credit you if you want. ResumeFit is a free personal project, so there is no bug bounty.

## What is covered

- The web app at https://resumefit-three.vercel.app and the code in this repository
- The newest version of the ResumeFit browser extension

## How the app protects data

**Accounts and access**
- Sign in is by one time email link or Google, so there are no passwords to steal. New accounts need an invite code while the app is invite only, and sign in attempts are rate limited per email and per connection.
- Every page, API route and server action works out the signed in user on the server and every query is scoped to that user. Ids from the browser are never trusted on their own. Tests check that one person can never read or change another person's data.
- Row level security is on for every database table with no public policies, so the database cannot be read through the public Supabase API. The service role key is only read in server code.
- Session cookies are `HttpOnly`, `Secure` and `SameSite=Lax`.

**Browser protections**
- A strict Content Security Policy with a fresh nonce on every request, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, `nosniff`, a strict referrer policy, a locked down Permissions Policy and `Cross-Origin-Opener-Policy`.
- API requests that change something are refused when they come from another site, on top of the framework's own origin check for server actions.
- Private pages are sent with `Cache-Control: private, no-store` and `noindex`.
- No user content is ever rendered as raw HTML, and links that come from job sites or users are only kept when they are plain `http`/`https` addresses.

**Uploads and outside requests**
- Uploaded files are identified by their own bytes, not their name, capped at 4 MB, and only PDF and DOCX are read. PDFs have a page limit and a time limit, and DOCX files are checked for zip bombs (entry count, unpacked size and XML size) before they are read.
- Importing a job from a link only fetches public `https` pages. Every redirect hop is checked again, and private, local and reserved addresses are refused at the moment of connecting, not only when the link is first checked. Responses are capped in size and time.
- Expensive and AI routes are rate limited per user, with daily caps on AI features.

**AI features**
- Names, emails, phone numbers, addresses, links and dates of birth are swapped for placeholders before text is sent to a model.
- Resume, posting and form text is quoted and treated as material, never as instructions, and quote marks inside it cannot close the quotes early.
- Model output is only ever shown to the user or typed into a form field. It is never used to decide what the app does.

**Stored secrets**
- Work authorization, self identification answers, the answers used on each application and any API key a user adds are encrypted with AES-256-GCM before they are stored.
- Extension connection keys are stored only as a hash and expire after 90 days.

**Browser extension**
- No host access by default. Access to pages is asked for when it is needed, and no remote code is ever loaded.
- Only the ResumeFit web app can message the extension, and a connection it offers has to be approved in the side panel.
- Submitting an application is off by default. When a user switches it on, it only happens on Greenhouse, Lever and Ashby forms, never on LinkedIn or Indeed, never past a captcha, and never more than the user's daily number. The daily number is counted by both the app and the extension.

**Your data**
- Anyone can download everything stored for them, or delete their account, from Settings. Deleting removes their files, every row of their data and their sign in record.

## Dependencies

`pnpm audit` is run during security passes and high or critical advisories are fixed straight away.
