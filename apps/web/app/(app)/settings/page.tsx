import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AiSettings } from "@/components/ai-settings";
import { DataSettings } from "@/components/data-settings";
import { CARD, LINK_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/lib/ai/status";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Settings" };

// settings page: the ai settings, the application profile and your data
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted">How the app works for you.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AiSection />
      </Suspense>
      {/* the answers Auto Apply types into application forms */}
      <section id="application" className={`${CARD} scroll-mt-20 space-y-4 p-6`}>
        <div>
          <h2 className="text-xl font-semibold">Application profile</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">Your contact details, school, work authorization and the answers you reuse. Fill it in once and Auto Apply types it into application forms for you to check.</p>
        </div>
        <Link href="/settings/application" className={SECONDARY_BUTTON}>
          <ClipboardList className="size-4" aria-hidden />
          Edit application profile
        </Link>
      </section>
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
