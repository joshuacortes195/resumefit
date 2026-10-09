import type { NextConfig } from "next";

// what the browser is allowed to load and where it may send things. the dev server needs eval for hot reloading
const dev = process.env.NODE_ENV !== "production";
const CONTENT_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // job site icons on the auto apply page come straight from those sites
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co${dev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // the microphone is only for interview practice, nothing else is ever asked for
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  // the same safety headers on every page
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  cacheComponents: true,
  partialPrefetching: true,
  // these load their own files at runtime, so they are left out of the bundle
  serverExternalPackages: ["@electric-sql/pglite", "unpdf"],
  // workspace packages ship as typescript, so next has to compile them
  transpilePackages: ["@resumefit/shared", "@resumefit/scoring", "@resumefit/skills-data"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
