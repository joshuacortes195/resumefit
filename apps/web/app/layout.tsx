import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { connection } from "next/server";
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

// wraps every page with the fonts
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // every page is made fresh for its request. that is what lets the framework stamp this request's code on its scripts,
  // which the content policy in the proxy asks for. a page built ahead of time would have no code and its scripts would be refused
  await connection();
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
