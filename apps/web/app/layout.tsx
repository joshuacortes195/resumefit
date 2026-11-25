import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { NavProgress } from "@/components/nav-progress";
import { SectionTheme } from "@/components/section-theme";
import { SECTION_SCRIPT } from "@/lib/sections";
import "./globals.css";

// main font for body text
const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// font for headings
const headingFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

// the drawing labels on the landing page, the small print on a blueprint
const drawingFont = JetBrains_Mono({
  variable: "--font-drawing-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// tab title and search description
export const metadata: Metadata = {
  title: { default: "ResumeFit", template: "%s | ResumeFit" },
  description: "Match your resume to any job description, track applications and apply faster. Free.",
};

// wraps every page with fonts and the color of the part of the app it belongs to
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // this request's code from the proxy. our one inline script needs it to be allowed to run
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable} ${drawingFont.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {/* sets the page color before anything is drawn, the text is fixed and written by us */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SECTION_SCRIPT }} />
        <Suspense fallback={null}>
          <SectionTheme />
          {/* the loading bar across the top while the next page is on its way */}
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
