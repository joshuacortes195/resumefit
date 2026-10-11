# ResumeFit: project breakdown

Last updated: 2026-10-10

## At a glance

| | |
| --- | --- |
| What | A free web app and Chrome extension that scores a resume against a job description, shows what is missing, and keeps every application in one tracker |
| Live demo | https://resumefit-three.vercel.app/dashboard (invite only) |
| Repo | https://github.com/joshuacortes195/resumefit (private) |
| When | Started October 2026, still in progress |
| Role | Sole developer |
| Languages | TypeScript (strict), SQL, CSS |
| Tech | Next.js 16, React 19, Tailwind CSS 4, PostgreSQL, Drizzle ORM, Supabase (database, sign in, file storage), Vercel, Chrome Manifest V3, Vite, zod 4, Vitest, Playwright, axe-core, pnpm workspaces |

## One-line version

I built a resume to job description scanner with a deterministic scoring engine, a Chrome extension that scans the posting you are looking at, and an application tracker that shows every score in one place.

## Short version

ResumeFit reads a PDF or DOCX resume, scores how well it matches a job posting, and shows exactly which skills and formatting problems are costing points. The score comes from plain code with no language model behind it, so the same input always gives the same answer. Around that scan I built a Chrome extension that scans the posting on the page you are on, a Kanban application tracker, a resume builder with eight templates, writing help for resumes and cover letters, a LinkedIn profile scorer, interview practice and a daily job feed. I built it for me and my friends, so nothing is behind a paywall.

## What I built

### Scoring engine (`packages/scoring`)
- Weighted match rate across five categories: hard skills 50%, soft skills 15%, searchability 15%, recruiter tips 10%, formatting 10%. Every weight and threshold lives in one config object
- Skill weighting of `(1 + log2(times the skill appears in the job description)) x 1.5 if required`, with full credit for an exact or alias match and half for a related term
- Whole word skill matching that handles the hard names: C vs C++ vs C#, Go the language vs the verb, Excel vs excellent, SQL inside PostgreSQL
- Resume reader for sections, contact details, work history, education, measurable results and total years of experience from merged date ranges
- Job description reader for title, company, years required, degree, and detection of 11 applicant tracking systems with tips for each
- 30+ report checks across searchability, recruiter tips and formatting
- No Node APIs, so the same package scores on the server during a scan and rescores live in the browser while someone edits their resume

### Skills data (`packages/skills-data`)
- 191 hand picked hard skills and 35 soft skills with aliases and related terms
- 6,559 tools and technologies imported from the U.S. Department of Labor's O*NET database by a build script that filters out everyday words

### Resume file reading
- PDF reader that rebuilds lines from text positions, joins wrapped lines, reads two column layouts in order, and detects tables, images, repeated headers and footers, fonts, margins and page size
- DOCX reader that walks the document XML directly, keeps list bullets and resolves fonts and sizes through the style chain

### Scan report
- Upload, paste or pick a saved resume
- Report with a score ring, per category bars, grouped findings, skills comparison tables, a highlighted resume view and a marked up job description
- Edits that rescore in place: rename, change the target title, override the required degree, add custom skills, edit the job description
- Scan History with search, sort, paging, archive and bulk actions

### Chrome extension (`apps/extension`)
- Manifest V3 side panel that reads the job on the current page from structured data, site specific selectors for LinkedIn, Indeed and Glassdoor, and a text block fallback
- Scans the posting against a chosen resume and shows the match rate and the top missing skills in the panel
- Every scan lands on a tracker card, so the score shows up on the tracker and the dashboard. A scan from an application page is matched to a job already saved from the posting, by link first and then by title and company
- Right click a highlighted job description to scan it on any page
- Reads my own LinkedIn profile page into the LinkedIn scorer
- It only reads pages. Site access is asked for once through an optional permission, and the connection key is stored on the server as a SHA-256 hash that expires after 90 days

### Application tracker, resume manager and builder
- Kanban board with five columns, drag and drop by mouse and keyboard, optimistic updates, search and an archived view
- Columns sit side by side as far as they fit at a readable width and wrap onto the next row after that, so the board still reads in a narrow window
- Job card with a URL per tab: details, the resume used, cover letter, interviews with calendar export, autosaved notes
- Resume Manager with one base resume enforced by a partial unique index
- Resume Builder with eight single column templates, a seven step editor with live preview, undo and redo, autosave, and PDF and Word export

### Writing help
- One router that tries Gemini, then Groq, then Cloudflare Workers AI, moving on after a rate limit, outage, timeout or unusable reply
- Structured replies validated with zod, with one repair attempt
- Per person daily caps by feature, adjustable by an admin
- Redaction that swaps names, emails, phones and links for placeholders before text leaves the app and restores them afterwards
- Bring your own key, encrypted at rest with AES-256-GCM
- Resume optimizer with line by line suggestions, word level diffs, accept and reject, and a required confirmation before any skill the resume does not mention is added
- Cover letters, thank-you notes, and interview practice with typed or spoken answers

### Find Jobs
- A daily feed built from the public job boards of 159 companies on Greenhouse, Lever and Ashby, plus The Muse's public listings
- Openings are cached in Postgres by a scheduled job, so a search never waits on another site
- Each opening is ranked against the resume I pick and labelled Great, Good, Possible or Low fit
- Paste a posting's link into the tracker and the title, company and description are filled in. The fetcher only follows public https addresses and checks every redirect

### Accounts and operations
- Email link sign in with an invite code gate, where the first person in becomes the admin
- Admin page for invite codes, usage, provider health, caps and feature switches
- Full data export as a zip, and account deletion
- Row level security on every table

