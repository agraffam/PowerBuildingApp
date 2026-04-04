import { test, expect } from "@playwright/test";

const SEED_EMAIL = "dev@seed.local";
const SEED_PASSWORD = "Seed12345678";

async function loginAsSeed(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
}

test.describe("account page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeed(page);
  });

  test.afterEach(async ({ page }) => {
    await loginAsSeed(page);
    await page.request.patch("/api/account", {
      data: { name: "Dev seed" },
    });
  });

  test("account loads and can update display name", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    const input = page.getByLabel("Name");
    await input.fill("E2E Display Name");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(input).toHaveValue("E2E Display Name");
  });
});
