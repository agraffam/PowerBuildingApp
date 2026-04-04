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

test.describe.configure({ mode: "serial" });

test.describe("train journey", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeed(page);
  });

  test("start workout from home navigates to session", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Train", level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    const continueBtn = page.getByRole("link", { name: /Continue workout/i });
    const startBtn = page.getByRole("button", { name: /Start workout/i });

    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
    } else {
      await startBtn.click();
    }

    await expect(page).toHaveURL(/\/workout\/[a-z0-9]+/i, { timeout: 30_000 });
  });
});
