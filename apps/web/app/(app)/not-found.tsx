import { NotFoundMessage } from "@/components/not-found-message";

export const metadata = { title: "Not found" };

// shown inside the menu and top bar when a scan, job or report is not there
export default function AppNotFound() {
  return <NotFoundMessage />;
}
