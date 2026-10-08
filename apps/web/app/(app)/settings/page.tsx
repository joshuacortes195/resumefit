import { Settings } from "lucide-react";
import { PageStub } from "@/components/page-stub";

export const metadata = { title: "Settings" };

// settings page, placeholder until profile and ai settings are built
export default function SettingsPage() {
  return <PageStub title="Settings" blurb="Your profile, application preferences and AI settings." icon={Settings} />;
}
