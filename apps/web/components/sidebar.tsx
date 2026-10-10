"use client";

import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

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

// the links themselves
function SidebarLinks({ collapsed = false, onNavigate, pathname }: SidebarProps & { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {/* new scan button at the top, the plus turns a little on hover */}
      <Link
        href="/scans/new"
        onClick={onNavigate}
        title="New Scan"
        className="group mb-3 flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-sm font-semibold text-on-ink transition duration-150 hover:bg-ink-hover active:scale-[0.98]"
      >
        <Plus className="size-4 shrink-0 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
        {collapsed ? <span className="sr-only">New Scan</span> : <span>New Scan</span>}
      </Link>

      {/* one link per page, the current page is highlighted */}
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            // each link carries its own color, so the menu shows the whole palette at a glance
            style={item.section ? ({ "--link": `var(--c-${item.section})`, "--link-soft": `var(--s-${item.section})` } as CSSProperties) : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-(--link-soft,var(--primary-soft)) font-semibold text-foreground" : "text-muted hover:bg-(--link-soft,var(--primary-soft)) hover:text-foreground"
            } ${collapsed ? "justify-center" : ""}`}
          >
            {/* a bar in the link's own color marks the current page */}
            <span
              aria-hidden
              className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-full bg-(--link,var(--primary)) transition-[height,opacity] duration-200 ${
                active ? "h-5 opacity-100" : "h-0 opacity-0"
              }`}
            />
            <Icon className="size-5 shrink-0 text-(--link,currentColor)" aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
