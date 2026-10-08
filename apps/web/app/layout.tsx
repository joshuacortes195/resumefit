import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// main font for body text
const bodyFont = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// font for headings
const headingFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

// tab title and search description
export const metadata: Metadata = {
  title: { default: "ResumeFit", template: "%s | ResumeFit" },
  description: "Match your resume to any job description, track applications and apply faster. Free.",
};

// wraps every page with fonts and the theme
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
