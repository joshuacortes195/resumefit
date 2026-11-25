"use client";

import { Suspense, type CSSProperties } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { sheetOf } from "@/lib/sheets";

type SidebarProps = {
  // collapsed shows icons only
  collapsed?: boolean;
  // closes the mobile drawer after a link is tapped
  onNavigate?: () => void;
};

// the list of links down the left side
export function Sidebar(props: SidebarProps) {
  // the current page is only known in the browser, so the links show without a highlight until then
  return (
    <Suspense fallback={<SidebarLinks {...props} pathname="" />}>
      <CurrentSidebar {...props} />
    </Suspense>
  );
}

// reads which page we are on and highlights its link
function CurrentSidebar(props: SidebarProps) {
  return <SidebarLinks {...props} pathname={usePathname()} />;
}

// a bar in the link's own color marks the current page. it shows the moment a link is clicked, before the new page has loaded
function ActiveBar({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-full bg-(--link,var(--primary)) transition-[height,opacity] duration-200 ${
        active || pending ? "h-5 opacity-100" : "h-0 opacity-0"
      }`}
    />
  );
}

// the links themselves
function SidebarLinks({ collapsed = false, onNavigate, pathname }: SidebarProps & { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {/* new scan button at the top, always the blueprint yellow whatever section is open, like the main button on the landing page. the plus turns a little on hover */}
      <Link
        href="/scans/new"
        onClick={onNavigate}
        title="New Scan"
        className="group mb-3 flex items-center justify-center gap-2 rounded-md bg-marker px-3 py-2.5 font-display text-sm font-bold text-on-marker transition duration-150 hover:bg-[color-mix(in_srgb,var(--marker)_85%,white)] active:scale-[0.98]"
      >
        {/* the plus sits on a dark dot */}
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-on-marker text-marker">
          <Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" strokeWidth={3} aria-hidden />
        </span>
        {collapsed ? <span className="sr-only">New Scan</span> : <span>New Scan</span>}
      </Link>

      {/* small print over the list, the pages are the sheets in the set */}
      {!collapsed && <p className="mb-1 px-3 font-drawing text-[10px] uppercase tracking-[0.12em] text-muted">Sheets</p>}

      {/* one link per page, the current page is highlighted */}
      {NAV_ITEMS.map((item) => {
        // each page's sheet number, shown at the end of its link
        const sheetNo = sheetOf(item.href)?.no;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            // each link carries its own color for its highlight and bar, the words and icons stay black
            style={item.section ? ({ "--link": `var(--c-${item.section})`, "--link-soft": `var(--s-${item.section})` } as CSSProperties) : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 ${
              active ? "bg-(--link-soft,var(--primary-soft)) font-semibold" : "hover:bg-(--link-soft,var(--primary-soft))"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <ActiveBar active={active} />
            <Icon className="size-5 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
            {!collapsed && sheetNo && (
              <span aria-hidden className="ml-auto font-drawing text-[10px] text-muted">
                {sheetNo}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
