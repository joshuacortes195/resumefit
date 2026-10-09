import { getProfile, profileReady } from "@/lib/data/profile";
import { parseResume } from "@resumefit/scoring";
import { getResume, listResumes } from "@/lib/data/resumes";
import { extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

// who is connected, their profile for filling forms and their resumes to pick from
export const GET = extRoute(async (_request, user) => {
  const [profile, resumes] = await Promise.all([getProfile(user.id), listResumes(user.id)]);
  // the newest job on the base resume answers "current company" and "current title" questions
  const baseId = resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const base = baseId ? await getResume(user.id, baseId) : null;
  const latest = base?.rawText ? parseResume(base.rawText).experience[0] : undefined;
  return {
    current: { title: latest?.title ?? null, company: latest?.company ?? null },
    user: { email: user.email, name: user.name },
    profile,
    profileReady: profileReady(profile),
    resumes: resumes.map(({ id, name, isBase, linkedJobId }) => ({ id, name, isBase, linkedJobId })),
  };
});
