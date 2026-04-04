import { test, expect } from "@playwright/test";

const SEED_EMAIL = "dev@seed.local";
const SEED_PASSWORD = "Seed12345678";

test("unauthenticated settings API returns 401", async ({ request }) => {
  const r = await request.get("/api/settings");
  expect(r.status()).toBe(401);
});

test("IDOR: other user cannot read seed workout session", async ({ request, browser, baseURL }) => {
  const root = baseURL ?? "http://127.0.0.1:3333";

  const seedLogin = await request.post("/api/auth/login", {
    data: { email: SEED_EMAIL, password: SEED_PASSWORD },
  });
  expect(seedLogin.ok()).toBeTruthy();

  const start = await request.post("/api/training/start-session", { data: {} });
  expect(start.ok()).toBeTruthy();
  const { sessionId } = (await start.json()) as { sessionId: string };
  expect(sessionId).toBeTruthy();

  const u2 = `e2e-${Date.now()}@local.test`;
  const p2 = "AnotherGood9";

  const ctx = await browser.newContext({ baseURL: root });
  const r2 = ctx.request;
  const reg = await r2.post("/api/auth/register", {
    data: { email: u2, password: p2 },
  });
  expect(reg.ok()).toBeTruthy();

  const login2 = await r2.post("/api/auth/login", {
    data: { email: u2, password: p2 },
  });
  expect(login2.ok()).toBeTruthy();

  const leak = await r2.get(`/api/training/sessions/${sessionId}`);
  expect(leak.status()).toBe(404);

  await ctx.close();
});
