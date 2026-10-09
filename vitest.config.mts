import path from "node:path";
import { defineConfig } from "vitest/config";

// runs every unit test in the repo from the root
export default defineConfig({
  resolve: {
    // same shortcut the web app uses for its own files
    alias: { "@": path.resolve(import.meta.dirname, "apps/web") },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/lib/**/*.test.ts", "apps/extension/src/**/*.test.ts"],
    // data tests run on a throwaway database that only lives in memory
    env: { LOCAL_DATA_DIR: "memory" },
  },
});
