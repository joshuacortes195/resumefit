"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Briefcase, Check, Compass, Cpu, Pencil, Printer, RefreshCw, Sparkles } from "lucide-react";
import { DEGREE_LEVELS } from "@resumefit/scoring";
import type { ScoreCategory } from "@resumefit/shared";
import { addSkill, removeSkill, renameScan, setRequiredEducation, setTargetTitle, trackScan, updateJobDescription, type ActionResult } from "@/app/actions/scans";
import { SECTIONS } from "@/components/report/copy";
import { Findings } from "@/components/report/findings";
import { HighlightedText, HighlightLegend } from "@/components/report/highlighted-text";
import { SkillsSection } from "@/components/report/skills-section";
import { Tour, type TourStep } from "@/components/report/tour";
import { ScanForm, type ResumeOption } from "@/components/scan-form";
import { ScoreRing } from "@/components/score-ring";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import type { ReportData } from "@/lib/report-data";

// which pop up is open, if any
type Dialog = "rename" | "target-title" | "education" | "rescan" | "edit-jd" | "add-hard" | "add-soft" | "ats" | null;

// stops for the guided tour
const TOUR: TourStep[] = [
  { target: "score", title: "Match rate", text: "Your overall score for this job, out of 100. Aim for 75 or more. The bars under it show which part is holding you back." },
  ...SECTIONS.map((section) => ({ target: section.key, title: section.label, text: section.tour })),
  { target: "next-steps", title: "Rescan when you have made changes", text: "Update your resume, then upload it again here. We will show how much the score moved." },
];

