import { Report } from "@/components/report/report";
import { sampleReportData } from "@/lib/report-data";

export const metadata = { title: "Sample scan" };

// a read only example report so new people can see what a scan gives them
export default function SampleScanPage() {
  return <Report data={sampleReportData()} resumes={[]} />;
}
