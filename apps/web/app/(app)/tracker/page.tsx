import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/tracker");

export const metadata = { title: item.label };

// job tracker page, placeholder until the feature is built
export default function TrackerPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
