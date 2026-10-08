"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// button in the top bar that flips light and dark
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground"
    >
      {/* both icons render, css shows the right one so there is no flicker */}
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}
