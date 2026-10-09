import { getCurrentUser } from "@/lib/auth";
import { exportAccount } from "@/lib/data/account";

// downloads everything stored for the signed in person as one zip
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const zip = await exportAccount(user.id);
  return new Response(Buffer.from(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="resumefit-export.zip"' } });
}
