import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
