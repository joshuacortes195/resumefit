"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Download, Plus, Redo2, ScanSearch, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";
import { parseResume, searchabilityChecks, formattingChecks, type Check as ReportCheck } from "@resumefit/scoring";
import { CURATED_HARD_SKILLS, SOFT_SKILLS } from "@resumefit/skills-data/curated";
import { discardDraft, saveBuilder, skillsForTitle, skillsFromJob, writeBullets, writeSummary } from "@/app/actions/builder";
import { AiNotice } from "@/components/ai-notice";
import { Field, ItemControls, LineList, move } from "@/components/builder/fields";
import { ResumePreview } from "@/components/builder/preview";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { StatusIcon } from "@/components/ui/status-icon";
import { GUIDE, SAMPLE_DATA, STEPS } from "@/lib/builder/guide";
import { builderLayoutMeta, builderToText, layOut } from "@/lib/builder/layout";
import { forgetDraft, openDraft, rememberDraft, stepKey } from "@/lib/builder/open-draft";
import { TEMPLATES } from "@/lib/builder/templates";
import { ACCENTS, newId, type Accent, type BuilderData, type TemplateSettings } from "@/lib/builder/types";

type EditorProps = {
  id: string;
  initialData: BuilderData;
  initialSettings: TemplateSettings;
  // a brand new resume opens on the template picker
  isNew: boolean;
  // started in the builder and not finished yet, so it can still be cancelled
  fresh: boolean;
  ai: { available: boolean; remaining: number | null };
};

// everything undo and redo step through
type Snapshot = { data: BuilderData; settings: TemplateSettings };

// names for the look options
const SPACINGS = [
  { value: 1, label: "1.0 Single" },
  { value: 1.15, label: "1.15 Default" },
  { value: 1.5, label: "1.5 More space" },
] as const;
const MARGINS = [
  { value: 0.5, label: '0.5" Narrow' },
  { value: 0.75, label: '0.75" Normal' },
  { value: 1, label: '1.0" Wide' },
] as const;

