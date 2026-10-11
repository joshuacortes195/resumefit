"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// reloads the page's data when you come back to the tab, so a scan or a job saved from the extension shows up without a refresh
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
