"use client";

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
export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {/* new scan button at the top, the plus turns a little on hover */}
      <Link
        href="/scans/new"
        onClick={onNavigate}
        title="New Scan"
        className="group mb-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary transition duration-150 hover:bg-primary-hover active:scale-[0.98]"
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
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft/60 hover:text-foreground"
            } ${collapsed ? "justify-center" : ""}`}
          >
            {/* little bar that marks the current page */}
            <span
              aria-hidden
              className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-[height,opacity] duration-200 ${
                active ? "h-5 opacity-100" : "h-0 opacity-0"
              }`}
            />
            <Icon className="size-5 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
