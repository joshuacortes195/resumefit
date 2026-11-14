import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { applicationAnswered, getProfile } from "@/lib/data/profile";
import { getResume, listResumes } from "@/lib/data/resumes";
import { prefillFromResume } from "@/lib/profile-prefill";

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
  const [profile, answered, resumes] = await Promise.all([getProfile(user.id), applicationAnswered(user.id), listResumes(user.id)]);
  // the first time through, start from what the resume already says so there is less to type
  const baseId = answered ? undefined : (resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id);
  const base = baseId ? await getResume(user.id, baseId) : null;
  const started = base?.rawText ? prefillFromResume(profile, base.rawText) : { profile, filled: 0 };
  return <ProfileForm profile={started.profile} prefilled={started.filled} />;
}
