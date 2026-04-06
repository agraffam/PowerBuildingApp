"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">How progression works</h1>
        <p className="text-muted-foreground text-sm mt-2">
          This page matches how the app actually calculates loads and bumps. Numbers come from{" "}
          <code className="text-xs bg-muted px-1 rounded">src/lib/calculators.ts</code>, session
          prefill in <code className="text-xs bg-muted px-1 rounded">src/lib/prefill-session-weights.ts</code>
          , and block-aware targets in{" "}
          <code className="text-xs bg-muted px-1 rounded">src/lib/block-prescription.ts</code>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Mesocycles: hypertrophy, strength, peaking</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Programs can divide your run into <strong>blocks</strong> (week ranges) labeled Hypertrophy,
          Strength, or Peaking. The active block depends on which week of the program you are in (week 1 is
          the first training week of that run). In a workout, small badges on each lift show the current
          phase and whether that calendar week is a deload (see below).
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When <strong>Auto block prescriptions</strong> is on for the program, the app derives the
          targets you see for each session—reps, RPE, %1RM (when used), sets, and cardio time or
          calories—from your <em>template</em> slot plus the active block. Hypertrophy weeks use the
          template essentially as written (for strength movements). Strength weeks shift prescriptions
          toward heavier, lower-rep work on main lifts: fewer reps, slightly higher target RPE, and higher
          %1RM when the slot has a percentage; accessories and higher-rep isolation work are nudged
          toward moderate strength-style reps without turning everything into singles. Peaking weeks push
          compounds further toward very low reps and higher RPE, while trimming set counts a bit on some
          movements so total volume eases as intensity rises.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The app classifies each strength slot as compound, accessory, or isolation from your rep targets
          (and very low reps lean compound, very high reps lean isolation), or from an explicit{" "}
          <strong>load role</strong> on the exercise when set in data. Cardio movements use duration and
          calories; block phase does not rewrite them except on deload weeks.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Turn <strong>Auto block prescriptions</strong> off in the program builder if you want every
          week to use exactly the reps, RPE, %1RM, and sets stored in the template with no mesocycle
          math. Deload scheduling (below) can still apply when enabled separately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Deload weeks</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can set a <strong>deload interval</strong> (every 4–6 weeks, or off). On those calendar
          weeks the app backs off training stress: fewer working sets, easier target RPE, lower prescribed
          %1RM, and a few more reps at the lighter target for strength work (submax “groove” work). Cardio
          bouts, duration targets, and calorie targets are reduced slightly. Progressive-overload bumps from
          history are not applied on deload weeks. If deload is off, only the mesocycle block adjusts
          targets (when auto prescriptions are on).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">RPE and % of 1RM</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When a program slot has a target rep count and RPE, the app maps that pair to an approximate
          percentage of one-rep max using an RTS-style rep × RPE table (interpolated between published
          chart values). That percentage is combined with your saved estimated 1RM for the lift to suggest
          working weight, rounded to your plate / bar step.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Readiness and intensity</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before an in-progress session you can log sleep, stress, and soreness. Those sliders are turned
          into a single intensity multiplier (roughly 0.85–1.05) that scales %1RM-based suggestions for
          that session only.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">History-based prefill</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          After %1RM prefill, empty sets may be filled from your last completed session for that same
          program slot. Weights are scaled if today&apos;s intensity multiplier differs from that
          session&apos;s. Then the app may suggest a small increase for the next time you train that slot.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Progressive overload rule</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For the next session&apos;s suggestion, if you hit at least the rep target and either logged no
          RPE or your RPE was within about half a point of the prescribed target, the app applies roughly
          a 3.75% bump, rounded to your smallest practical increment (bar + user plate settings). Otherwise
          it holds the weight so you can own the reps first.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Supersets</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          In the program builder, give consecutive exercises the same superset letter (A, B, …) with the
          same set count. In a workout, rounds are interleaved (all exercises for round 1, then round 2,
          …). The rest timer starts after every exercise in that round is marked done. If any lift in the
          group has a prescribed rest (seconds in the program), the timer uses the longest of those. If
          none do, it uses your per-RPE rest map from Settings (logged RPE, or target RPE if you did not log
          one), with your default rest as a fallback.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Rest timer by RPE</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Under Settings you can set rest duration for each RPE step from 6 to 10 (half-point steps), choosing
          from 30–210 seconds in 30-second steps. Built-in defaults group easy work shorter and harder work
          longer (roughly 6–6.5 → 60s, 7–7.5 → 120s, 8+ → 180s). Reset clears your overrides only.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Completing a workout</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When you finish a session, a summary shows duration (from your first readiness submit through
          completion), total volume, volume per exercise, readiness and intensity, any estimated-1RM PRs,
          and your lifetime completed-workout count. You can save suggested 1RMs to your strength profiles
          (same RPE chart as %1RM) or skip; either way you can open History later to review the workout.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Reorder during a workout</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can drag blocks (solo exercises or superset groups) to change order for the current session
          only. That does not edit the underlying program template.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Collapse exercises</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Use the chevron on each block to hide set rows and shrink the list. The drag handle and header
          (including swap and history on solo lifts) stay visible so you can reorder without expanding.
        </p>
      </section>

      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl inline-flex")}>
        Back to Train
      </Link>
    </div>
  );
}
