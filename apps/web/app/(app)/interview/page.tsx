import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/interview");

export const metadata = { title: item.label };

// interview practice page, placeholder until the feature is built
export default function InterviewPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
