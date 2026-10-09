import { getCurrentUser } from "@/lib/auth";
import { errorResponse, resolveResume } from "@/lib/scan-request";

// saves an uploaded or pasted resume to the resume manager
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const resume = await resolveResume(user.id, await request.formData());
    return Response.json({ id: resume.resumeId });
  } catch (error) {
    return errorResponse(error);
  }
}
