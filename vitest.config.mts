import { defineConfig } from "vitest/config";

// runs every unit test in the repo from the root
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
  },
});
