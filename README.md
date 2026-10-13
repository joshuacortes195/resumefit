# ResumeFit

**Live app:** https://resumefit-three.vercel.app (the [sample scan](https://resumefit-three.vercel.app/scans/sample) opens without an account)

A free tool for matching a resume to a job description and tracking applications. I built it for me and my friends, so there are no paywalls, credits or locked features.

## What it does

- **Scans**: upload a PDF or DOCX, paste text or pick a saved resume, add a job description and get a match report.
- **Match report**: a match rate out of 100, with searchability, hard skills, soft skills, recruiter tips and formatting each broken down into pass or fail findings. The job description is shown with found and missing skills marked up. Add your own skills, edit and rescan, and see how the score moved.
- **Optimize**: line by line rewrite suggestions you accept or reject, with the match rate updating as you go. Anything that would add a skill your resume does not mention has to be confirmed first.
- **Cover letters, thank-you notes and interview practice**: drafts built only from what is in your resume, and feedback on practice answers.
- **Application tracker**: a drag and drop board from Saved to Offer, with notes, interviews, a cover letter and the resume used for each job. Paste the link to a posting and the title, company and description fill themselves in. The dashboard shows the same board.
- **Resume builder and manager**: eight single column templates, a step by step editor with a live preview, PDF and Word export, and every version kept in one place. The builder reopens the resume you were working on, and suggests skills from a job title.
- **LinkedIn Optimizer**: scores your profile against the jobs you want and lists the keywords it is missing. The extension can read your own profile page into it, or you can upload LinkedIn's PDF of your profile.
- **Find Jobs**: open roles from the public job boards of about 160 companies plus a wider job site that covers fields like healthcare, logistics and finance. Pick a resume and every job gets an estimated fit, worked out from its title, level and the skills it names. It is an estimate, not a scan score, and is labelled that way. An admin can switch it off.
- **Chrome extension**: scan the job posting you are on against your resume and see the match rate and missing skills without leaving the page, or save it to your tracker.

The match score is worked out by plain code, so it works with nothing set up. When an AI key is set up, a scan also asks a model to read the job description (never the resume) for the skills it names, which can add skills to the list. That read is saved, so the same posting is scored the same way every time after. The writing features run on free tiers only (Google Gemini, then Groq, then Cloudflare Workers AI) and the app keeps working when they are off or busy.

## Layout

```
apps/web              Next.js app (App Router, Tailwind)
apps/extension        Chrome extension (Manifest V3, side panel)
packages/scoring      match rate engine, plain TypeScript, runs in the browser and on the server
packages/skills-data  skill lists and alias maps
packages/shared       types and zod schemas shared across the app
e2e                   browser tests
```

## Run it on your own computer

You need Node 22+ and pnpm 10. No accounts or keys are needed.

```bash
corepack enable pnpm
pnpm install
pnpm dev
```

Open http://localhost:3000. Without a `DATABASE_URL` the app keeps a local database and your uploads in `apps/web/.data`, and there is no sign in. To start with some demo data, run `pnpm seed` once.

To try the writing features locally, get a free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and paste it into the key box in Settings. No card is needed.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | run the web app locally |
| `pnpm build` | production build of the web app |
| `pnpm build:extension` | build the Chrome extension into `apps/extension/dist`, and refresh the zip people download from the app |
| `pnpm typecheck` | type check every package |
| `pnpm lint` | lint the web app |
| `pnpm test` | run unit tests |
| `pnpm test:e2e` | build the app and the extension and click through them in a real browser (run `pnpm exec playwright install chromium` once first) |
| `pnpm seed` | add demo data to the local database |
| `pnpm --filter web repair` | list stored data that older versions got wrong: scans on the wrong tracker card, unlinked tailored resumes, resumes and reports read by the old parser. It only reads unless you add `--apply`. Put `DATABASE_URL="..."` in front to check a hosted database |
| `pnpm db:generate` | create a migration from the schema |
| `pnpm db:migrate` | apply migrations to the database in `DATABASE_URL` |
| `pnpm build:skills` | rebuild the skills list from O*NET |

## Put it online (all free)

You need a GitHub account (the code is already there), a Supabase account and a Vercel account. None of them ask for a card.

### 1. Supabase: database, sign in and file storage

