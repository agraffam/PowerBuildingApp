# Testing

## Unit and component tests (Vitest)

Stack: **Vitest**, **jsdom**, **@testing-library/react**, **@testing-library/jest-dom**.

Tests live next to source as `*.test.ts` / `*.test.tsx` under `src/`.

```bash
npm run test        # watch
npm run test:run    # single run (CI)
```

### What is covered

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

### CI notes

- Set `CI=1` for stricter retries and to fail on `test.only`.
- Ensure `DATABASE_URL` and `.env` exist so API routes work during `next dev`.
- Artifacts: Playwright writes to `test-results/` and `playwright-report/` (gitignored).

## Manual checks

- **Workout history:** History → open a completed session → edit a set (weight/reps/RPE/done) → confirm values persist after refresh; delete workout → confirm it disappears from the list and does not break Train.
- **Mobile:** See [MOBILE_QA.md](./MOBILE_QA.md).
