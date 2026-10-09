import { Suspense } from "react";
import { AiSettings } from "@/components/ai-settings";
import { ProfileForm } from "@/components/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/lib/ai/status";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";

export const metadata = { title: "Settings" };

// settings page: your profile for autofill, then the ai settings
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
    </div>
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
