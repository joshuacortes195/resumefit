# ResumeFit

A free tool for matching a resume to a job description, tracking applications and filling out application forms faster. I built it for me and my friends, so there are no paywalls, credits or locked features.

## What it does (and what's planned)

- **Match report**: scores a resume against a job description across hard skills, soft skills, searchability, recruiter tips and formatting.
- **Job tracker**: Kanban board from Saved to Offer with notes, interviews and cover letters per job.
- **Resume builder and manager**: build clean single column resumes and keep every version.
- **Optional writing help**: rewrite suggestions, cover letters and interview practice on free model tiers. The match score never depends on it.
- **Chrome extension**: fills application forms, you review and click submit yourself.

## Status

Early. This is what exists today:

- pnpm monorepo with the web app and three shared packages
- App shell: collapsible sidebar, mobile drawer, top bar, light and dark mode
- Dashboard layout and a placeholder page for every section
- Database schema for every table (Drizzle, Postgres)
- Environment variable validation
- Invite code rules, with tests
- Scoring engine so far: weights, skill math, match rate the skill matcher (aliases, similar terms, tricky names like C++ and Go) , plain text resume reading (sections, contact details, measurable results), searchability and recruiter tip checks, and one scan function that ties them into a match rate, with tests

Not built yet: sign in, resume parsing, the scan flow and report, the tracker, the builder, the extension.

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

Open http://localhost:3000. The app shell runs without any keys filled in.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | run the web app locally |
| `pnpm build` | production build |
| `pnpm typecheck` | type check every package |
| `pnpm lint` | lint the web app |
| `pnpm test` | run unit tests |
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
