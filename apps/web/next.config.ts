import type { NextConfig } from "next";

// the content security policy is not here: it carries a fresh code on every request, so the proxy writes it
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // the microphone is only for interview practice, nothing else is ever asked for
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  // no need to tell visitors what the app is built with
  poweredByHeader: false,
  // the same safety headers on every page
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  // these load their own files at runtime, so they are left out of the bundle
  serverExternalPackages: ["@electric-sql/pglite", "unpdf"],
  // the pdf page reader is started as a side thread from its own file, so that file has to be shipped with the routes that take uploads
  outputFileTracingIncludes: { "/api/**": ["./lib/files/pdf-pages.mjs"] },
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
