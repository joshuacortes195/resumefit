import path from "node:path";
import { defineConfig } from "vitest/config";

// runs every unit test in the repo from the root
export default defineConfig({
  resolve: {
    // same shortcut the web app uses for its own files
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/web"),
      // next handles the server only marker itself, outside of next it is just an empty file
      "server-only": path.resolve(import.meta.dirname, "apps/web/node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/lib/**/*.test.ts", "apps/extension/src/**/*.test.ts"],
    // data tests run on a throwaway database that only lives in memory
    env: { LOCAL_DATA_DIR: "memory" },
    // the first test in each data file waits for its database to be set up
    testTimeout: 30_000,
    // same wait for a setup step that touches the database before the first test
    hookTimeout: 30_000,
  },
});
