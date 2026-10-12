import { getCurrentUser } from "@/lib/auth";
import { builderDocx } from "@/lib/builder/export-docx";
import { builderPdf } from "@/lib/builder/export-pdf";
import { toBuilderResume } from "@/lib/data/builder";
import { withinLimit } from "@/lib/rate-limit";
import { getResume } from "@/lib/data/resumes";

const TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

// downloads a builder resume as a pdf or a word file, named First-Last-Resume
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const user = await getCurrentUser();
  if (!(await withinLimit(user.id, "export"))) return new Response("That is a lot of downloads in a short time. Wait a minute and try again.", { status: 429 });
  const row = /^[0-9a-f-]{36}$/i.test(id) ? await getResume(user.id, id) : null;
  if (!row) return new Response("Resume not found", { status: 404 });

  const { data, settings } = toBuilderResume(row);
  const bytes = format === "pdf" ? await builderPdf(data, settings) : await builderDocx(data, settings);
  const name = (data.profile.name.trim().replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "-") || "My") + "-Resume";
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${name}.${format}"` } });
}
