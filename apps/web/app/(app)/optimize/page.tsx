import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/optimize");

export const metadata = { title: item.label };

// ai optimize page, placeholder until the feature is built
export default function OptimizePage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
