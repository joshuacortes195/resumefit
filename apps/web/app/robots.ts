import type { MetadataRoute } from "next";

// tells search engines which pages are meant to be found. everything behind the sign in is somebody's own data
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/$", "/privacy", "/terms", "/scans/sample"], disallow: "/" }],
  };
}
