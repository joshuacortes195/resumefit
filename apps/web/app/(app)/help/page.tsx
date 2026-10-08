import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/help");

export const metadata = { title: item.label };

// help page, placeholder until the feature is built
export default function HelpPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
