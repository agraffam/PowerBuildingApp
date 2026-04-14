import { test, expect } from "@playwright/test";

const SEED_EMAIL = "dev@seed.local";
const SEED_PASSWORD = "Seed12345678";

/** Sets session cookie on the browser context via the login API (avoids UI flakes). */
async function loginAsSeed(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
}

test("unauthenticated visit redirects to login", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/programs");
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});

test.describe("smoke (mobile viewport)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeed(page);
  });

  test("home loads train context", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    const trainHeading = main.getByRole("heading", { level: 1, name: "Train" });
    const noProgram = main.getByText("No active program");
    await expect(trainHeading.or(noProgram)).toBeVisible({ timeout: 30_000 });
  });

  test("main nav: Programs page", async ({ page }) => {
    await page.goto("/programs");
    await expect(page.getByRole("heading", { name: "Programs", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("exercises page loads", async ({ page }) => {
    await page.goto("/exercises");
    await expect(page).toHaveURL(/\/exercises$/);
    await expect(page.getByRole("heading", { name: /Exercise library/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Appearance, units, and timer defaults/i)).toBeVisible();
  });
});
