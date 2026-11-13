import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";

export const metadata = { title: "Application profile" };

// the application profile: filled in once here, then typed into every real application for the person to check
export default function ApplicationProfilePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <ApplicationLoader />
      </Suspense>
    </div>
  );
}

// loads the saved answers into the form
async function ApplicationLoader() {
  const user = await getCurrentUser();
  return <ProfileForm profile={await getProfile(user.id)} />;
}
