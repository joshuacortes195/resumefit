import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// main font for the app
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// font for code and numbers
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
