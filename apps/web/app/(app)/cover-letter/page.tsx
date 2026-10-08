import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/cover-letter");

export const metadata = { title: item.label };

// cover letter page, placeholder until the feature is built
export default function CoverLetterPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