// the resume builder: the form on the left, the live page in the middle, help on the right
export function BuilderEditor({ id, initialData, initialSettings, isNew, fresh, ai }: EditorProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot>({ data: initialData, settings: initialSettings });
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"editor" | "style">(isNew ? "style" : "editor");
  const [showSample, setShowSample] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  // what the server last confirmed, anything different from this still needs saving
  const [savedText, setSavedText] = useState(() => JSON.stringify({ data: initialData, settings: initialSettings }));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(ai.remaining);
  const [cancelling, setCancelling] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const { data, settings } = snapshot;
  const serialized = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const saveState: "saved" | "saving" | "error" = saveError ? "error" : serialized === savedText ? "saved" : "saving";

  // every change goes through here so it can be undone
  function change(next: Partial<Snapshot>) {
    setPast((history) => [...history.slice(-60), snapshot]);
    setFuture([]);
    setSnapshot({ ...snapshot, ...next });
  }
  const setData = (patch: Partial<BuilderData>) => change({ data: { ...data, ...patch } });
  const setSettings = (patch: Partial<TemplateSettings>) => change({ settings: { ...settings, ...patch } });

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture([snapshot, ...future]);
    setSnapshot(previous);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, snapshot]);
    setSnapshot(next);
  }

  // saves a moment after the last change
  useEffect(() => {
    if (serialized === savedText) return;
    const timer = setTimeout(async () => {
      const result = await saveBuilder(id, snapshot.data, snapshot.settings);
      if (result.ok) setSavedText(serialized);
      setSaveError(result.ok ? null : result.error);
    }, 800);
    return () => clearTimeout(timer);
  }, [serialized, savedText, snapshot, id]);

  // this resume is the one the builder opens on next time, until it is closed or cancelled
  useEffect(() => {
    if (openDraft()?.id !== id) rememberDraft(id, fresh);
    // and it opens on the step that was last being filled in
    const step = Number(localStorage.getItem(stepKey(id)));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isNew && step > 0 && step < STEPS.length) setStep(step);
  }, [id, fresh, isNew]);

  // moves to a step and remembers it
  function goToStep(index: number) {
    setStep(index);
    localStorage.setItem(stepKey(id), String(index));
  }

  // keeps the newest unsaved work at hand for when the page is left
  const unsaved = useRef<Snapshot | null>(null);
  useEffect(() => {
    unsaved.current = serialized === savedText ? null : snapshot;
  }, [serialized, savedText, snapshot]);

  // leaving the builder saves straight away instead of waiting for the usual pause
  useEffect(() => {
    const flush = () => {
      if (unsaved.current) void saveBuilder(id, unsaved.current.data, unsaved.current.settings);
    };
    const hidden = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [id]);

  // saves what is there and goes back to the list of resumes
  function close() {
    startLeaving(async () => {
      if (unsaved.current) await saveBuilder(id, unsaved.current.data, unsaved.current.settings);
      unsaved.current = null;
      forgetDraft();
      localStorage.removeItem(stepKey(id));
      router.push("/resumes");
    });
  }

  // deletes the resume that was started, only after the person has said they are sure
  function cancel() {
    startLeaving(async () => {
      unsaved.current = null;
      const result = await discardDraft(id);
      if (!result.ok) {
        setSaveError(result.error);
        setCancelling(false);
        return;
      }
      forgetDraft();
      localStorage.removeItem(stepKey(id));
      router.push("/builder");
    });
  }

  // the preview shows made up answers when asked, or when nothing has been typed yet
  const blank = !data.profile.name && data.experience.length === 0 && data.education.length === 0;
  const laid = useMemo(() => layOut(showSample || (blank && tab === "style") ? SAMPLE_DATA : data, settings.template), [data, settings.template, showSample, blank, tab]);
  const guide = GUIDE[step];

  return (
    <div className="mx-auto max-w-[90rem]">
      {/* title row with undo, redo and the save status */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">Resume Builder</h1>
        <p aria-live="polite" className={`text-sm ${saveState === "error" ? "text-danger" : "text-muted"}`}>
          {saveState === "saving" ? "Saving..." : saveState === "error" ? (saveError ?? "Could not save") : "All changes saved"}
        </p>
        <button type="button" aria-label="Undo" disabled={past.length === 0} onClick={undo} className={`${SECONDARY_BUTTON} px-2.5 py-2`}>
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="Redo" disabled={future.length === 0} onClick={redo} className={`${SECONDARY_BUTTON} px-2.5 py-2`}>
          <Redo2 className="size-4" aria-hidden />
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success" title="Every template is a single column with standard headings and real text">
          <ShieldCheck className="size-3.5" aria-hidden />
          ATS friendly
        </span>
        {/* cancel throws a new resume away, save and close keeps it */}
        {fresh && (
          <button type="button" disabled={leaving} onClick={() => setCancelling(true)} className={SECONDARY_BUTTON}>
            Cancel
          </button>
        )}
        <button type="button" disabled={leaving} onClick={close} className={SECONDARY_BUTTON}>
          Save and close
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Your work is saved as you type. Leave whenever you like and it will be here when you come back.</p>

      {/* the seven steps */}
      <ol className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((label, index) => (
          <li key={label} className="shrink-0">
            <button
              type="button"
              aria-current={step === index ? "step" : undefined}
              onClick={() => {
                goToStep(index);
                setTab("editor");
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${step === index ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft/60 hover:text-foreground"}`}
            >
              <span className={`flex size-5 items-center justify-center rounded-full text-xs ${step === index ? "bg-primary text-on-primary" : index < step ? "bg-success/20 text-success" : "bg-border"}`}>
                {index < step ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className={`mt-4 grid gap-6 lg:grid-cols-[26rem_1fr] ${showGuide ? "2xl:grid-cols-[26rem_1fr_17rem]" : ""}`}>
        {/* the form */}
        <section className={`${CARD} self-start p-5`}>
          <Tabs
            label="Form views"
            size="sm"
            className="mb-5"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "editor", label: "Editor" },
              { key: "style", label: "Style" },
            ]}
          >
            <button type="button" aria-pressed={showGuide} onClick={() => setShowGuide((open) => !open)} className="ml-auto inline-flex items-center gap-1 pb-2 text-muted hover:text-foreground">
              <BookOpen className="size-4" aria-hidden />
              Guide me
            </button>
          </Tabs>

          {tab === "style" ? (
            <StylePanel settings={settings} onChange={setSettings} />
          ) : (
            <>
              <h2 className="mb-4 text-lg font-semibold">{STEPS[step]}</h2>
              {step === 0 && <ProfileStep data={data} onChange={setData} />}
              {step === 1 && <ExperienceStep data={data} onChange={setData} ai={ai} remaining={remaining} onUsed={setRemaining} />}
              {step === 2 && <SkillsStep data={data} onChange={setData} />}
              {step === 3 && <EducationStep data={data} onChange={setData} />}
              {step === 4 && <AdditionalStep data={data} onChange={setData} />}
              {step === 5 && <SummaryStep data={data} onChange={setData} ai={ai} remaining={remaining} onUsed={setRemaining} />}
              {step === 6 && <FinalizeStep id={id} data={data} settings={settings} saved={saveState === "saved"} />}
            </>
          )}

          {/* back and next */}
          {tab === "editor" && (
            <div className="mt-6 flex justify-between border-t border-border pt-4">
              <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)} className={SECONDARY_BUTTON}>
                Back
              </button>
              {step < STEPS.length - 1 && (
                <button type="button" onClick={() => goToStep(step + 1)} className={PRIMARY_BUTTON}>
                  Next: {STEPS[step + 1]}
                </button>
              )}
            </div>
          )}
          {tab === "style" && (
            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <button type="button" onClick={() => setTab("editor")} className={PRIMARY_BUTTON}>
                Continue to {STEPS[step]}
              </button>
            </div>
          )}
        </section>

        {/* the live page */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-sm">
            <p className="font-medium">Preview</p>
            <label className="flex items-center gap-2 text-muted">
              <input type="checkbox" checked={showSample} onChange={(event) => setShowSample(event.target.checked)} className="size-4 accent-(--primary)" />
              Show sample content
            </label>
          </div>
          <div className="mx-auto max-w-3xl">
            <ResumePreview laid={laid} settings={settings} />
          </div>
        </section>

        {/* help for the step you are on */}
        {showGuide && guide && (
          <aside className={`${CARD} hidden self-start p-5 text-sm 2xl:block`}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{STEPS[step]}</h2>
              <button type="button" aria-label="Close guide" onClick={() => setShowGuide(false)} className="rounded-lg p-1 text-muted hover:bg-primary-soft hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <h3 className="mt-4 font-semibold">What goes here</h3>
            <p className="mt-1 text-muted">{guide.what}</p>
            <h3 className="mt-4 font-semibold">Why it matters</h3>
            <p className="mt-1 text-muted">{guide.why}</p>
            <h3 className="mt-4 font-semibold">Tips</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              {guide.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* the double check before a started resume is thrown away */}
      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Are you sure you want to cancel?">
        <p className="text-sm text-muted">This deletes the resume you started and everything you typed into it. It cannot be brought back.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setCancelling(false)} className={SECONDARY_BUTTON}>
            Keep working
          </button>
          <button type="button" disabled={leaving} onClick={cancel} className={`${PRIMARY_BUTTON} bg-danger hover:bg-danger`}>
            {leaving ? "Deleting..." : "Yes, delete it"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

type StepProps = { data: BuilderData; onChange: (patch: Partial<BuilderData>) => void };
type AiStepProps = StepProps & { ai: EditorProps["ai"]; remaining: number | null; onUsed: (remaining: number | null) => void };

// template, spacing, margins and accent color
function StylePanel({ settings, onChange }: { settings: TemplateSettings; onChange: (patch: Partial<TemplateSettings>) => void }) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">Template</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-pressed={settings.template === template.id}
              onClick={() => onChange({ template: template.id })}
              className={`rounded-xl border p-3 text-left transition-colors duration-150 ${settings.template === template.id ? "border-primary bg-primary-soft" : "border-border hover:bg-primary-soft/50"}`}
            >
              <span className={`block font-semibold ${template.font === "serif" ? "font-serif" : ""}`}>{template.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{template.blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-semibold">
        Line spacing
        <select value={settings.lineSpacing} onChange={(event) => onChange({ lineSpacing: Number(event.target.value) as TemplateSettings["lineSpacing"] })} className={`${INPUT} mt-1 font-normal`}>
          {SPACINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold">
        Margins
        <select value={settings.margins} onChange={(event) => onChange({ margins: Number(event.target.value) as TemplateSettings["margins"] })} className={`${INPUT} mt-1 font-normal`}>
          {MARGINS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Accent color</legend>
        <div className="mt-2 flex gap-3">
          {(Object.keys(ACCENTS) as Accent[]).map((accent) => (
            <button
              key={accent}
              type="button"
              aria-pressed={settings.accent === accent}
              aria-label={accent.replace("-", " ")}
              title={accent.replace("-", " ")}
              onClick={() => onChange({ accent })}
              style={{ background: ACCENTS[accent] }}
              className={`size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-110 ${settings.accent === accent ? "ring-2 ring-primary" : ""}`}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

// step 1: who you are and how to reach you
function ProfileStep({ data, onChange }: StepProps) {
  const set = (patch: Partial<BuilderData["profile"]>) => onChange({ profile: { ...data.profile, ...patch } });
  return (
    <div className="space-y-4">
      <Field label="Name" required value={data.profile.name} onChange={(name) => set({ name })} />
      <Field label="Job title" required value={data.profile.title} onChange={(title) => set({ title })} placeholder="The title you are applying for" />
      <Field label="Email" required type="email" value={data.profile.email} onChange={(email) => set({ email })} />
      <Field label="Phone" type="tel" value={data.profile.phone} onChange={(phone) => set({ phone })} />
      <Field label="Location" value={data.profile.location} onChange={(location) => set({ location })} placeholder="City, ST" />
      <Field label="LinkedIn" value={data.profile.linkedin} onChange={(linkedin) => set({ linkedin })} placeholder="linkedin.com/in/yourname" />
      <Field label="Website" value={data.profile.website} onChange={(website) => set({ website })} placeholder="Portfolio or GitHub" />
      <LineList label="Other links" items={data.profile.links} onChange={(links) => set({ links })} addLabel="Add link" />
      <Field label="How many years of experience do you have?" value={data.profile.years} onChange={(years) => set({ years })} hint="Not shown on your resume. It helps us give better suggestions." />
    </div>
  );
}

// step 2: jobs, each with its bullets
function ExperienceStep({ data, onChange, ai, remaining, onUsed }: AiStepProps) {
  const jobs = data.experience;
  const update = (index: number, patch: Partial<BuilderData["experience"][number]>) => onChange({ experience: jobs.map((job, position) => (position === index ? { ...job, ...patch } : job)) });
  return (
    <div className="space-y-5">
      {jobs.map((job, index) => (
        <div key={job.id} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{job.title || `Job ${index + 1}`}</p>
            <ItemControls name={job.title || `job ${index + 1}`} index={index} count={jobs.length} onMove={(to) => onChange({ experience: move(jobs, index, to) })} onRemove={() => onChange({ experience: jobs.filter((_, position) => position !== index) })} />
          </div>
          <Field label="Job title" value={job.title} onChange={(title) => update(index, { title })} />
          <Field label="Company" value={job.company} onChange={(company) => update(index, { company })} />
          <Field label="Location" value={job.location} onChange={(location) => update(index, { location })} placeholder="City, ST or Remote" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" value={job.start} onChange={(start) => update(index, { start })} placeholder="Jan 2022" />
            {!job.current && <Field label="End" value={job.end} onChange={(end) => update(index, { end })} placeholder="Dec 2023" />}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={job.current} onChange={(event) => update(index, { current: event.target.checked })} className="size-4 accent-(--primary)" />I work here now
          </label>
          <LineList label="Bullets" items={job.bullets} onChange={(bullets) => update(index, { bullets })} addLabel="Add bullet" placeholder="Start with a verb and include a result" multiline />
          <BulletWriter job={job} ai={ai} remaining={remaining} onUsed={onUsed} onAdd={(bullets) => update(index, { bullets: [...job.bullets.filter((bullet) => bullet.trim()), ...bullets] })} />
        </div>
      ))}
      <button type="button" onClick={() => onChange({ experience: [...jobs, { id: newId(), title: "", company: "", location: "", start: "", end: "", current: false, bullets: [""] }] })} className={SECONDARY_BUTTON}>
        <Plus className="size-4" aria-hidden />
        Add a job
      </button>
    </div>
  );
}

// describe a job in your own words and get bullets back
function BulletWriter({ job, ai, remaining, onUsed, onAdd }: { job: BuilderData["experience"][number]; ai: EditorProps["ai"]; remaining: number | null; onUsed: (remaining: number | null) => void; onAdd: (bullets: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 text-sm ${LINK_BUTTON}`}>
        <Sparkles className="size-4" aria-hidden />
        Write bullets with AI
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg bg-background p-3">
      <label className="block text-sm font-medium">
        What did you do in this job?
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="In your own words. For example: I ran the front counter, trained new hires and handled the weekly stock order." className={`${INPUT} mt-1 resize-y bg-surface font-normal`} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !ai.available}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await writeBullets({ title: job.title, company: job.company, description });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            onAdd(result.bullets);
            onUsed(result.remaining);
            setOpen(false);
            setDescription("");
          })
        }
        className={`${SECONDARY_BUTTON} bg-surface px-3 py-1.5`}
      >
        <Sparkles className="size-4" aria-hidden />
        {pending ? "Writing..." : "Write bullets"}
      </button>
      <AiNotice available={ai.available} remaining={remaining} />
    </div>
  );
}

// the hand picked skills, offered as you type. the full list is thousands long and stays on the server
const KNOWN_SKILLS = [...CURATED_HARD_SKILLS, ...SOFT_SKILLS].map((skill) => skill.name).sort((a, b) => a.localeCompare(b));

// step 3: skills as tags
function SkillsStep({ data, onChange }: StepProps) {
  const [draft, setDraft] = useState("");
  // starts out as the job title from the profile step, which is usually the job they are after
  const [target, setTarget] = useState(data.profile.title);
  const [jdText, setJdText] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const has = (skill: string) => data.skills.some((entry) => entry.toLowerCase() === skill.toLowerCase());

  // adds one or more skills, split on commas, skipping repeats
  function add(text: string) {
    const fresh = text
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill && !has(skill));
    if (fresh.length > 0) onChange({ skills: [...data.skills, ...fresh] });
    setDraft("");
  }

  // runs one of the two ways of finding skills and shows what came back
  function suggest(find: () => Promise<{ ok: true; skills: string[] } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await find();
      setError(result.ok ? null : result.error);
      setSuggested(result.ok ? result.skills : []);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="skill-input" className="text-sm font-medium">
          Add a skill
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="skill-input"
            list="known-skills"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add(draft);
              }
            }}
            placeholder="Type a skill and press Enter"
            className={INPUT}
          />
          <button type="button" onClick={() => add(draft)} className={SECONDARY_BUTTON}>
            Add
          </button>
        </div>
        <datalist id="known-skills">
          {KNOWN_SKILLS.map((skill) => (
            <option key={skill} value={skill} />
          ))}
        </datalist>
      </div>

      {/* the skills picked so far */}
      {data.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Your skills">
          {data.skills.map((skill) => (
            <li key={skill} className="flex items-center gap-1 rounded-sm bg-marker py-0.5 pl-2 pr-1 text-sm text-on-marker">
              {skill}
              <button type="button" aria-label={`Remove ${skill}`} onClick={() => onChange({ skills: data.skills.filter((entry) => entry !== skill) })} className="rounded p-0.5 hover:bg-black/10">
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* type a job title and get the skills that job usually asks for */}
      <div className="space-y-2 rounded-lg bg-background p-3">
        <label htmlFor="target-job" className="block text-sm font-medium">
          Suggest skills for my target job
        </label>
        <div className="flex gap-2">
          <input
            id="target-job"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                suggest(() => skillsForTitle(target));
              }
            }}
            placeholder="Job title, like Supply Chain Analyst"
            className={`${INPUT} min-w-0 flex-1 bg-surface`}
          />
          <button type="button" disabled={pending} onClick={() => suggest(() => skillsForTitle(target))} className={`${SECONDARY_BUTTON} shrink-0 bg-surface`}>
            {pending ? "Looking..." : "Show skills"}
          </button>
        </div>
        {/* a posting can still be pasted for skills from one exact job */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">Or paste a job description instead</summary>
          <textarea aria-label="Job description" value={jdText} onChange={(event) => setJdText(event.target.value)} rows={3} placeholder="Paste the job description here." className={`${INPUT} mt-2 resize-y bg-surface`} />
          <button type="button" disabled={pending} onClick={() => suggest(() => skillsFromJob(jdText))} className={`${SECONDARY_BUTTON} mt-2 bg-surface px-3 py-1.5`}>
            Find skills in this job
          </button>
        </details>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {suggested.length > 0 && (
          <>
            <p className="text-xs text-muted">Click the ones you really have.</p>
            <ul className="flex flex-wrap gap-1.5">
              {suggested
                .filter((skill) => !has(skill))
                .map((skill) => (
                  <li key={skill}>
                    <button type="button" onClick={() => add(skill)} className="rounded-sm px-1.5 py-0.5 text-sm outline-1 outline-dashed outline-muted hover:bg-primary-soft">
                      + {skill}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// step 4: schools and degrees
function EducationStep({ data, onChange }: StepProps) {
  const schools = data.education;
  const update = (index: number, patch: Partial<BuilderData["education"][number]>) => onChange({ education: schools.map((school, position) => (position === index ? { ...school, ...patch } : school)) });
  return (
    <div className="space-y-5">
      {schools.map((school, index) => (
        <div key={school.id} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{school.school || `School ${index + 1}`}</p>
            <ItemControls name={school.school || `school ${index + 1}`} index={index} count={schools.length} onMove={(to) => onChange({ education: move(schools, index, to) })} onRemove={() => onChange({ education: schools.filter((_, position) => position !== index) })} />
          </div>
          <Field label="Degree" value={school.degree} onChange={(degree) => update(index, { degree })} placeholder="Bachelor of Science" />
          <Field label="Field of study" value={school.field} onChange={(field) => update(index, { field })} placeholder="Computer Science" />
          <Field label="School" value={school.school} onChange={(name) => update(index, { school: name })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location" value={school.location} onChange={(location) => update(index, { location })} />
            <Field label="Graduation year" value={school.year} onChange={(year) => update(index, { year })} placeholder="2021" />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ education: [...schools, { id: newId(), degree: "", field: "", school: "", location: "", year: "" }] })} className={SECONDARY_BUTTON}>
        <Plus className="size-4" aria-hidden />
        Add a school
      </button>
    </div>
  );
}

// step 5: projects, certifications, awards, volunteering and languages
function AdditionalStep({ data, onChange }: StepProps) {
  const extra = data.additional;
  const set = (patch: Partial<BuilderData["additional"]>) => onChange({ additional: { ...extra, ...patch } });
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Projects</legend>
        <div className="mt-1 space-y-3">
          {extra.projects.map((project, index) => (
            <div key={project.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-start gap-1">
                <input aria-label={`Project ${index + 1} name`} value={project.name} placeholder="Project name" onChange={(event) => set({ projects: extra.projects.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)) })} className={INPUT} />
                <ItemControls name={project.name || `project ${index + 1}`} index={index} count={extra.projects.length} onMove={(to) => set({ projects: move(extra.projects, index, to) })} onRemove={() => set({ projects: extra.projects.filter((_, position) => position !== index) })} />
              </div>
              {/* every point about the project gets its own box, and its own bullet on the page */}
              <LineList
                label={`Project ${index + 1} bullet points`}
                items={project.description.split("\n")}
                onChange={(lines) => set({ projects: extra.projects.map((entry, position) => (position === index ? { ...entry, description: lines.join("\n") } : entry)) })}
                placeholder="What you built, or what came of it"
                addLabel="Add bullet point"
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set({ projects: [...extra.projects, { id: newId(), name: "", description: "" }] })} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
          <Plus className="size-4" aria-hidden />
          Add project
        </button>
      </fieldset>
      <LineList label="Certifications" items={extra.certifications} onChange={(certifications) => set({ certifications })} addLabel="Add certification" />
      <LineList label="Awards" items={extra.awards} onChange={(awards) => set({ awards })} addLabel="Add award" />
      <LineList label="Volunteer experience" items={extra.volunteer} onChange={(volunteer) => set({ volunteer })} addLabel="Add volunteer role" />
      <LineList label="Languages" items={extra.languages} onChange={(languages) => set({ languages })} addLabel="Add language" />
    </div>
  );
}

// step 6: the summary, typed or drafted from the rest of the resume
function SummaryStep({ data, onChange, ai, remaining, onUsed }: AiStepProps) {
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const words = data.summary.trim() ? data.summary.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Summary
        <textarea value={data.summary} onChange={(event) => onChange({ summary: event.target.value })} rows={6} placeholder="Two or three sentences on who you are and what you bring." className={`${INPUT} mt-1 resize-y font-normal leading-6`} />
        <span className="mt-1 block text-xs font-normal text-muted">{words} words. Around 40 to 60 reads best.</span>
      </label>
      <div className="space-y-2 rounded-lg bg-background p-3">
        <label className="block text-sm font-medium">
          Target job description <span className="font-normal text-muted">(optional)</span>
          <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} rows={3} placeholder="Paste one to point the summary at that job." className={`${INPUT} mt-1 resize-y bg-surface font-normal`} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !ai.available}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await writeSummary(data, jdText);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onChange({ summary: result.summary });
              onUsed(result.remaining);
            })
          }
          className={`${SECONDARY_BUTTON} bg-surface px-3 py-1.5`}
        >
          <Sparkles className="size-4" aria-hidden />
          {pending ? "Writing..." : "Generate with AI"}
        </button>
        <AiNotice available={ai.available} remaining={remaining} />
      </div>
    </div>
  );
}

// step 7: the checklist, the file name and the downloads
function FinalizeStep({ id, data, settings, saved }: { id: string; data: BuilderData; settings: TemplateSettings; saved: boolean }) {
  // run the same checks the scanner uses on what the builder will produce
  const checks = useMemo(() => {
    const text = builderToText(data, settings.template);
    const parsed = parseResume(text);
    const input = { text, parsed, jd: { jobTitle: null, company: null, yearsRequired: null, educationRequired: null, educationPreferred: null, ats: null }, jobTitle: data.profile.title || null, layout: builderLayoutMeta(data, settings) };
    const wanted = new Set(["email", "phone", "location", "experience-section", "education-section", "job-title", "dates", "paragraphs", "special-characters", "columns", "tables", "images", "font-standard", "margins"]);
    return [...searchabilityChecks(input), ...formattingChecks(input)].filter((check: ReportCheck) => wanted.has(check.id) && !check.info);
  }, [data, settings]);
  const failing = checks.filter((check) => !check.passed).length;
  const fileName = `${data.profile.name.trim().replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "-") || "First-Last"}-Resume`;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">ATS checklist</p>
        <p className="mt-1 text-sm text-muted">{failing === 0 ? "Everything a scanner looks for is in place." : `${failing} ${failing === 1 ? "thing" : "things"} to fix before you send this out.`}</p>
        <ul className="mt-3 space-y-2">
          {checks.map((check) => (
            <li key={check.id} className="flex gap-2.5 text-sm">
              <StatusIcon status={check.passed ? "pass" : "fail"} />
              <span>{check.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-background p-3 text-sm">
        <p className="font-semibold">File name</p>
        <p className="mt-1 text-muted">
          Your download is named <span className="font-medium text-foreground">{fileName}.pdf</span>, which is what recruiters like to see in their inbox.
        </p>
      </div>

      {/* downloads wait for the last change to be saved, so the file matches the screen */}
      <div className="flex flex-wrap gap-2">
        <a href={saved ? `/api/builder/${id}/export?format=pdf` : undefined} aria-disabled={!saved} className={`${PRIMARY_BUTTON} ${saved ? "" : "pointer-events-none opacity-50"}`}>
          <Download className="size-4" aria-hidden />
          Download PDF
        </a>
        <a href={saved ? `/api/builder/${id}/export?format=docx` : undefined} aria-disabled={!saved} className={`${SECONDARY_BUTTON} ${saved ? "" : "pointer-events-none opacity-50"}`}>
          <Download className="size-4" aria-hidden />
          Download DOCX
        </a>
      </div>
      <p className="text-sm text-muted">
        This resume is saved in your{" "}
        <Link href="/resumes" className={LINK_BUTTON}>
          Resume Manager
        </Link>
        . Next, see how it does against a real posting.
      </p>
      <Link href="/scans/new" className={SECONDARY_BUTTON}>
        <ScanSearch className="size-4" aria-hidden />
        Scan against a job
      </Link>
    </div>
  );
}
