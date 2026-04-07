"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Help & FAQ</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Quick answers for common workout app questions.
        </p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">How do I start a workout?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Go to <strong>Programs</strong> to choose your routine, then open <strong>Train</strong> to start today&apos;s
          workout. Mark sets as <strong>Done</strong> as you complete them.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">What does the workout screen show?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each exercise shows your target reps and effort level (RPE). Use <strong>More</strong> for actions like
          swapping an exercise or switching between bodyweight and loaded mode.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The top line (next to week/intensity) shows your current phase, like <strong>Hypertrophy</strong> or{" "}
          <strong>Strength</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">How do I log or edit a set?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For an unfinished set, tap <strong>Done</strong> to log it. For a completed set that you edit later, tap{" "}
          <strong>Save</strong> to update it.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you change weight on a set, the app can carry that load to remaining unfinished sets for that
          exercise so you don&apos;t have to type it repeatedly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">How are weights suggested?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          RPE is your effort level. The app uses your targets plus your training history to suggest helpful
          loads, but you&apos;re always in control and can adjust based on how you feel.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your <strong>1RM</strong> entries are used to improve percentage-based suggestions. Update these on the{" "}
          <strong>1RM</strong> page when needed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Why do I enter sleep, stress, and soreness?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before some workouts, you&apos;ll log sleep, stress, and soreness. This helps the app gently adjust
          that day&apos;s recommendations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">How does the rest timer work?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Rest is automatic after sets. You can customize rest-by-RPE in <strong>Settings</strong>. If your
          program has fixed rest for an exercise, that fixed value takes priority.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">How do supersets work?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Supersets are grouped in rounds (for example A1 then A2). Complete all exercises in the round, then
          rest.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Where can I review past workouts?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Open <strong>History</strong> to review past workouts. You can update completed set values and save them
          if you need to correct a log.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Where are app options and account settings?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Use <strong>Settings</strong> for theme, units, rest preferences, and keep-awake behavior during workouts.
          Use <strong>Account</strong> for profile details.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Quick tips</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Keep logging simple: hit targets, mark done, and move on. Perfect data is less important than
          consistent training.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If a recommendation feels too heavy or too light, adjust it. The app learns from your logs over
          time.
        </p>
      </section>

      <Link href="/settings" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl inline-flex")}>
        Back to Settings
      </Link>
    </div>
  );
}
