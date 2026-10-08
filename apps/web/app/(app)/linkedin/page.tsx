import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/linkedin");

export const metadata = { title: item.label };

// linkedin optimizer page, placeholder until the feature is built
export default function LinkedInPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
