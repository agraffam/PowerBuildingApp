# Plan: Cardio options & tracking (not implemented)

**Status:** Planning only — no implementation yet.  
**Date captured:** 2026-04-05

This document records design options for adding cardio to the PowerBuilding app without executing work. Use it when prioritizing a future feature.

---

## Current architecture (strength-centric)

- **`ProgramDay`** → list of **`ProgramExercise`**: sets, rep target, RPE, optional %1RM, rest, etc.
- **`WorkoutSession`** is always tied to **`ProgramInstance`** + **`ProgramDay`**.
- **`LoggedSet`** is tied to **`ProgramExercise`** and stores **weight / reps / RPE** (lift semantics).
- Live workout UI (`src/components/training/workout-session-view.tsx`) groups exercises with **`clusterSupersetBlocks`** (superset groups) — not “cardio vs lifting” sections.

Cardio (duration, distance, pace, calories, etc.) is **not** modeled; extending it requires new fields and/or parallel flows.

---

## Option A — Same session: section header (e.g. Cardio on top, then lifting)

**Goal:** One session, one completion flow; UI shows a **Cardio** block and a **Lifting** block (order configurable).

### Likely changes

1. **Tag slots as cardio** — e.g. `ProgramExercise.workoutSection` (`LIFTING` | `CARDIO`), or boolean `isCardio`, or `Exercise` kind / tags the program builder respects.
2. **Log cardio separately from `LoggedSet`** — avoid encoding duration/distance in `weight`/`reps`. Prefer e.g. **`LoggedCardioEntry`**: `workoutSessionId`, optional `programExerciseId`, `durationSec`, `distance`, `distanceUnit`, optional notes / HR / calories (scope v1 as needed).
3. **APIs** — session GET/PATCH and completion paths load/save cardio entries alongside lift sets.
4. **UI** — split ordered exercises by section; section headers (collapsible optional); cardio inputs (time/distance) instead of plate/RPE-only patterns; define “done” for progress/completion.
5. **Program builder / wizard** — allow cardio slots; prescriptions may be time- or distance-based, not 3×10 @ RPE.

### Effort

**Medium** — same navigation/history surface, but new schema, logging UI, and guards so strength code does not assume every row is a `LoggedSet`.

---

## Option B — Separate cardio workout

**Goal:** Cardio is a **first-class** workout type (e.g. “run day” without a barbell program day).

### Likely changes

1. **Session model** — e.g. **`WorkoutSession.sessionKind`** (`STRENGTH` | `CARDIO`) with rules for `programDayId`, **or** separate **`CardioSession`** linked to `User` (optional link to `ProgramInstance`).
2. **Templates** — simpler than full programs: named routines or free-form “add activity” per session.
3. **Routes / Train home** — entry points for strength vs cardio; resume lists may show both types.
4. **History** — today’s history likely assumes session → day → lifts; **union or tab** strength vs cardio.

### Effort

**Medium–high** — clearer separation, more routing, empty states, and history work than Option A.

---

## Recommendation (when building)

- **“One gym visit = cardio + lifts”** → favor **Option A** (sections in one session).
- **“Dedicated run/ride days off the lifting template”** → favor **Option B**, optionally later add A.

**Phasing:** Ship **standalone cardio (B)** with minimal fields first, then add **same-session sections (A)** once the cardio log shape is stable.

---

## Code areas to touch (when implementing)

| Area | Examples |
|------|----------|
| Schema | `prisma/schema.prisma` — section flag, `LoggedCardioEntry`, and/or `sessionKind` |
| APIs | `src/app/api/training/sessions/*`, `start-session`, history |
| Live workout | `src/components/training/workout-session-view.tsx`, possible new cardio components |
| Programs | `src/components/programs/program-builder-form.tsx`, `src/lib/program-wizard-types.ts`, program POST/PATCH |
| History / train overview | Any components assuming lift-only session payloads |

### Session cookies / HTTPS note

Production cardio features that use browser APIs (e.g. notifications) already require a **secure context** (HTTPS); unrelated to this plan but relevant for mobile/PWA-style usage.

---

## Open decisions (fill in when starting)

- [ ] Option A, B, or both (phased)?
- [ ] v1 log fields: time only vs time + distance vs more?
- [ ] Cardio exercises: reuse **`Exercise`** library with tags vs separate catalog?
- [ ] Prescription format for cardio slots in programs (minutes, km, zones, etc.)?
