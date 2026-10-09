import { defineConfig, devices } from "@playwright/test";

// the port the app runs on while the browser tests drive it
const PORT = 3210;

// browser tests that click through the real app
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // the tests share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // builds the app and starts it on a throwaway database that only lives in memory
  webServer: {
    command: `pnpm --filter @resumefit/extension build && pnpm --filter web build && pnpm --filter web start --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 180_000,
    reuseExistingServer: false,
    // the writing features answer from a built in stand in, so no keys are needed
    env: { LOCAL_DATA_DIR: "memory", AI_MOCK: "1" },
  },
});
