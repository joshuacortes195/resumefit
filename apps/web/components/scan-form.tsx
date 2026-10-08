"use client";

import { useState } from "react";
import { Check, ScanSearch, X } from "lucide-react";
import { scanResume, type ScanResult } from "@resumefit/scoring";
import type { ScoreCategory, SkillMatch } from "@resumefit/shared";
import { HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data";
import { ScoreRing } from "@/components/score-ring";
import { SAMPLE_JD, SAMPLE_JOB_TITLE, SAMPLE_RESUME } from "@/lib/sample-scan";

// the bars under the score, in report order
const CATEGORIES: { key: ScoreCategory; label: string }[] = [
  { key: "searchability", label: "Searchability" },
  { key: "hardSkills", label: "Hard skills" },
  { key: "softSkills", label: "Soft skills" },
  { key: "recruiterTips", label: "Recruiter tips" },
  { key: "formatting", label: "Formatting" },
];

// shared look for the two big text boxes
const TEXTAREA = "mt-2 h-64 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm transition-colors duration-150 focus:border-primary";

// paste a resume and a job description, get the match report right in the browser
export function ScanForm() {
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  // bumps on every scan so the ring animation plays again
  const [scanCount, setScanCount] = useState(0);

  // both boxes need real content before we scan
  const ready = resumeText.trim().length >= 50 && jdText.trim().length >= 50;

  // runs the scan, nothing leaves the browser
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setResult(scanResume({ resumeText, jdText, jobTitle, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS }));
    setScanCount((count) => count + 1);
  }

  // fills the form with the example and scans it right away
  function handleSample() {
    setResumeText(SAMPLE_RESUME);
    setJdText(SAMPLE_JD);
    setJobTitle(SAMPLE_JOB_TITLE);
    setResult(scanResume({ resumeText: SAMPLE_RESUME, jdText: SAMPLE_JD, jobTitle: SAMPLE_JOB_TITLE, hardSkills: HARD_SKILLS, softSkills: SOFT_SKILLS }));
    setScanCount((count) => count + 1);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* step one, the resume */}
          <div>
            <label htmlFor="resume" className="font-semibold">
              1. Paste your resume
            </label>
            <textarea
              id="resume"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste the full text of your resume here."
              className={TEXTAREA}
            />
          </div>

          {/* step two, the job description */}
          <div>
            <label htmlFor="jd" className="font-semibold">
              2. Paste the job description
            </label>
            <textarea
              id="jd"
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="Copy and paste the job description here. Try to leave out benefits, perks and legal disclaimers."
              className={TEXTAREA}
            />
          </div>
        </div>

        {/* optional job title and the scan button */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="job-title" className="text-sm font-medium">
              Job title <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            <ScanSearch className="size-4" aria-hidden />
            Scan
          </button>
          {/* shows a full report without pasting anything */}
          <button
            type="button"
            onClick={handleSample}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition duration-150 hover:bg-primary-soft active:scale-[0.98]"
          >
            Try a sample
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">Scanning happens in your browser. File upload is coming, for now paste the text.</p>
      </form>

      {/* the report, shows after the first scan */}
      {result && (
        <section key={scanCount} aria-label="Scan results" className="animate-rise space-y-6">
          <div className="grid gap-6 rounded-2xl border border-border bg-surface p-6 md:grid-cols-[auto_1fr] md:items-center">
            {/* big score */}
            <div className="flex flex-col items-center gap-2">
              <ScoreRing score={result.matchRate} size="lg" />
              <p className="text-sm text-muted">Aim for 75% or more</p>
            </div>

            {/* one bar per part of the report */}
            <ul className="space-y-3">
              {CATEGORIES.map(({ key, label }) => (
                <li key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted">
                      {result.issuesToFix[key] === 0 ? "No issues" : `${result.issuesToFix[key]} to fix`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full origin-left animate-bar rounded-full bg-primary" style={{ width: `${Math.round(result.categoryScores[key] * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SkillsCard title="Hard skills" skills={result.hardSkills} />
            <SkillsCard title="Soft skills" skills={result.softSkills} />
          </div>

          {/* pass or fail findings */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-semibold">Findings</h2>
            <ul className="mt-4 space-y-3">
              {result.checks.map((check) => (
                <li key={check.id} className="flex gap-3 text-sm">
                  <StatusIcon passed={check.passed} />
                  <span>{check.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

// green check or red x, with hidden text so color is not the only signal
function StatusIcon({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="mt-0.5 text-success">
      <Check className="size-4" aria-hidden />
      <span className="sr-only">Passed</span>
    </span>
  ) : (
    <span className="mt-0.5 text-danger">
      <X className="size-4" aria-hidden />
      <span className="sr-only">Needs work</span>
    </span>
  );
}

// table comparing how often a skill shows up in the resume and the job description
function SkillsCard({ title, skills }: { title: string; skills: SkillMatch[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="font-semibold">{title}</h2>
      {skills.length === 0 ? (
        <p className="mt-4 text-sm text-muted">We did not find any of these in the job description.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="pb-2 font-medium">Skill</th>
              <th className="pb-2 text-center font-medium">Resume</th>
              <th className="pb-2 text-center font-medium">Job</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill.name} className="border-b border-border last:border-0">
                <td className="py-2">
                  {skill.name}
                  {/* nice to have skills count a bit less */}
                  {skill.importance === "preferred" && <span className="ml-2 text-xs text-muted">nice to have</span>}
                  {/* half credit note for similar terms */}
                  {skill.match === "related" && <span className="ml-2 text-xs text-warning">similar term found</span>}
                </td>
                <td className="py-2 text-center tabular-nums">
                  {skill.resumeCount > 0 ? skill.resumeCount : <span className="inline-flex"><StatusIcon passed={false} /></span>}
                </td>
                <td className="py-2 text-center tabular-nums">{skill.jdCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