### Design
- Every section of the app has its own accent color set from one small group of CSS variables, on a shared background
- A shared tabs component whose marker slides to the chosen tab, lists that come in one after another, and press feedback on buttons, all CSS on transform and opacity and switched off under reduced motion

## Numbers

- About 22,800 lines of TypeScript across a web app, a Chrome extension and three shared packages
- 224 unit and data layer tests and 19 browser tests
- Accessibility checks (WCAG 2 A and AA) on 16 pages
- 6,750 skills matched per scan, in well under half a second
- 17 tables and 5 migrations
- 159 company job boards in the feed, about 10,000 openings
- 8 resume templates, 11 applicant tracking systems detected, 30+ report checks

## Problems I ran into and fixed

- **Auto Apply did not hold up on real sites.** I built a feature that opened applications, filled them in and could submit them. It passed every test I wrote against saved copies of forms, then failed on the first two real company sites I tried. Every company's form is built differently, dropdowns are custom widgets, big employers want an account first, and most forms have a captcha. Doing it properly would need a paid agent per application. I removed about 4,800 lines and made the scan the center of the product
- **The extension said "open a job first" on a real job page.** Chrome hides a tab's address from an extension until the extension is allowed on that site, and my code read "no address" as "not a job page". I changed it to ask once for access through an optional permission and to treat a missing address as "not allowed yet"
- **Scans from the extension never showed on the tracker.** A scan was only tied to a job if that job had been saved from the same panel. Now every scan finds its tracker card by link, then by title and company, and makes one if there is none
- **A scan landed on the wrong card.** After scanning one job, the extension kept that job's card in memory, so scanning a second company overwrote the first one's score. Each job in the panel now starts with a clean state, and the server ignores a card that does not match the job being scanned
- **The tracker was unreadable in a narrow window.** Five columns squeezed into the space left beside the extension's panel. The board now wraps columns instead of squeezing them, and pop ups scroll inside the screen

## Design decisions I can explain

- **The score is plain code.** No language model is involved in the match rate, so it works with nothing set up, costs nothing, and gives the same answer every time
- **One scoring package for server and browser.** The same code scores a scan on the server and rescores live while someone edits, so the two can never disagree
- **Scans can be rescored later.** A saved scan keeps a snapshot of the resume text and layout, so adding a skill or editing the job description gives a stable new score
- **Model output is never trusted.** Replies are validated with zod, suggestions are checked against the real resume line by line, and anything that adds a new claim needs my confirmation
- **It runs with no accounts.** With no database address the app falls back to an embedded Postgres on disk running the same migrations, which also keeps the tests fast and self contained
- **The extension only reads.** After the Auto Apply experiment I kept the extension to what works on real pages: reading a posting, scanning it and saving it
- **Free tiers only.** The router never calls a paid endpoint, and each feature has a daily cap

## Resume bullets

- Built ResumeFit, a resume to job description scanner, as a 22,800 line TypeScript monorepo with a Next.js 16 web app, a Manifest V3 Chrome extension and three shared packages
- Implemented a deterministic weighted scoring engine that runs on the server and in the browser, matching resumes against 6,750 skills in under half a second
- Wrote PDF and DOCX parsers that rebuild reading order from raw text positions and document XML to power 30+ formatting and searchability checks
- Built a Chrome extension that reads the job posting on any page, scans it against a chosen resume and writes the match rate to a Kanban application tracker
- Built a provider router with fallback across three free services, zod validated output with a repair retry, per user caps and PII redaction before every request
- Built a resume editor with word level diffs, accept and reject controls and live rescoring, with a required confirmation before any unverified skill is added
- Built a Kanban application tracker with accessible drag and drop, optimistic updates, deep linked card tabs and calendar export
- Built a resume builder with 8 templates, a 7 step editor with undo, redo and autosave, and PDF and Word export
- Modeled a 17 table PostgreSQL schema in Drizzle ORM with row level security, running on embedded Postgres locally and Supabase in production
- Built a job feed that caches about 10,000 openings from 159 public company job boards and ranks them against a chosen resume
- Wrote 224 unit tests and 19 end to end browser tests, including WCAG accessibility checks across 16 pages
- Cut a 4,800 line auto apply feature after testing it on real company sites, and refocused the product on the scan

## Skills this project shows

- TypeScript, React 19, Next.js 16 (App Router, Server Components, Server Actions)
- PostgreSQL, Drizzle ORM, schema design, migrations, row level security
- Chrome extension development (Manifest V3, side panel, content scripts, optional permissions)
- Text parsing and document formats (PDF text positions, DOCX XML)
- Algorithm design for scoring and matching
- Working with language model APIs: fallback, validation, rate limits, redaction
- Testing: unit, data layer, end to end browser tests, automated accessibility checks
- Security: input validation, encrypted secrets, hashed tokens, safe link fetching
- Design systems, CSS animation, accessibility
- Product judgment: testing on real sites and cutting what does not work

## Where the detail lives

- `README.md`: what the app does, setup, deploy steps and how scoring works
- `packages/scoring/src`: the scoring engine, with its config in `config.ts`
- `packages/skills-data`: skill lists and the O*NET import script
- `apps/web/lib/files`: the PDF and DOCX readers
- `apps/web/lib/ai`: the provider router, prompts, caps and redaction
- `apps/web/lib/jobs-feed.ts` and `apps/web/lib/job-boards.ts`: the job feed
- `apps/web/db/schema.ts`: the database tables
- `apps/extension/src`: the Chrome extension
- `e2e`: the browser tests
