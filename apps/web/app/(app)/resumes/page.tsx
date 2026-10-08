import { PageStub } from "@/components/page-stub";
import { navItem } from "@/lib/nav";

// sidebar entry this page belongs to
const item = navItem("/resumes");

export const metadata = { title: item.label };

// resume manager page, placeholder until the feature is built
export default function ResumesPage() {
  return <PageStub title={item.label} blurb={item.blurb} icon={item.icon} />;
}
