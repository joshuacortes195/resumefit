import { Suspense } from "react";
import { AiSettings } from "@/components/ai-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/lib/ai/status";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Settings" };

// settings page, the ai part is here now and the profile part comes with auto apply
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
    </div>
  );
}

// loads which providers are set up for this user
async function AiSection() {
  const user = await getCurrentUser();
  return <AiSettings status={await aiStatus(user.id)} />;
}
