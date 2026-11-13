"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// how long the bar waits for a page before it gives up, so a click that goes nowhere never leaves it hanging
const GIVE_UP_MS = 12_000;

// true when a click on this link is about to load another page of the app
function leavesPage(link: HTMLAnchorElement, event: MouseEvent): boolean {
  // a new tab, a download or a modified click leaves this page where it is
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  const to = new URL(link.href, location.href);
  if (to.origin !== location.origin) return false;
  // file downloads live under /api and never change the page
  if (to.pathname.startsWith("/api/")) return false;
  // the same page, or only a jump to another spot on it
  return to.pathname !== location.pathname || to.search !== location.search;
}

// the thin bar across the top that starts the moment a link is clicked and finishes when the new page shows
export function NavProgress() {
  const here = `${usePathname()}?${useSearchParams().toString()}`;
  // the address the click happened on, or null when no page is on its way
  const [from, setFrom] = useState<string | null>(null);
  // idle: nothing showing. loading: creeping along. done: the address has changed, so it fills up and fades
  const phase = from === null ? "idle" : from === here ? "loading" : "done";

  // the click handler below lives for the whole visit, so it reads the current address from here
  const latest = useRef(here);
  useEffect(() => {
    latest.current = here;
  }, [here]);

  // starts the bar on any click that leads to another page
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link instanceof HTMLAnchorElement && leavesPage(link, event)) setFrom(latest.current);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // clears the bar away once it has finished, or after a long wait with no new page
  useEffect(() => {
    if (phase === "idle") return;
    const timer = setTimeout(() => setFrom(null), phase === "loading" ? GIVE_UP_MS : 350);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  return <div aria-hidden className={`nav-progress ${phase === "done" ? "nav-progress-done" : ""}`} />;
}
