"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound, X } from "lucide-react";
import { removeOwnKey, saveOwnKey, testOwnKey } from "@/app/actions/ai";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import type { AiStatus } from "@/lib/ai/status";

// friendly names for the providers and the features
const PROVIDER_NAMES: Record<string, string> = { gemini: "Google Gemini", groq: "Groq", cloudflare: "Cloudflare Workers AI" };
const FEATURE_NAMES: Record<string, string> = {
  optimize: "Resume optimizing",
  "cover-letter": "Cover letters",
  bullets: "Bullet ideas",
  linkedin: "LinkedIn reports",
  interview: "Interview feedback",
  "thank-you": "Thank-you notes",
  builder: "Resume builder help",
};

// the ai part of the settings page: what is set up, what is left today, and your own key
export function AiSettings({ status }: { status: AiStatus }) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // runs one of the key actions and shows how it went
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, clear = false) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { ok: true, text: success } : { ok: false, text: result.error });
      if (result.ok && clear) setKey("");
    });
  }

  return (
    <section id="ai" className={`${CARD} scroll-mt-20 space-y-6 p-6`}>
      <div>
        <h2 className="text-xl font-semibold">AI settings</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The writing helpers run on free tiers only. Scans, the tracker and everything else keep working when they are off or busy.
        </p>
      </div>

      {/* which providers can be reached right now */}
      <div>
        <h3 className="text-sm font-semibold">Providers</h3>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border text-sm">
          {status.providers.map((provider) => (
            <li key={provider.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              {provider.ready ? <Check className="size-4 text-success" aria-hidden /> : <X className="size-4 text-muted" aria-hidden />}
              <span className="font-medium">{PROVIDER_NAMES[provider.name]}</span>
              <span className="text-muted">{provider.ready ? "Ready" : "Not set up"}</span>
              {provider.lastError && <span className="w-full pl-7 text-xs text-muted">Last problem: {provider.lastError}</span>}
            </li>
          ))}
        </ul>
        {!status.available && <p className="mt-2 text-sm text-muted">Nothing is set up yet. Add your own free Gemini key below to turn the writing helpers on.</p>}
      </div>

      {/* how many uses are left today */}
      <div>
        <h3 className="text-sm font-semibold">Left today</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {Object.entries(status.remaining).map(([feature, left]) => (
            <div key={feature} className="flex justify-between gap-3">
              <dt className="text-muted">{FEATURE_NAMES[feature] ?? feature}</dt>
              <dd className="tabular-nums">{left}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* bring your own key */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-muted" aria-hidden />
          Use my own free Gemini key
        </h3>
        <p className="mt-1 max-w-prose text-sm text-muted">
          A key of your own gets tried first, so you are not sharing a daily allowance with anyone. Keys are free from{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={LINK_BUTTON}>
            Google AI Studio
          </a>{" "}
          and no card is needed. We store it encrypted.
        </p>
        {status.hasOwnKey && (
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-4" aria-hidden />
              {status.ownKeyEnding ? `Your key ending in ${status.ownKeyEnding} is saved and in use.` : "Your key is saved and in use."}
            </span>
            <button type="button" disabled={pending} onClick={() => run(removeOwnKey, "Your key was removed.")} className="font-semibold text-danger hover:underline">
              Remove key
            </button>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            aria-label="Gemini API key"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={status.hasOwnKey ? "Paste a new key to replace the saved one" : "Paste your Gemini API key"}
            className={`${INPUT} min-w-60 flex-1`}
          />
          <button type="button" disabled={pending || key.trim() === ""} onClick={() => run(() => testOwnKey(key), "That key works.")} className={SECONDARY_BUTTON}>
            Test
          </button>
          <button type="button" disabled={pending || key.trim() === ""} onClick={() => run(() => saveOwnKey(key), "Your key is saved.", true)} className={PRIMARY_BUTTON}>
            {pending ? "Checking..." : "Save key"}
          </button>
        </div>
        <p aria-live="polite" className={`mt-2 min-h-5 text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
          {message?.text}
        </p>
      </div>

      {/* what leaves the app when a helper runs */}
      <p className="max-w-prose border-t border-border pt-4 text-xs text-muted">
        AI features send redacted resume and job text to a free AI provider (Groq, Google Gemini or Cloudflare, whichever is set up), which may use it to improve their models. Your name and contact
        details are removed first.
      </p>
    </section>
  );
}
