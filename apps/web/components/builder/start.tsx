"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Upload, UserSearch } from "lucide-react";
import { startBlankResume } from "@/app/actions/builder";
import { CARD } from "@/components/ui/buttons";
import { rememberDraft } from "@/lib/builder/open-draft";

// the three ways into the builder
export function BuilderStart() {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const linkedinRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // starts an empty resume and opens it
  function createNew() {
    setBusy("new");
    startTransition(async () => {
      const result = await startBlankResume();
      if (result.ok) {
        // remember it, so leaving and coming back lands on this resume again
        rememberDraft(result.id, true);
        router.push(`/builder/${result.id}?new=1`);
        // this screen is kept around, so the cards must be ready again if someone comes back to it
        setBusy(null);
      } else {
        setError(result.error);
        setBusy(null);
      }
    });
  }

  // reads a file into the builder's fields and opens it
  async function importFile(file: File | undefined, source: "upload" | "linkedin") {
    if (!file) return;
    setBusy(source);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("source", source);
    try {
      const response = await fetch("/api/builder/import", { method: "POST", body: form });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "We could not read that file. Try another one.");
      rememberDraft(result.id, true);
      // the cards stay busy until the editor is showing, then reset for the next visit
      startTransition(() => {
        router.push(`/builder/${result.id}`);
        setBusy(null);
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "We could not read that file. Try another one.");
      setBusy(null);
    }
  }

  // what each card does when it is pressed
  function choose(key: string) {
    if (key === "new") createNew();
    else if (key === "upload") uploadRef.current?.click();
    else linkedinRef.current?.click();
  }

  const cards = [
    { key: "new", icon: FilePlus2, title: "Create a new resume", text: "Start from a blank page and fill it in step by step." },
    { key: "upload", icon: Upload, title: "Upload my resume", text: "We read your PDF or DOCX and fill in the steps for you to tidy up." },
    { key: "linkedin", icon: UserSearch, title: "Import from LinkedIn", text: "Use the PDF of your profile. Steps are below." },
  ];

  return (
    <div>
      <div className="stagger grid gap-4 md:grid-cols-3">
        {cards.map(({ key, icon: Icon, title, text }) => (
          <button key={key} type="button" disabled={busy !== null} onClick={() => choose(key)} className={`${CARD} group p-6 text-left transition duration-150 hover:-translate-y-0.5 hover:border-primary disabled:opacity-60`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="mt-4 block font-display text-lg font-semibold">{busy === key ? "One moment..." : title}</span>
            <span className="mt-1 block text-sm text-muted">{text}</span>
          </button>
        ))}
      </div>
      {/* hidden file pickers behind the two import cards */}
      <input ref={uploadRef} type="file" accept=".pdf,.docx" aria-label="Upload my resume" className="sr-only" tabIndex={-1} onChange={(event) => importFile(event.target.files?.[0], "upload")} />
      <input ref={linkedinRef} type="file" accept=".pdf" aria-label="Import LinkedIn profile PDF" className="sr-only" tabIndex={-1} onChange={(event) => importFile(event.target.files?.[0], "linkedin")} />
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {/* how to get the linkedin pdf */}
      <div className={`${CARD} mt-6 p-6`}>
        <h2 className="font-semibold">How to get your LinkedIn profile as a PDF</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Open your own profile on linkedin.com.</li>
          <li>
            Under your name and headline, press the <strong className="text-foreground">Resources</strong> button (on some accounts it says <strong className="text-foreground">More</strong>).
          </li>
          <li>
            Choose <strong className="text-foreground">Save to PDF</strong>. The file lands in your downloads folder.
          </li>
          <li>Come back here, pick Import from LinkedIn and choose that file.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">We never sign in to LinkedIn or read your profile ourselves. You stay in control of what you share.</p>
      </div>
    </div>
  );
}
