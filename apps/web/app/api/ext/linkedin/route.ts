import { z } from "zod";
import { savePendingLinkedin } from "@/lib/data/practice";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { rateLimit } from "@/lib/rate-limit";

export const OPTIONS = preflight;

const importSchema = z.object({
  headline: z.string().trim().max(400),
  about: z.string().trim().max(6000),
  experience: z.string().trim().max(20_000),
  skills: z.array(z.string().trim().max(60)).max(100),
  url: z.string().trim().max(200).optional(),
});

// takes the profile the extension read off the person's own linkedin page and keeps it for the linkedin optimizer to pick up
export const POST = extRoute(async (request, user) => {
  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success) throw new ExtError("We could not read that profile.");
  await rateLimit(user.id, "save-job");
  const profile = parsed.data;
  if (!profile.headline && !profile.about && !profile.experience) throw new ExtError("We could not find your headline, About or experience on this page. Scroll down your profile once so it all loads, then try again.");
  await savePendingLinkedin(user.id, { ...profile, skills: profile.skills.filter(Boolean) });
  return { saved: true };
});
