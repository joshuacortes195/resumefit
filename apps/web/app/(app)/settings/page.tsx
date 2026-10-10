import { Suspense } from "react";
import Link from "next/link";
import { AiSettings } from "@/components/ai-settings";
import { DataSettings } from "@/components/data-settings";
import { CARD, LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/lib/ai/status";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Settings" };

// settings page: a way to your application, the ai settings, and your data
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted">How the app works for you.</p>
      </div>
      {/* the details autofill uses live on a page of their own now */}
      <section id="profile" className={`${CARD} flex scroll-mt-20 flex-wrap items-center justify-between gap-4 p-6`}>
        <div className="min-w-64 flex-1">
          <h2 className="text-xl font-semibold">Your one application</h2>
          <p className="mt-1 text-sm text-muted">Your contact details, work eligibility, school and self-identification answers. Auto Apply fills in real applications from it.</p>
        </div>
        <Link href="/auto-apply/application" className={SECONDARY_BUTTON}>
          Open my application
        </Link>
      </section>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AiSection />
      </Suspense>
      <DataSettings />
      <Suspense fallback={null}>
        <AdminLink />
      </Suspense>
    </div>
  );
}

// a way into the admin page, only shown to admins
async function AdminLink() {
  const user = await getCurrentUser();
  if (!user.isAdmin) return null;
  return (
    <p className="text-sm">
      <Link href="/admin" className={LINK_BUTTON}>
        Open the admin page
      </Link>{" "}
      <span className="text-muted">for invite codes, usage and feature switches.</span>
    </p>
  );
}

// loads which providers are set up for this user
async function AiSection() {
  const user = await getCurrentUser();
  return <AiSettings status={await aiStatus(user.id)} />;
}
