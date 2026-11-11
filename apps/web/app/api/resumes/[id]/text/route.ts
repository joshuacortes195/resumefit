import { getCurrentUser } from "@/lib/auth";
import { getResume } from "@/lib/data/resumes";
import { isUuid } from "@/lib/ids";

// the text of one resume, for the preview in the resume manager
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser();
  const resume = isUuid(id) ? await getResume(user.id, id) : null;
  if (!resume) return Response.json({ error: "Resume not found" }, { status: 404 });
  return Response.json({ name: resume.name, text: resume.rawText ?? "" });
}
