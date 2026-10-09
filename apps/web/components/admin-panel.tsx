"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { createInviteAction, revokeInviteAction, saveCapsAction, saveFlagsAction } from "@/app/actions/admin";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

type AdminPanelProps = {
  invites: { code: string; uses: number; maxUses: number; expiresAt: string | null }[];
  caps: { feature: string; label: string; cap: number }[];
  flags: { key: string; label: string; on: boolean }[];
};

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// the parts of the admin page that change things: invite codes, daily caps and feature switches
export function AdminPanel({ invites, caps, flags }: AdminPanelProps) {
  const [maxUses, setMaxUses] = useState("1");
  const [days, setDays] = useState("30");
  const [capValues, setCapValues] = useState(() => Object.fromEntries(caps.map((cap) => [cap.feature, String(cap.cap)])));
  const [flagValues, setFlagValues] = useState(() => Object.fromEntries(flags.map((flag) => [flag.key, flag.on])));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // runs a change and says how it went
  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { ok: true, text: done } : { ok: false, text: result.error });
    });
  }

  // copies a sign in link that already has the code in it
  async function copyLink(code: string) {
    await navigator.clipboard.writeText(`${location.origin}/sign-in?invite=${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <p aria-live="polite" className={`min-h-5 text-sm ${message?.ok ? "text-success" : "text-danger"}`}>
        {message?.text}
      </p>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Invite codes</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Uses
            <input value={maxUses} onChange={(event) => setMaxUses(event.target.value)} inputMode="numeric" className={`${INPUT} mt-1 w-24 font-normal`} />
          </label>
          <label className="text-sm font-medium">
            Expires in days <span className="font-normal text-muted">(empty for never)</span>
            <input value={days} onChange={(event) => setDays(event.target.value)} inputMode="numeric" className={`${INPUT} mt-1 w-32 font-normal`} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => createInviteAction({ maxUses: Number(maxUses), expiresInDays: days.trim() === "" ? null : Number(days) }), "Invite code created.")} className={PRIMARY_BUTTON}>
            <Plus className="size-4" aria-hidden />
            Create code
          </button>
        </div>
        {invites.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No invite codes yet. Create one and send the link to a friend.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Used</th>
                <th className="py-2 font-medium">Expires</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.code} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-mono font-semibold">{invite.code}</td>
                  <td className="py-2.5 tabular-nums">
                    {invite.uses} of {invite.maxUses}
                  </td>
                  <td className="py-2.5 text-muted">{invite.expiresAt ? DATE.format(new Date(invite.expiresAt)) : "Never"}</td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={() => copyLink(invite.code)} className={`${SECONDARY_BUTTON} px-2.5 py-1.5`}>
                      {copied === invite.code ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                      {copied === invite.code ? "Copied" : "Copy link"}
                    </button>
                    <button type="button" aria-label={`Revoke ${invite.code}`} disabled={pending} onClick={() => run(() => revokeInviteAction(invite.code), "Invite code revoked.")} className="ml-1 rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Daily AI caps per person</h2>
        <p className="mt-1 text-sm text-muted">How many times a day one person can use each feature. Lower these if the shared free allowance keeps running out.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {caps.map((cap) => (
            <label key={cap.feature} className="text-sm font-medium">
              {cap.label}
              <input value={capValues[cap.feature] ?? ""} onChange={(event) => setCapValues({ ...capValues, [cap.feature]: event.target.value })} inputMode="numeric" className={`${INPUT} mt-1 font-normal`} />
            </label>
          ))}
        </div>
        <button type="button" disabled={pending} onClick={() => run(() => saveCapsAction(Object.fromEntries(Object.entries(capValues).map(([feature, value]) => [feature, Number(value)]))), "Caps saved.")} className={`${SECONDARY_BUTTON} mt-4`}>
          Save caps
        </button>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Feature switches</h2>
        <ul className="mt-3 space-y-2">
          {flags.map((flag) => (
            <li key={flag.key}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={flagValues[flag.key] ?? false} onChange={(event) => setFlagValues({ ...flagValues, [flag.key]: event.target.checked })} className="size-4 accent-(--primary)" />
                {flag.label}
              </label>
            </li>
          ))}
        </ul>
        <button type="button" disabled={pending} onClick={() => run(() => saveFlagsAction(flagValues), "Switches saved.")} className={`${SECONDARY_BUTTON} mt-4`}>
          Save switches
        </button>
      </section>
    </>
  );
}
