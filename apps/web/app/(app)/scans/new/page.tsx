import { ScanForm } from "@/components/scan-form";

export const metadata = { title: "New Scan" };

// new scan page, paste a resume and a job description and get the report
export default function NewScanPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">New Scan</h1>
      <p className="mt-1 mb-6 text-muted">Paste your resume and a job description to see your match rate and what to fix.</p>
      <ScanForm />
    </div>
  );
}
