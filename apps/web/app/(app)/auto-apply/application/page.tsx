import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";

export const metadata = { title: "Your application" };

// the one application: filled in once here, then used to answer every real one
export default function ApplicationPage() {
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
