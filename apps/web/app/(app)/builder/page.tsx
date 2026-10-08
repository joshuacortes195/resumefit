import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/builder");

export const metadata = { title: item.label };

// resume builder page, placeholder until the feature is built
export default function BuilderPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
