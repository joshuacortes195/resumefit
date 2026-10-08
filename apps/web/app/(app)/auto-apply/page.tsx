import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/auto-apply");

export const metadata = { title: item.label };

// auto apply page, placeholder until the feature is built
export default function AutoApplyPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
