import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/extension");

export const metadata = { title: item.label };

// chrome extension page, placeholder until the feature is built
export default function ExtensionPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
