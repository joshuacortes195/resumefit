"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, Check, Columns2, Copy, Download, PenLine, Plus, Save, Sparkles, Undo2, X } from "lucide-react";
import { parseResume, scanResume, type JdHints, type LayoutMeta, type SkillTerm } from "@resumefit/scoring";
import { trackScan } from "@/app/actions/scans";
import { generateBullets, generateSuggestions, saveOptimizedResume } from "@/app/actions/writing";
import { AiNotice } from "@/components/ai-notice";
import { ScoreRing } from "@/components/score-ring";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import type { Suggestion } from "@/lib/ai/prompts/optimize";
import { diffWords } from "@/lib/diff";
import { downloadExport } from "@/lib/download";

// everything the workspace needs to rescore the resume in the browser
export type WorkspaceScan = {
  id: string;
  jobTitle: string | null;
  company: string | null;
  jdText: string;
  resumeText: string;
  // the title the report looks for
  targetTitle: string | null;
  educationOverride: string | null;
  customSkills: { name: string; category: "hard" | "soft" }[];
  // only the skills this job mentions, with their other spellings. the full list is thousands long and stays on the server
  skills: { hard: SkillTerm[]; soft: SkillTerm[] };
  hints: JdHints | null;
  layout: LayoutMeta | null;
  createdAt: string;
  jobId: string | null;
};

type WorkspaceProps = {
  scan: WorkspaceScan;
  // suggestions from an earlier visit, so reopening does not use up another request
  saved: { id: string; suggestions: Suggestion[] } | null;
  ai: { available: boolean; remaining: number | null; bulletsRemaining: number | null };
};

// what the user decided about each suggestion
type Decision = "pending" | "accepted" | "rejected";

// short names for the kinds of suggestion
const TYPE_LABELS: Record<Suggestion["type"], string> = { summary: "Summary", bullet: "Bullet", skills: "Skills", verb: "Stronger verb", metric: "Add a number" };

