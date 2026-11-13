import { parseResume } from "@resumefit/scoring";
import { getProfile, profileReady } from "@/lib/data/profile";
import { getResume, listResumes } from "@/lib/data/resumes";
import { featureFlags } from "@/lib/data/settings";
import { extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

// who is connected and their resumes to scan against. while auto apply is switched on, also the application profile it fills forms from
export const GET = extRoute(async (_request, user) => {
  const [resumes, flags] = await Promise.all([listResumes(user.id), featureFlags()]);
  const account = {
    user: { email: user.email, name: user.name },
    resumes: resumes.map(({ id, name, isBase, linkedJobId }) => ({ id, name, isBase, linkedJobId })),
    autoApply: flags.autoApply,
  };
  // with the feature off the profile never leaves the app
  if (!flags.autoApply) return account;

  const profile = await getProfile(user.id);
  // the newest job on the base resume answers "current company" and "current title" questions
  const baseId = resumes.find((resume) => resume.isBase)?.id ?? resumes[0]?.id;
  const base = baseId ? await getResume(user.id, baseId) : null;
  const latest = base?.rawText ? parseResume(base.rawText).experience[0] : undefined;
  // the saved answers stay behind, they are looked up one question at a time
  const answers = Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "qaBank"));
  return { ...account, profile: answers, profileReady: profileReady(profile), current: { title: latest?.title ?? null, company: latest?.company ?? null } };
});
