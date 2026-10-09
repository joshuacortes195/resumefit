# ResumeFit

A free tool for matching a resume to a job description, tracking applications and filling out application forms faster. I built it for me and my friends, so there are no paywalls, credits or locked features.

## What it does (and what's planned)

- **Match report**: scores a resume against a job description across hard skills, soft skills, searchability, recruiter tips and formatting.
- **Job tracker**: Kanban board from Saved to Offer with notes, interviews and cover letters per job.
- **Resume builder and manager**: build clean single column resumes and keep every version.
- **Optional writing help**: rewrite suggestions, cover letters and interview practice on free model tiers. The match score never depends on it.
- **Chrome extension**: fills application forms, you review and click submit yourself.

## Status

Working today:

- **Scans**: upload a PDF or DOCX, paste text or pick a saved resume, add a job description and get a saved match report
- **Match report**: match rate gauge, searchability, hard and soft skills tables, recruiter tips and formatting checks, the job description with skills marked up, add your own skills, edit and rescan with the score change, guided tour, print view and a sample report
- **Resume reading**: text in reading order from PDF and DOCX, plus layout details (columns, tables, images, fonts, margins, headers and footers, page size)
- **Scan history**: search, sort, paging, archive, bulk delete, status that stays in sync with the tracker
- **Job tracker**: drag and drop board, and a card for each job with the job details, resume, cover letter, interviews (with calendar links) and notes that save as you type
- **Resume manager**: star a base resume, rename, preview, duplicate, download, delete
- **Dashboard**: new scan form, latest scan, tracker counts and next interview
- Runs with no accounts at all: without a `DATABASE_URL` the app keeps a local database and uploads in `apps/web/.data`

Not built yet: sign in for the hosted version, the writing helpers (rewrite suggestions, cover letters, interview practice), the resume builder, the LinkedIn page and the Chrome extension.

## Layout

```
apps/web              Next.js app (App Router, Tailwind)
packages/scoring      match rate engine, plain TypeScript, runs in the browser and on the server
packages/skills-data  skill lists and alias maps
packages/shared       types and zod schemas shared across the app
```

## Getting started

You need Node 22+ and pnpm 10.

```bash
corepack enable pnpm
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open http://localhost:3000. Everything that is built runs without any keys filled in. Your data stays in `apps/web/.data` until you point `DATABASE_URL` at a hosted database.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | run the web app locally |
| `pnpm build` | production build |
| `pnpm typecheck` | type check every package |
| `pnpm lint` | lint the web app |
| `pnpm test` | run unit tests |
| `pnpm test:e2e` | build the app and click through it in a real browser (run `pnpm exec playwright install chromium` once first) |
| `pnpm db:generate` | create a migration from the schema |
| `pnpm db:migrate` | apply migrations to the database in `DATABASE_URL` |

## Accounts you'll need (all free)

- **Supabase**: database, auth and file storage. Copy the project URL, anon key, service role key and the pooled connection string into `.env.local`.
- **Google AI Studio**: a free Gemini API key for the writing features.
- **Groq** and **Cloudflare**: optional free fallbacks.
- **Vercel**: hosting on the Hobby plan.

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

Skills the job description repeats count more, required skills get a 1.5x boost, and a similar term gets half credit. The weights live in `packages/scoring/src/config.ts`. Aim for 75%+.
