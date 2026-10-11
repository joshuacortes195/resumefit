import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { CARD } from "@/components/ui/buttons";
import { TableSkeleton } from "@/components/ui/skeleton";
import { DAILY_CAPS, type AiFeature } from "@/lib/ai/limits";
import { readyProviders, savedProviderHealth } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { listInvites, listUsers, usageByDay } from "@/lib/data/admin";
import { LocalTime } from "@/components/local-time";
import { dailyCaps, featureFlags, FLAGS, type Flag } from "@/lib/data/settings";

export const metadata = { title: "Admin" };


// names for the capped features
const CAP_LABELS: Partial<Record<AiFeature, string>> = { optimize: "Optimize", "cover-letter": "Cover letters", bullets: "Bullet ideas", linkedin: "LinkedIn", interview: "Interview", "thank-you": "Thank-you notes", builder: "Builder" };

// the admin page, only for people marked as admin
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl font-semibold">Admin</h1>
      <Suspense fallback={<TableSkeleton />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

async function AdminContent() {
  const user = await getCurrentUser();
  // everyone else gets the same "no such page" as any other wrong address
  if (!user.isAdmin) notFound();

  const [users, invites, usage, caps, flags, ready] = await Promise.all([listUsers(), listInvites(), usageByDay(), dailyCaps(), featureFlags(), readyProviders()]);
  const health = await savedProviderHealth();
  const readyNames = new Set(ready.map((provider) => provider.name));

  return (
    <>
      <AdminPanel
        invites={invites.map((invite) => ({ code: invite.code, uses: invite.uses, maxUses: invite.maxUses, expiresAt: invite.expiresAt?.toISOString() ?? null }))}
        caps={(Object.keys(DAILY_CAPS) as AiFeature[]).filter((feature) => DAILY_CAPS[feature] !== null).map((feature) => ({ feature, label: CAP_LABELS[feature] ?? feature, cap: caps[feature] ?? 0 }))}
        flags={(Object.keys(FLAGS) as Flag[]).map((key) => ({ key, label: FLAGS[key], on: flags[key] }))}
      />

      {/* which providers are answering */}
      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">Provider health</h2>
        <p className="mt-1 text-sm text-muted">The most recent answer and the most recent problem from each provider.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 font-medium">Provider</th>
              <th className="py-2 font-medium">Set up</th>
              <th className="py-2 font-medium">Last answer</th>
              <th className="py-2 font-medium">Rate limit hits</th>
              <th className="py-2 font-medium">Last error</th>
            </tr>
          </thead>
          <tbody>
            {(["gemini", "groq", "cloudflare"] as const).map((name) => (
              <tr key={name} className="border-b border-border last:border-0">
                <td className="py-2.5 font-medium capitalize">{name}</td>
                <td className="py-2.5">{readyNames.has(name) ? "Yes" : "No"}</td>
                <td className="py-2.5 text-muted">{health[name]?.lastOk ? <LocalTime value={health[name].lastOk} style="time" /> : "None yet"}</td>
                <td className="py-2.5 tabular-nums">{health[name]?.rateLimitHits ?? 0}</td>
                <td className="max-w-md py-2.5 text-muted">{health[name]?.lastError ?? "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* how much the writing features are being used */}
      <section className={`${CARD} p-6`}>
        <h2 className="text-xl font-semibold">AI usage, last 14 days</h2>
        {usage.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No requests yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-medium">Day</th>
                <th className="py-2 font-medium">Provider</th>
                <th className="py-2 font-medium">Feature</th>
                <th className="py-2 text-right font-medium">Requests</th>
                <th className="py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={`${row.day}-${row.provider}-${row.feature}`} className="border-b border-border last:border-0">
                  <td className="py-2 text-muted">{row.day}</td>
                  <td className="py-2 capitalize">{row.provider}</td>
                  <td className="py-2">{row.feature}</td>
                  <td className="py-2 text-right tabular-nums">{row.calls}</td>
                  <td className="py-2 text-right tabular-nums">{row.tokens.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${CARD} overflow-x-auto p-6`}>
        <h2 className="text-xl font-semibold">Users ({users.length})</h2>
        <table className="mt-4 w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Joined</th>
              <th className="py-2 font-medium">Invite</th>
              <th className="py-2 text-right font-medium">Scans</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="py-2.5 font-medium">
                  {row.email}
                  {row.isAdmin && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">admin</span>}
                </td>
                <td className="py-2.5 text-muted">{row.name ?? ""}</td>
                <td className="py-2.5 text-muted"><LocalTime value={row.createdAt} /></td>
                <td className="py-2.5 font-mono text-muted">{row.inviteCodeUsed ?? ""}</td>
                <td className="py-2.5 text-right tabular-nums">{row.scans}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
