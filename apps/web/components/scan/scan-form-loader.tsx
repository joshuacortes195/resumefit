import { ScanForm } from "@/components/scan-form";
import { getCurrentUser } from "@/lib/auth";
import { listResumes } from "@/lib/data/resumes";

// the scan form, filled with the user's saved resumes
export async function ScanFormLoader() {
  const user = await getCurrentUser();
  const resumes = await listResumes(user.id);
  return <ScanForm resumes={resumes.map(({ id, name, isBase }) => ({ id, name, isBase }))} />;
}
