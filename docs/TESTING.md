# Testing

## Unit and component tests (Vitest)

Stack: **Vitest**, **jsdom**, **@testing-library/react**, **@testing-library/jest-dom**.

Tests live next to source as `*.test.ts` / `*.test.tsx` under `src/`.

```bash
npm run test        # watch
npm run test:run    # single run (CI)
```

### What is covered

- `src/lib/auth/password-policy.test.ts` — minimum length and common-password rejection (Zod field schema).
- `src/lib/training-session-patch-schema.test.ts` — workout session `PATCH` body discriminated union (ranges, unknown actions).
- `src/lib/calculators.test.ts` — Brzycki 1RM, bar increment coercion, `suggestNextWeekLoad`, rounding.
- `src/components/training/exercise-library-sheet.test.tsx` — mocked `fetch` + Zustand store: library-all mode does not call `/api/exercises/top`, exercise slug loads history/recent rows, error state shows retry.

### Adding a component test

1. Wrap UI that uses React Query in `QueryClientProvider` with `retry: false` for deterministic failures.
2. Reset `useWorkoutSessionStore.setState(...)` in `beforeEach` when touching the workout library sheet.
3. Mock `globalThis.fetch` with `vi.spyOn` and branch on URL.

Config: [vitest.config.ts](../vitest.config.ts), setup: [src/test/setup.ts](../src/test/setup.ts).

## End-to-end tests (Playwright)

Mobile-style runs use **Chromium** with **iPhone 14** viewport/touch flags (WebKit is optional; Chromium avoids an extra browser download on many setups).

```bash
npx playwright install chromium   # first time only
npm run test:e2e                  # default URL http://127.0.0.1:3333
```

The config starts `npm run db:generate` and `next dev` (without Turbopack) on `PLAYWRIGHT_PORT` (default **3333**). If a server is already running, set `reuseExistingServer` by **not** setting `CI=1`, or pass `PLAYWRIGHT_BASE_URL`.

Smoke flows ([e2e/smoke.spec.ts](../e2e/smoke.spec.ts)):

- Home shows “Today” or “No active program”.
- `/programs` heading.
- Header nav → Exercises.
- `/settings` heading and training card copy.

Additional specs:

- [e2e/account.spec.ts](../e2e/account.spec.ts) — Account page display name save + reload.
- [e2e/train-flow.spec.ts](../e2e/train-flow.spec.ts) — Start or continue workout → `/workout/:id` (serial; seed user).
- [e2e/api-security.spec.ts](../e2e/api-security.spec.ts) — `GET /api/settings` unauthenticated 401; IDOR on training session across two users.

Playwright runs **iPhone 14** and **chromium-desktop** projects; the dev server sets `AUTH_RATE_LIMIT_DISABLED=1` so e2e is not flaky on login/register.

### CI notes

- Set `CI=1` for stricter retries and to fail on `test.only`.
- Ensure `DATABASE_URL` and `.env` exist so API routes work during `next dev`.
- Artifacts: Playwright writes to `test-results/` and `playwright-report/` (gitignored).

## Manual checks

- **Workout history:** History → open a completed session → edit a set (weight/reps/RPE/done) → confirm values persist after refresh; delete workout → confirm it disappears from the list and does not break Train.
- **Mobile:** See [MOBILE_QA.md](./MOBILE_QA.md).
