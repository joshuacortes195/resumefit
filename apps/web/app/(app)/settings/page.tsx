import { Suspense } from "react";
import Link from "next/link";
import { AiSettings } from "@/components/ai-settings";
import { DataSettings } from "@/components/data-settings";
import { ProfileForm } from "@/components/profile-form";
import { LINK_BUTTON } from "@/components/ui/buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/lib/ai/status";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";

export const metadata = { title: "Settings" };

// settings page: your profile for autofill, the ai settings, and your data
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted">How the app works for you.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProfileSection />
      </Suspense>
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

// loads the saved profile into the form
async function ProfileSection() {
  const user = await getCurrentUser();
  return <ProfileForm profile={await getProfile(user.id)} />;
}

// loads which providers are set up for this user
async function AiSection() {
  const user = await getCurrentUser();
  return <AiSettings status={await aiStatus(user.id)} />;
}