1. Create a project at [supabase.com](https://supabase.com). Pick a strong database password and save it somewhere.
2. **Database**: under Connect, copy the **Transaction pooler** connection string and put your password into it. This is `DATABASE_URL`.
3. **Create the tables**: on your computer, run this once from the project folder, with your own string in place of the dots:
   ```bash
   DATABASE_URL="postgresql://..." pnpm db:migrate
   ```
   Run it again whenever you pull changes that add a migration.
4. **Keys**: under Project Settings, API, copy the project URL (`NEXT_PUBLIC_SUPABASE_URL`), the anon public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the service role key (`SUPABASE_SERVICE_ROLE_KEY`). The service role key is a secret. It only ever goes into Vercel.
5. **Storage**: under Storage, create a bucket called `resumes` and leave **Public bucket** switched off.
6. **Sign in**: under Authentication, URL Configuration, set the Site URL to your Vercel address (you get it in the next step, so come back here) and add `https://your-app.vercel.app/auth/callback` to the Redirect URLs. Email sign in links work out of the box. Google is optional: turn it on under Authentication, Providers and follow Supabase's steps, then set `GOOGLE_SIGN_IN` to `true` in Vercel. The Google button stays hidden until you do.

The migrations switch on row level security for every table with no policies, which means the public key cannot read anything. Only the app's own database connection can.

### 2. Vercel: hosting

1. At [vercel.com](https://vercel.com), choose Add New, Project, and import the GitHub repository.
2. Set **Root Directory** to `apps/web`. Leave the build settings as they are.
3. Add these environment variables. If you connect the two with the Supabase integration for Vercel (Integrations tab in Supabase), the first four are filled in for you and you only add `ENCRYPTION_KEY`. `NEXT_PUBLIC_APP_URL` can be left out on Vercel, the app uses the project's own address.

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooler string from Supabase |
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service role key |
   | `NEXT_PUBLIC_APP_URL` | your Vercel address, like `https://your-app.vercel.app` |
   | `ENCRYPTION_KEY` | 64 random characters, from `openssl rand -hex 32` |
   | `INVITE_ONLY` | optional. Left out, new people need an invite code. Set it to `false` to let anyone sign up |
   | `GOOGLE_SIGN_IN` | optional. Set it to `true` to show the Google button on the sign in page, once Google is switched on in Supabase |
   | `ADMIN_EMAIL` | optional, your own email. Whoever signs in with it needs no invite code and is always an admin. It is the way back in if the admin account is ever deleted |
   | `CRON_SECRET` | optional, 16 or more random characters. Vercel sends it with its scheduled visits, and with it set nobody else can set off the daily job refresh. Without it that address answers one visit every ten minutes |
   | `GEMINI_API_KEY` | optional, a free key from Google AI Studio that everyone shares |
   | `GROQ_API_KEY` | optional fallback, free at console.groq.com |
   | `CF_ACCOUNT_ID`, `CF_API_TOKEN` | optional fallback, Cloudflare Workers AI |

4. Deploy. After this, every push to `main` deploys by itself.

   There is no sleeping server to wake up: every page is made fresh for each request, and the first visit after a quiet spell takes about a second. Supabase pauses a free database that has had no activity for a week, so `apps/web/vercel.json` has Vercel visit `/api/health` once a day, which is enough to keep it awake. A second daily visit, to `/api/cron/feed`, refreshes the saved job openings.
5. Go back to Supabase and put the real Vercel address into the Site URL and Redirect URLs.

### 3. First sign in and inviting friends

The first person to sign in becomes the admin and needs no invite code, so sign in yourself first. If you set `ADMIN_EMAIL`, only that address can take the admin spot, so a stranger who finds the site before you do stays a stranger. Then open Settings, follow the link to the admin page and create invite codes. While invites are needed, the sign in form never shows whether an email has an account: with no code it always answers "check your email", and a code that does not work says so to everyone. Copy link gives you a sign in link with the code already filled in.

Keep `ENCRYPTION_KEY` safe and do not change it later. It locks the API keys people save, and a new one would make those unreadable.

## The Chrome extension

It is not in the Chrome Web Store, so it is loaded by hand. The Chrome Extension page in the app has a download button and the steps, which is all a friend needs:

1. Download `resumefit-extension.zip` from that page and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, press **Load unpacked** and pick the unzipped `resumefit-extension` folder.
3. Back on the Chrome Extension page, press **Connect extension**. Paste the code it shows into the extension's side panel.

If you change the extension, run `pnpm build:extension` and commit `apps/web/public/resumefit-extension.zip`, which is the file that button downloads. Only the live app's own address is allowed to hand the extension a connection. If you host your own copy, put its address in `externally_connectable` in `apps/extension/public/manifest.json` and rebuild. The paste a code way of connecting works on any address.

What it will and will not do is spelled out on the Chrome Extension page in the app. The short version: it reads job postings so you can scan and save them, and never fills in or sends anything.

## Where the jobs come from

Find Jobs reads the public job boards companies host on Greenhouse, Lever and Ashby (the list is in `apps/web/lib/job-boards.ts`), and The Muse's public job listings for other fields. Nothing is scraped and no key is needed. Openings are saved once a day, so a search never waits on another site. LinkedIn and Indeed are left out on purpose: they do not allow it.

## Scoring

```
matchRate = round(100 * (
  0.50 * hardSkills +
  0.15 * softSkills +
  0.15 * searchability +
  0.10 * recruiterTips +
  0.10 * formatting
))
```

Skills the job description repeats count more, required skills get a 1.5x boost, and a similar term gets half credit. The weights and every threshold live in `packages/scoring/src/config.ts`. Aim for 75%+.

## Skills data

The hard skills list is a hand picked core of about 190 skills with aliases and related terms (`packages/skills-data/src/curated.ts`), plus about 6,500 tools and technologies from the O*NET database (`onet-skills.json`, built by `scripts/build-skills.ts`). Product names that are also everyday words are left out so they do not match ordinary sentences.

This project includes information from the [O*NET 30.0 Database](https://www.onetcenter.org/database.html) by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. O*NET® is a trademark of USDOL/ETA. The data has been filtered and reshaped for this project. USDOL/ETA has not approved, endorsed or tested these changes.

## Limits and safety

- **Scores on the tracker**: a card shows the score of the newest scan of its own job, or "Not scanned yet". A scan and a card count as the same job only when the titles agree and the company or the link agrees too.
- **Rate limits**, per person per minute: 20 scans, 20 uploads, 20 AI requests, 30 job searches, 15 link imports, 30 saved jobs and 30 downloads. On top of the daily caps per feature, one person can make 150 AI requests a day in total and everyone together 1,200. A request that every provider failed still counts toward those two totals, though not against the feature's own daily uses. Sign in allows 20 tries per connection and 5 emails per address every 15 minutes. The numbers are in `apps/web/lib/rate-limit.ts` and `apps/web/lib/ai/limits.ts`.
- **Uploads**: PDF or DOCX up to 4 MB (Vercel refuses any request over 4.5 MB), told apart by the file's own bytes and not its name. A PDF can have 15 pages, and is read in a side thread that is stopped after 10 seconds or 512 MB, so a file built to take minutes is turned away without slowing anyone else down. A DOCX can hold 1,000 parts, and its text can unpack to 5 MB and 250,000 tags per part, counted while it unpacks.
- **Content policy**: scripts only run with a code that is new on every request, set in `apps/web/proxy.ts`. This is why pages are not built ahead of time.
- **Job links**: a pasted link is only read over https from a public address, and that is checked again at the moment of connecting and on every redirect. A page is cut off at 2 MB counted after unpacking, and read in single passes so a page built to be slow costs no more than any other.
- **Server logs**: a failed database query is logged with the database's own short reason only, never the query's values, so resume text does not end up in the logs.
- **The admin**: the first person ever to sign in is the admin, and only one person can be. With `ADMIN_EMAIL` set, only that address can be, and only once the sign in provider has confirmed it. If the only admin deletes their account, whoever has been a member longest takes over. If everyone leaves, the next person still needs an invite code, unless they sign in with the `ADMIN_EMAIL` address.
- **Caching**: anything that depends on who is signed in is sent as `private, no-store`.
- **Addresses that point at nothing** answer with a real 404 and the app's own not found page.

## Privacy, in short

- Every query is scoped to the signed in person. Uploaded files sit in a private bucket.
- Before any text goes to a model provider, the app looks for names, emails, phone numbers, addresses, links and birth dates and swaps them for placeholders, and puts them back afterwards. It is a best effort that works from the usual shapes of these details, and the privacy page says so.
- The admin can see each member's email, name, join date, invite code and scan count, and nothing else of theirs.
- People can download everything they have stored, or delete their account and all of it, from Settings.

The full version is at `/privacy` in the app.
