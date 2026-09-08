import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const allowedHosts = new Set(["127.0.0.1:8080"]);

test.beforeEach(async ({ page }) => {
  const attemptedExternal: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!allowedHosts.has(url.host) && url.protocol !== "data:") attemptedExternal.push(request.url());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!allowedHosts.has(url.host) && url.protocol !== "data:") return route.abort("blockedbyclient");
    return route.continue();
  });
  (page as typeof page & { attemptedExternal?: string[] }).attemptedExternal = attemptedExternal;
});

test.afterEach(async ({ page }) => {
  const attempted = (page as typeof page & { attemptedExternal?: string[] }).attemptedExternal ?? [];
  expect(attempted, `Unexpected external request attempts: ${attempted.join(", ")}`).toEqual([]);
});

test("sign in, upload, recover, inspect, history and export", async ({ page }) => {
  const username = process.env.ETD_E2E_USERNAME;
  const password = process.env.ETD_E2E_PASSWORD;
  test.skip(!username || !password, "Disposable sandbox credentials are required");
  await page.goto("/");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Preserve and inspect an original email" })).toBeVisible();
  await page.locator("#email-file").setInputFiles(resolve(process.cwd(), "fixtures/eml/credential-link.eml"));
  await page.getByRole("button", { name: "Upload for analysis" }).click();
  await page.reload();
  await expect(page.getByText("Rules-based risk index")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("ETD-CONTENT-001")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  await download;
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Analysis history" })).toBeVisible();
});