// the full match report for one scan
export function Report({ data, resumes }: { data: ReportData; resumes: ResumeOption[] }) {
  const router = useRouter();
  const { report, readOnly } = data;
  const [tab, setTab] = useState<"report" | "jd">("report");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [touring, setTouring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // runs a save, closes the pop up when it works and shows the message when it does not
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setDialog(null);
        onDone?.();
      } else setError(result.error);
    });
  }

  // opens a pop up with a clean slate
  function open(next: Dialog) {
    setError(null);
    setDialog(next);
  }

  // puts the job on the tracker, or opens it when it is already there
  function handleTrack() {
    if (data.jobId) {
      router.push(`/tracker/${data.jobId}/job`);
      return;
    }
    run(() => trackScan(data.id));
  }

  const title = [data.company, data.jobTitle].filter(Boolean).join(" - ") || "Untitled scan";
  const change = data.previous ? report.matchRate - data.previous.matchRate : null;
  const allSkills = [...report.hardSkills, ...report.softSkills];
  const customNames = data.customSkills.map((skill) => skill.name);
  const checksFor = (category: ScoreCategory) => report.checks.filter((check) => check.category === category);

  return (
    <div className="mx-auto max-w-6xl">
      {/* heading with the editable title and the track and print buttons */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">{readOnly ? "Sample scan, made up data" : "Resume scan results"}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
            <span className="min-w-0 break-words sm:truncate">{title}</span>
            {!readOnly && (
              <button type="button" onClick={() => open("rename")} aria-label="Edit company and job title" className="rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-foreground print:hidden">
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
          </h1>
        </div>
        <div className="flex gap-2 print:hidden">
          {!readOnly && (
            <button type="button" onClick={handleTrack} disabled={pending} className={SECONDARY_BUTTON}>
              {data.jobId ? <Check className="size-4 text-success" aria-hidden /> : <Briefcase className="size-4" aria-hidden />}
              {data.jobId ? "Tracked" : "Track"}
            </button>
          )}
          <button type="button" onClick={() => window.print()} className={SECONDARY_BUTTON}>
            <Printer className="size-4" aria-hidden />
            Print
          </button>
        </div>
      </header>

      {/* which applicant system the posting uses, when we can tell */}
      {report.jd.ats && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-sm">
          <Cpu className="size-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1">
            This job uses <strong>{report.jd.ats.name}</strong>. Your report takes into account how it reads resumes.
          </p>
          <button type="button" onClick={() => open("ats")} className={`print:hidden ${LINK_BUTTON}`}>
            {report.jd.ats.name} tips
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_1fr]">
        {/* left column that stays put while you scroll: score, bars and the tour link */}
        <aside className="self-start lg:sticky lg:top-20">
          <div id="score" className={`${CARD} scroll-mt-20 p-5`}>
            <h2 className="font-semibold">Match rate</h2>
            <div className="mt-4 flex flex-col items-center gap-2">
              <ScoreRing score={report.matchRate} size="lg" />
              {/* how the score moved since the last scan of this job */}
              {change !== null && change !== 0 && (
                <p className={`flex items-center gap-1 text-sm font-semibold ${change > 0 ? "text-success" : "text-danger"}`}>
                  {change > 0 ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
                  {change > 0 ? "+" : ""}
                  {change}% from last scan
                </p>
              )}
              {change === 0 && <p className="text-sm text-muted">Same as your last scan</p>}
              <p className="text-sm text-muted">Aim for 75% or more</p>
            </div>

            {/* one bar per part, the link jumps to that part */}
            <ul className="mt-5 space-y-3.5">
              {SECTIONS.map(({ key, label }) => {
                const issues = report.issuesToFix[key];
                return (
                  <li key={key}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{label}</span>
                      <a href={`#${key}`} onClick={() => setTab("report")} className={issues === 0 ? "text-muted" : LINK_BUTTON}>
                        {issues === 0 ? "No issues" : `${issues} ${issues === 1 ? "issue" : "issues"} to fix`}
                      </a>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full origin-left animate-bar rounded-full bg-primary" style={{ width: `${Math.round(report.categoryScores[key] * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>

            <button type="button" onClick={() => setTouring(true)} className={`mt-5 inline-flex items-center gap-1.5 text-sm print:hidden ${LINK_BUTTON}`}>
              <Compass className="size-4" aria-hidden />
              Guide me
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          {/* switch between the findings and the marked up job description */}
          <Tabs
            label="Report views"
            className="print:hidden"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "report", label: "Resume report" },
              { key: "jd", label: "Job description" },
            ]}
          />

          {/* the five parts of the report */}
          <div className={`animate-swap space-y-6 pt-6 ${tab === "report" ? "" : "hidden print:block"}`}>
            {SECTIONS.map((section) => (
              <section key={section.key} id={section.key} className={`${CARD} scroll-mt-20 p-5 sm:p-6`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold">{section.label}</h2>
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{section.impact}</span>
                </div>
                <p className="mt-2 max-w-prose text-sm text-muted">{section.explainer}</p>
                <p className="mt-2 max-w-prose text-sm">
                  <strong>Tip:</strong> {section.tip}
                </p>

                <div className="mt-5">
                  {section.key === "hardSkills" || section.key === "softSkills" ? (
                    <SkillsSection
                      kind={section.key === "hardSkills" ? "hard" : "soft"}
                      skills={section.key === "hardSkills" ? report.hardSkills : report.softSkills}
                      resumeText={data.resumeText}
                      spans={data.spans.resume}
                      customNames={customNames}
                      readOnly={readOnly}
                      onAdd={() => open(section.key === "hardSkills" ? "add-hard" : "add-soft")}
                      onRemove={(name) => run(() => removeSkill(data.id, name))}
                    />
                  ) : (
                    <Findings
                      checks={checksFor(section.key)}
                      actions={
                        readOnly
                          ? {}
                          : {
                              "job-title": { label: "Update scan information", onClick: () => open("target-title") },
                              education: { label: "Update required education level", onClick: () => open("education") },
                            }
                      }
                    />
                  )}
                  {/* pasted text cannot be checked for layout */}
                  {section.key === "formatting" && !data.hasLayout && (
                    <p className="mt-3 text-sm text-muted">Layout, fonts and page setup can only be checked on a file. Upload your resume as a PDF or DOCX to get those checks.</p>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* the job description with every skill marked */}
          <div className={`animate-swap pt-6 ${tab === "jd" ? "" : "hidden"} print:hidden`}>
            <section className={`${CARD} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{data.jobTitle ?? "Job description"}</h2>
                {!readOnly && (
                  <button type="button" onClick={() => open("edit-jd")} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
                    <Pencil className="size-3.5" aria-hidden />
                    Edit job description
                  </button>
                )}
              </div>
              <div className="mt-3">
                <HighlightLegend />
              </div>
              <div className="mt-4">
                <HighlightedText text={data.jdText} spans={data.spans.jd} skills={allSkills} />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* bar that stays at the bottom with what to do next */}
      <div id="next-steps" className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-surface/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <strong>{readOnly ? "This is a sample." : "Ready to improve your match?"}</strong>{" "}
            <span className="text-muted">{readOnly ? "Scan your own resume to get a report like this." : "Get rewrite suggestions, or upload an updated version to see the new score."}</span>
          </p>
          {readOnly ? (
            <Link href="/scans/new" className={PRIMARY_BUTTON}>
              Scan my resume
            </Link>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link href={`/optimize/${data.id}`} className={PRIMARY_BUTTON}>
                <Sparkles className="size-4" aria-hidden />
                AI Optimize
              </Link>
              <button type="button" onClick={() => open("rescan")} className={SECONDARY_BUTTON}>
                <RefreshCw className="size-4" aria-hidden />
                Upload and rescan
              </button>
            </div>
          )}
        </div>
      </div>

      {touring && <Tour steps={TOUR} onClose={() => setTouring(false)} />}

      {/* pop ups */}
      <Modal open={dialog === "rename"} onClose={() => setDialog(null)} title="Edit scan title">
        <form
          action={(form) => run(() => renameScan(data.id, { company: String(form.get("company") ?? ""), jobTitle: String(form.get("jobTitle") ?? "") }))}
          className="space-y-4"
        >
          <label className="block text-sm font-medium">
            Company
            <input name="company" defaultValue={data.company ?? ""} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="block text-sm font-medium">
            Job title
            <input name="jobTitle" defaultValue={data.jobTitle ?? ""} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <DialogFooter error={error} pending={pending} onCancel={() => setDialog(null)} />
        </form>
      </Modal>

      <Modal open={dialog === "target-title"} onClose={() => setDialog(null)} title="Update scan information">
        <form action={(form) => run(() => setTargetTitle(data.id, String(form.get("title") ?? "")))} className="space-y-4">
          <p className="text-sm text-muted">This is the job title we look for in your resume. Change it if we read the wrong one from the posting.</p>
          <label className="block text-sm font-medium">
            Job title to look for
            <input name="title" defaultValue={data.targetTitle ?? report.jobTitle ?? ""} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <DialogFooter error={error} pending={pending} onCancel={() => setDialog(null)} />
        </form>
      </Modal>

      <Modal open={dialog === "education"} onClose={() => setDialog(null)} title="Update required education level">
        <form action={(form) => run(() => setRequiredEducation(data.id, String(form.get("level") ?? "auto")))} className="space-y-4">
          <p className="text-sm text-muted">Pick the degree this job really asks for. We compare it with the highest degree on your resume.</p>
          <label className="block text-sm font-medium">
            Required degree
            <select name="level" defaultValue={data.educationOverride ?? "auto"} className={`${INPUT} mt-1 font-normal`}>
              <option value="auto">Use what the posting says{report.jd.educationRequired ? ` (${report.jd.educationRequired})` : ""}</option>
              <option value="none">No degree required</option>
              {DEGREE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter error={error} pending={pending} onCancel={() => setDialog(null)} />
        </form>
      </Modal>

      <Modal open={dialog === "add-hard" || dialog === "add-soft"} onClose={() => setDialog(null)} title="Add skill">
        <form
          action={(form) =>
            run(() => addSkill(data.id, { name: String(form.get("name") ?? ""), category: dialog === "add-soft" ? "soft" : "hard", remember: form.get("remember") === "on" }))
          }
          className="space-y-4"
        >
          <p className="text-sm text-muted">Add a {dialog === "add-soft" ? "soft" : "hard"} skill the job asks for that we did not pick up. We will check your resume for it and update the score.</p>
          <label className="block text-sm font-medium">
            Skill
            <input name="name" required minLength={2} maxLength={60} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remember" className="size-4 accent-(--primary)" />
            Look for this skill in all my future scans too
          </label>
          <DialogFooter error={error} pending={pending} onCancel={() => setDialog(null)} label="Add skill" />
        </form>
      </Modal>

      <Modal open={dialog === "edit-jd"} onClose={() => setDialog(null)} title="Edit job description" size="wide">
        <form action={(form) => run(() => updateJobDescription(data.id, String(form.get("jdText") ?? "")))} className="space-y-4">
          <textarea name="jdText" aria-label="Job description" defaultValue={data.jdText} className={`${INPUT} h-80 resize-y p-3`} />
          <DialogFooter error={error} pending={pending} onCancel={() => setDialog(null)} label="Save and rescan" />
        </form>
      </Modal>

      <Modal open={dialog === "rescan"} onClose={() => setDialog(null)} title="Upload and rescan">
        <ScanForm resumes={resumes} rescan={{ scanId: data.id, jdText: data.jdText }} />
      </Modal>

      <Modal open={dialog === "ats"} onClose={() => setDialog(null)} title={`Tips for ${report.jd.ats?.name ?? "this system"}`}>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {report.jd.ats?.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

// the error line and the cancel and save buttons at the bottom of a pop up form
function DialogFooter({ error, pending, onCancel, label = "Save" }: { error: string | null; pending: boolean; onCancel: () => void; label?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? "Saving..." : label}
        </button>
      </div>
    </>
  );
}
