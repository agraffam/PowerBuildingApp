# Mobile QA checklist (iPhone)

Use Safari on a device or **iPhone 14** (or 15) simulator at **390×844** or **375×812** portrait. Optionally connect [Safari Web Inspector](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios-apps) to the phone.

## Shell and navigation

- [ ] Header does not clip under the notch / Dynamic Island; logo and nav are reachable.
- [ ] Nav links scroll horizontally if needed; each link opens the correct route.
- [ ] Tap targets feel comfortable (~44pt); no accidental mis-taps.

## Train (home)

- [ ] “Start workout” / “Continue workout” works and navigates to `/workout/[id]`.
- [ ] “Skip / shift next day” runs without error (if shown).
- [ ] Error messages are readable if API fails.

## Workout session

- [ ] Readiness card submits and session continues.
- [ ] Set rows: weight, reps, RPE save on blur; Done toggles and rest timer can start.
- [ ] **Library** opens full-width sheet; search and exercise list scroll inside the sheet.
- [ ] **History** (per exercise) opens the same sheet with a **History** section at the bottom: loading state, then “Best est. set” and/or **Recent sessions** with dates, or empty copy if no completed sets.
- [ ] History **Try again** appears if the request fails (e.g. airplane mode).
- [ ] Sheet closes via overlay tap or X; returning to workout works.
- [ ] Keyboard over number inputs does not hide primary actions (scroll if needed).

## Programs / builder

- [ ] Program list and activate flow work.
- [ ] New/edit program wizard steps and save (where allowed).

## Exercises / Strength / Settings

- [ ] Exercises list scrolls; bar-increment select saves.
- [ ] Strength (1RM) saves.
- [ ] Settings: unit and increments save; layout readable.

## Regression notes

History only includes sets from **completed** sessions with **done** logged sets (`weight` / `reps` &gt; 0). In-progress work will not appear until the session is completed—this is expected.