// the optimize workspace: the resume on the left, suggestions on the right, live score on top
export function Workspace({ scan, saved, ai }: WorkspaceProps) {
  const original = useMemo(() => scan.resumeText.split(/\r?\n/).map((line) => line.trimEnd()), [scan.resumeText]);
  const [lines, setLines] = useState(original);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(saved?.suggestions ?? []);
  const [optimizationId, setOptimizationId] = useState<string | null>(saved?.id ?? null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<"read" | "edit" | "compare">("read");
  const [remaining, setRemaining] = useState(ai.remaining);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);
  const [tracked, setTracked] = useState(scan.jobId !== null);
  const [pending, startTransition] = useTransition();

  // scores a version of the resume with the same settings the scan used
  const score = (text: string) => {
    return scanResume({
      resumeText: text,
      jdText: scan.jdText,
      jobTitle: scan.targetTitle ?? scan.jobTitle ?? undefined,
      educationOverride: scan.educationOverride as never,
      customSkills: scan.customSkills,
      hints: scan.hints,
      layout: scan.layout,
      today: new Date(scan.createdAt),
      hardSkills: scan.skills.hard,
      softSkills: scan.skills.soft,
    });
  };

  // the score follows the text, a beat behind so typing stays smooth
  const text = lines.join("\n");
  const deferredText = useDeferredValue(text);
  const before = useMemo(() => score(scan.resumeText), [scan.resumeText]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = useMemo(() => score(deferredText), [deferredText]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = [...current.hardSkills, ...current.softSkills].filter((skill) => skill.match === "missing");
  const changed = text !== scan.resumeText;

  // swaps one line for another, wherever that line sits now
  function replaceLine(from: string, to: string): boolean {
    const index = lines.findIndex((line) => line.trim() === from.trim());
    if (index === -1) return false;
    setLines(lines.map((line, position) => (position === index ? to : line)));
    return true;
  }

  // puts a suggestion into the resume
  function accept(suggestion: Suggestion) {
    if (suggestion.requires_user_confirmation && !confirmed[suggestion.id]) return;
    if (replaceLine(suggestion.original, suggestion.proposed)) setDecisions((all) => ({ ...all, [suggestion.id]: "accepted" }));
    else setMessage({ ok: false, text: "That line has changed since the suggestion was made, so it could not be applied." });
  }

  // takes an accepted suggestion back out
  function undo(suggestion: Suggestion) {
    replaceLine(suggestion.proposed, suggestion.original);
    setDecisions((all) => ({ ...all, [suggestion.id]: "pending" }));
  }

  // accepts everything that is safe to accept without asking
  function acceptAll() {
    let next = lines;
    const done: Record<string, Decision> = {};
    for (const suggestion of suggestions) {
      if ((decisions[suggestion.id] ?? "pending") !== "pending") continue;
      if (suggestion.requires_user_confirmation && !confirmed[suggestion.id]) continue;
      const index = next.findIndex((line) => line.trim() === suggestion.original.trim());
      if (index === -1) continue;
      next = next.map((line, position) => (position === index ? suggestion.proposed : line));
      done[suggestion.id] = "accepted";
    }
    setLines(next);
    setDecisions((all) => ({ ...all, ...done }));
  }

  function rejectAll() {
    const done: Record<string, Decision> = {};
    for (const suggestion of suggestions) if ((decisions[suggestion.id] ?? "pending") === "pending") done[suggestion.id] = "rejected";
    setDecisions((all) => ({ ...all, ...done }));
  }

  // asks for a round of suggestions
  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateSuggestions(scan.id);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setSuggestions(result.suggestions);
      setOptimizationId(result.optimizationId);
      setDecisions({});
      setConfirmed({});
      setRemaining(result.remaining);
      if (result.suggestions.length === 0) setMessage({ ok: true, text: "No changes to suggest. Your resume already covers this job well." });
    });
  }

  const acceptedIds = suggestions.filter((suggestion) => decisions[suggestion.id] === "accepted").map((suggestion) => suggestion.id);
  const fileName = `${(current.resume.contact.name ?? "Resume").replace(/\s+/g, "-")}-Resume`;

  // saves the edited text as a new resume
  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveOptimizedResume({ scanId: scan.id, text, optimizationId, acceptedIds, afterScore: current.matchRate });
      if (result.ok) {
        setSavedResumeId(result.resumeId);
        setMessage({ ok: true, text: "Saved to your Resume Manager." });
      } else setMessage({ ok: false, text: result.error });
    });
  }

  // downloads the edited text as a file
  function download(format: "docx" | "pdf") {
    setMessage(null);
    startTransition(async () => {
      const problem = await downloadExport({ text, format, kind: "resume", name: fileName });
      if (problem) setMessage({ ok: false, text: problem });
    });
  }

  const open = suggestions.filter((suggestion) => (decisions[suggestion.id] ?? "pending") === "pending");
  const title = [scan.company, scan.jobTitle].filter(Boolean).join(" - ") || "Untitled scan";

  return (
    <div className="mx-auto max-w-6xl">
      {/* title, the before and after scores, and the view switches */}
      <header className={`${CARD} flex flex-wrap items-center gap-x-8 gap-y-4 p-5`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">AI Optimize</p>
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
          <Link href={`/scans/${scan.id}`} className={`text-sm ${LINK_BUTTON}`}>
            Back to the report
          </Link>
        </div>
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="text-center">
            <ScoreRing score={before.matchRate} label="Match rate before" />
            <p className="mt-1 text-xs text-muted">Before</p>
          </div>
          <ArrowRight className="size-5 text-muted" aria-hidden />
          <div className="text-center">
            <ScoreRing key={current.matchRate} score={current.matchRate} label="Match rate now" />
            <p className="mt-1 text-xs text-muted">Now</p>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        {/* the resume */}
        <section className={`${CARD} min-w-0 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Your resume</h2>
            <div className="flex gap-1 rounded-lg bg-background p-1 text-xs font-medium">
              {(
                [
                  ["read", "Changes", null],
                  ["edit", "Edit text", PenLine],
                  ["compare", "Compare", Columns2],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors duration-150 ${view === key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* changed lines get a highlighter mark */}
          {view === "read" && (
            <div className="mt-4 space-y-0.5 text-sm leading-6">
              {lines.map((line, index) =>
                line.trim() === "" ? (
                  <div key={index} className="h-3" />
                ) : (
                  <p key={index} className={`whitespace-pre-wrap rounded px-1 ${original.includes(line) ? "" : "bg-marker text-on-marker"}`}>
                    {line}
                  </p>
                ),
              )}
            </div>
          )}

          {/* type freely, the score keeps up */}
          {view === "edit" && <textarea aria-label="Resume text" value={text} onChange={(event) => setLines(event.target.value.split("\n"))} className={`${INPUT} mt-4 h-[36rem] resize-y p-3 leading-6`} />}

          {/* the two versions side by side with their scores */}
          {view === "compare" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                { label: "Original", body: scan.resumeText, rate: before.matchRate },
                { label: "Optimized", body: text, rate: current.matchRate },
              ].map((side) => (
                <div key={side.label} className="min-w-0">
                  <p className="flex items-center justify-between text-sm font-semibold">
                    {side.label}
                    <span className="tabular-nums text-muted">{side.rate}%</span>
                  </p>
                  <div className="mt-2 max-h-[34rem] overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs leading-5">{side.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* what to do with the result */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" disabled={pending} onClick={() => download("docx")} className={`${SECONDARY_BUTTON} px-3 py-2`}>
              <Download className="size-4" aria-hidden />
              DOCX
            </button>
            <button type="button" disabled={pending} onClick={() => download("pdf")} className={`${SECONDARY_BUTTON} px-3 py-2`}>
              <Download className="size-4" aria-hidden />
              PDF
            </button>
            <button type="button" disabled={pending || !changed || savedResumeId !== null} onClick={save} className={`${PRIMARY_BUTTON} px-3 py-2`}>
              <Save className="size-4" aria-hidden />
              {savedResumeId ? "Saved" : "Save as new resume"}
            </button>
            <button
              type="button"
              disabled={pending || tracked}
              onClick={() => startTransition(async () => void ((await trackScan(scan.id)).ok && setTracked(true)))}
              className={`${SECONDARY_BUTTON} px-3 py-2`}
            >
              {tracked ? <Check className="size-4 text-success" aria-hidden /> : <Briefcase className="size-4" aria-hidden />}
              {tracked ? "On your tracker" : "Add to Job Tracker"}
            </button>
          </div>
          <p aria-live="polite" className={`mt-2 min-h-5 text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
            {message?.text}
          </p>
        </section>

        <div className="space-y-6">
          {/* suggestions */}
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Suggestions</h2>
              {open.length > 1 && (
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={acceptAll} className={LINK_BUTTON}>
                    Accept all
                  </button>
                  <button type="button" onClick={rejectAll} className="font-semibold text-muted hover:text-foreground">
                    Reject all
                  </button>
                </div>
              )}
            </div>

            {suggestions.length === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted">Get line by line rewrites that work in the keywords this job is looking for. You decide which ones to keep.</p>
                <button type="button" disabled={pending || !ai.available} onClick={generate} className={`${PRIMARY_BUTTON} w-full`}>
                  <Sparkles className="size-4" aria-hidden />
                  {pending ? "Reading your resume..." : "Suggest improvements"}
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {suggestions.map((suggestion) => {
                  const decision = decisions[suggestion.id] ?? "pending";
                  return (
                    <li key={suggestion.id} className={`rounded-xl border border-border p-3 text-sm transition-opacity duration-200 ${decision === "rejected" ? "opacity-50" : ""}`}>
                      <p className="text-xs font-medium text-muted">
                        {TYPE_LABELS[suggestion.type]}
                        {suggestion.section.toLowerCase() === TYPE_LABELS[suggestion.type].toLowerCase() ? "" : `, ${suggestion.section}`}
                      </p>

                      {editing === suggestion.id ? (
                        // tweak the wording before accepting
                        <textarea
                          aria-label="Edit suggestion"
                          defaultValue={suggestion.proposed}
                          autoFocus
                          onBlur={(event) => {
                            const proposed = event.target.value.trim();
                            if (proposed) setSuggestions((all) => all.map((entry) => (entry.id === suggestion.id ? { ...entry, proposed } : entry)));
                            setEditing(null);
                          }}
                          className={`${INPUT} mt-2 h-24 resize-y`}
                        />
                      ) : (
                        // the rewrite, with what was added and what was taken out
                        <p className="mt-2 leading-6">
                          {diffWords(suggestion.original, suggestion.proposed).map((part, index) =>
                            part.kind === "same" ? (
                              <span key={index}>{part.text}</span>
                            ) : part.kind === "added" ? (
                              <ins key={index} className="rounded-sm bg-success/15 text-success no-underline">
                                {part.text}
                              </ins>
                            ) : (
                              <del key={index} className="text-muted">
                                {part.text}
                              </del>
                            ),
                          )}
                        </p>
                      )}

                      {suggestion.keywords_added.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {suggestion.keywords_added.map((keyword) => (
                            <li key={keyword} className="rounded-sm bg-marker px-1.5 py-0.5 text-on-marker">
                              {keyword}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* new claims need a yes first */}
                      {suggestion.requires_user_confirmation && decision === "pending" && (
                        <label className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-2 text-xs">
                          <input
                            type="checkbox"
                            checked={confirmed[suggestion.id] ?? false}
                            onChange={(event) => setConfirmed((all) => ({ ...all, [suggestion.id]: event.target.checked }))}
                            className="mt-0.5 size-4 accent-(--primary)"
                          />
                          <span>
                            <strong>Only add this if it&apos;s true.</strong> I have this skill{suggestion.keywords_added.length > 0 ? ` (${suggestion.keywords_added.join(", ")})` : ""}.
                          </span>
                        </label>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {decision === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={suggestion.requires_user_confirmation && !confirmed[suggestion.id]}
                              onClick={() => accept(suggestion)}
                              className={`${PRIMARY_BUTTON} px-3 py-1.5`}
                            >
                              <Check className="size-3.5" aria-hidden />
                              Accept
                            </button>
                            <button type="button" onClick={() => setDecisions((all) => ({ ...all, [suggestion.id]: "rejected" }))} className={`${SECONDARY_BUTTON} px-3 py-1.5`}>
                              <X className="size-3.5" aria-hidden />
                              Reject
                            </button>
                            <button type="button" onClick={() => setEditing(suggestion.id)} className="ml-auto text-sm font-semibold text-muted hover:text-foreground">
                              Edit
                            </button>
                          </>
                        )}
                        {decision === "accepted" && (
                          <>
                            <span className="inline-flex items-center gap-1 font-medium text-success">
                              <Check className="size-4" aria-hidden />
                              Accepted
                            </span>
                            <button type="button" onClick={() => undo(suggestion)} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
                              <Undo2 className="size-3.5" aria-hidden />
                              Undo
                            </button>
                          </>
                        )}
                        {decision === "rejected" && (
                          <button type="button" onClick={() => setDecisions((all) => ({ ...all, [suggestion.id]: "pending" }))} className="text-sm font-semibold text-muted hover:text-foreground">
                            Rejected. Bring it back
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {suggestions.length > 0 && (
              <button type="button" disabled={pending || !ai.available} onClick={generate} className={`mt-4 text-sm ${LINK_BUTTON}`}>
                {pending ? "Working..." : "Get a fresh set"}
              </button>
            )}
            <div className="mt-3">
              <AiNotice available={ai.available} remaining={remaining} />
            </div>
          </section>

          <KeywordHelper scan={scan} missing={missing.map((skill) => skill.name)} text={text} ai={ai} onInsert={(entryIndex, bullet) => setLines(insertBullet(lines, text, entryIndex, bullet))} />
        </div>
      </div>
    </div>
  );
}

// puts a new bullet under the last bullet of one job
function insertBullet(lines: string[], text: string, entryIndex: number, bullet: string): string[] {
  const entry = parseResume(text).experience[entryIndex];
  const anchor = entry?.bullets.at(-1) ?? entry?.title ?? null;
  // find the last line of that job, or fall back to the end of the resume
  const index = anchor ? lines.findLastIndex((line) => line.includes(anchor)) : -1;
  const at = index === -1 ? lines.length : index + 1;
  return [...lines.slice(0, at), `• ${bullet}`, ...lines.slice(at)];
}

type KeywordHelperProps = {
  scan: WorkspaceScan;
  missing: string[];
  text: string;
  ai: WorkspaceProps["ai"];
  onInsert: (entryIndex: number, bullet: string) => void;
};

// pick a keyword that is still missing and get three bullets that use it
function KeywordHelper({ scan, missing, text, ai, onInsert }: KeywordHelperProps) {
  const jobs = useMemo(() => parseResume(text).experience, [text]);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [entryIndex, setEntryIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(ai.bulletsRemaining);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // asks for bullets for one keyword
  function ask(word: string) {
    setKeyword(word);
    setOptions([]);
    setError(null);
    startTransition(async () => {
      const result = await generateBullets({ scanId: scan.id, keyword: word, entryIndex, resumeText: text });
      if (result.ok) {
        setOptions(result.options);
        setRemaining(result.remaining);
      } else setError(result.error);
    });
  }

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="font-semibold">Still missing</h2>
      {missing.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing. Your resume covers every keyword we found in this job.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Pick a keyword to get three bullets that use it. Only keep one if it is true for you.</p>
          {jobs.length > 1 && (
            <label className="mt-3 block text-xs font-medium">
              Write them for this job
              <select value={entryIndex} onChange={(event) => setEntryIndex(Number(event.target.value))} className={`${INPUT} mt-1 font-normal`}>
                {jobs.map((job, index) => (
                  <option key={index} value={index}>
                    {[job.title, job.company].filter(Boolean).join(", ") || `Job ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {missing.map((word) => (
              <li key={word}>
                <button
                  type="button"
                  disabled={pending || !ai.available}
                  aria-pressed={keyword === word}
                  onClick={() => ask(word)}
                  className={`rounded-sm px-1.5 py-0.5 outline-1 outline-dashed transition-colors duration-150 disabled:opacity-60 ${keyword === word ? "bg-primary-soft outline-primary" : "outline-danger hover:bg-primary-soft"}`}
                >
                  {word}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pending && <p className="mt-3 text-sm text-muted">Writing bullets for {keyword}...</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* the three options, each can be copied or dropped into the resume */}
      {options.length > 0 && (
        <ul className="mt-4 space-y-3">
          {options.map((option) => (
            <li key={option} className="rounded-xl border border-border p-3 text-sm">
              <p>{option}</p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(option);
                    setCopied(option);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}
                >
                  {copied === option ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                  {copied === option ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInsert(entryIndex, option);
                    setOptions((all) => all.filter((entry) => entry !== option));
                  }}
                  className={`inline-flex items-center gap-1 ${LINK_BUTTON}`}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Insert
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="mt-3">
          <AiNotice available={ai.available} remaining={remaining} />
        </div>
      )}
    </section>
  );
}
