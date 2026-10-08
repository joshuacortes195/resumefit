import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/jobs");

export const metadata = { title: item.label };

// find jobs page, placeholder until the feature is built
export default function JobsPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
