import { getProfile, profileReady } from "@/lib/data/profile";
import { parseResume } from "@resumefit/scoring";
import { getResume, listResumes } from "@/lib/data/resumes";
import { autoSubmit, rememberExtension } from "@/lib/data/extension";
import { extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

// who is connected, their profile for filling forms and their resumes to pick from
export const GET = extRoute(async (request, user) => {
  const [profile, resumes, submitForMe] = await Promise.all([getProfile(user.id), listResumes(user.id), autoSubmit(user.id), rememberExtension(user.id, request.headers.get("origin") ?? "")]);
  // the newest job on the base resume answers "current company" and "current title" questions
  const baseId = resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const base = baseId ? await getResume(user.id, baseId) : null;
  const latest = base?.rawText ? parseResume(base.rawText).experience[0] : undefined;
  return {
    current: { title: latest?.title ?? null, company: latest?.company ?? null },
    user: { email: user.email, name: user.name },
    profile,
    profileReady: profileReady(profile),
    // only true when the person switched on "Submit for me"
    autoSubmit: submitForMe,
    resumes: resumes.map(({ id, name, isBase, linkedJobId }) => ({ id, name, isBase, linkedJobId })),
  };
});
