"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// remembers light or dark and puts the class on the html tag
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
