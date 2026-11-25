"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBlankResume } from "@/app/actions/builder";
import { ResumePreview } from "@/components/builder/preview";
import { rememberDraft } from "@/lib/builder/open-draft";
import { layOut } from "@/lib/builder/layout";
import { TEMPLATES } from "@/lib/builder/templates";
import { builderDataSchema, defaultSettings } from "@/lib/builder/types";

// a made up person, so every template can be shown filled in. none of this is saved into a new resume
const SAMPLE = builderDataSchema.parse({
  profile: { name: "Jordan Rivera", title: "Software Engineer", email: "jordan.rivera@example.com", phone: "(619) 555-0144", linkedin: "linkedin.com/in/jordanrivera", location: "San Diego, CA" },
  summary: "Software engineer with three years building web apps and the services behind them.",
  experience: [
    { id: "a", title: "Software Engineer", company: "Coastal Robotics", location: "San Diego, CA", start: "Jun 2024", end: "", current: true, bullets: ["Rebuilt the checkout in React and TypeScript, cutting drop off by 18%", "Wrote 45 unit tests for the motor control library", "Led the move to continuous deploys, from one release a week to several a day"] },
    { id: "b", title: "Software Engineering Intern", company: "Northwind Labs", location: "Remote", start: "Jun 2023", end: "Aug 2023", current: false, bullets: ["Built a dashboard used by 40 support agents every day", "Cut page load time from 4.1 to 1.3 seconds"] },
  ],
  skills: ["TypeScript", "React", "Python", "C++", "SQL", "Docker", "Git", "Linux", "AWS"],
  education: [{ id: "a", degree: "B.S.", field: "Computer Science", school: "San Diego State University", location: "San Diego, CA", year: "2024" }],
  additional: { projects: [{ id: "a", name: "Trail Finder", description: "A hiking app with offline maps, used by 300 people in its first month." }], certifications: [], awards: ["Dean's List, 6 semesters"], volunteer: ["Mentor, campus robotics club"], languages: [] },
});

// every template shown as a filled in page, the popular ones first. picking one starts a new resume in it
export function TemplateGallery() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // a sideways row by default, every template laid out at once after See all
  const [all, setAll] = useState(false);
  // popular ones lead, the rest keep their own order
  const ordered = [...TEMPLATES].sort((a, b) => Number(b.popular ?? false) - Number(a.popular ?? false));

  // starts an empty resume in the template that was picked and opens it
  function use(template: string) {
    setBusy(template);
    setError(null);
    startTransition(async () => {
      const result = await startBlankResume(template);
      if (result.ok) {
        rememberDraft(result.id, true);
        router.push(`/builder/${result.id}?new=1`);
      } else {
        setError(result.error);
      }
      setBusy(null);
    });
  }

  return (
    <section id="templates" aria-labelledby="templates-title" className="mt-10 scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="templates-title" className="text-2xl font-semibold">
          Or start from a template
        </h2>
        {/* switches between the sideways row and the full grid */}
        <button type="button" onClick={() => setAll((value) => !value)} aria-expanded={all} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          {all ? "Show fewer" : `See all ${ordered.length}`}
        </button>
      </div>
      <p className="mt-1 max-w-2xl text-muted">Every one is a single column that scanners read cleanly. You can switch template at any time without losing what you typed.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className={all ? "mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" : "mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"}>
        {ordered.map((template) => (
          <li key={template.id} className={all ? "" : "w-[min(15rem,70vw)] shrink-0 snap-start"}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => use(template.id)}
              aria-label={`Use the ${template.name} template`}
              className="group block w-full rounded-xl border border-border bg-surface p-3 text-left transition-colors duration-150 hover:border-primary disabled:opacity-60"
            >
              {/* the page itself, small. it is a picture here, so screen readers go by the name and the line under it */}
              <span aria-hidden className="relative block overflow-hidden rounded-sm">
                <ResumePreview laid={layOut(SAMPLE, template.id)} settings={{ ...defaultSettings(), template: template.id }} />
                {template.popular && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-on-primary">Popular</span>}
              </span>
              <span className="mt-3 block font-semibold group-hover:text-primary">{busy === template.id ? "One moment..." : template.name}</span>
              {/* the major it was made for, in the soft gold */}
              {template.field && <span className="mt-0.5 block font-drawing text-[10px] uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--marker)_78%,var(--foreground))]">{template.field}</span>}
              <span className="mt-0.5 block text-xs text-muted">{template.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
