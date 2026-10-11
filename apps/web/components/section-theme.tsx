"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { sectionOf } from "@/lib/sections";

// keeps the page color in step with the part of the app you are in as you move around
export function SectionTheme() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const section = sectionOf(pathname);
    if (section) document.documentElement.dataset.section = section;
    else delete document.documentElement.dataset.section;
  }, [pathname]);
  return null;
}
