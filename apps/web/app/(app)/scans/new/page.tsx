import { Plus } from "lucide-react";
import { PageStub } from "@/components/page-stub";

export const metadata = { title: "New Scan" };

// new scan page, placeholder until the scan flow is built
export default function NewScanPage() {
  return <PageStub title="New Scan" blurb="Upload a resume, paste a job description and get your match rate." icon={Plus} />;
}
