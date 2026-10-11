import { listResumes } from "@/lib/data/resumes";
import { extRoute, preflight } from "@/lib/ext-auth";

export const OPTIONS = preflight;

// who is connected and their resumes to scan against
export const GET = extRoute(async (_request, user) => {
  const resumes = await listResumes(user.id);
  return {
    user: { email: user.email, name: user.name },
    resumes: resumes.map(({ id, name, isBase }) => ({ id, name, isBase })),
  };
});
