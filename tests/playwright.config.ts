import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../sandbox/reports/runtime/playwright-artifacts",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8080",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "../sandbox/reports/runtime/playwright.json" }]],
});
