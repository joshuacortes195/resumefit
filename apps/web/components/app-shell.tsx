"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, PanelLeft, UserRound, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Sidebar } from "@/components/sidebar";

// links inside the avatar menu
const ACCOUNT_LINKS = [
  { label: "Profile", href: "/settings#profile" },
  { label: "Settings", href: "/settings" },
  { label: "AI settings", href: "/settings#ai" },
];

// top bar, sidebar and the page area for every signed in page
export function AppShell({ children }: { children: React.ReactNode }) {
  // desktop sidebar shrinks to icons, mobile sidebar slides in as a drawer
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur print:hidden">
        {/* hamburger, phones only */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>

        {/* collapse button, desktop only */}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="hidden rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground md:block"
        >
          <PanelLeft className="size-5" aria-hidden />
        </button>

        <Logo />

        <div className="ml-auto flex items-center gap-1">

          {/* avatar menu */}
          <div className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-transform duration-150 active:scale-95"
            >
              <UserRound className="size-5" aria-hidden />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-44 origin-top-right animate-pop rounded-xl border border-border bg-surface p-1 shadow-lg">
                {ACCOUNT_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-soft"
                  >
                    {link.label}
                  </Link>
                ))}
                {/* sign out is a real action, not a link */}
                <form action={signOut}>
                  <button type="submit" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary-soft">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* desktop sidebar */}
        <aside
          className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border bg-background transition-[width] duration-200 ease-settle md:block print:hidden ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {/* mobile drawer with a dark backdrop behind it */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="absolute inset-0 animate-fade bg-black/50" />
            <aside className="relative flex h-full w-64 animate-drawer flex-col bg-surface shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-border px-3">
                <Logo />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        {/* the page itself */}
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
