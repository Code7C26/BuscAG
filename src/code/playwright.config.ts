import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { stagingEnvironment } from "./lib/stagingEnvironment.mjs";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.platform === "linux"
        ? {
            executablePath:
              process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
              (existsSync("/usr/bin/chromium")
                ? "/usr/bin/chromium"
                : undefined),
          }
        : {}),
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --mode staging",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    env: { ...stagingEnvironment("sb_publishable_e2e_fixture") },
    timeout: 30000,
  },
});
