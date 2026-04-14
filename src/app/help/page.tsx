"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sections: { title: string; body: ReactNode }[] = [
  {
    title: "How do I start a workout?",
    body: (
      <p>
        Go to <strong>Programs</strong> to choose your routine, then open <strong>Train</strong> to start today&apos;s
        workout. Mark sets as <strong>Done</strong> as you complete them.
      </p>
    ),
  },
  {
    title: "What does the workout screen show?",
    body: (
      <>
        <p>
          Each exercise shows your target reps and effort level (RPE). Use <strong>More</strong> for actions like
          swapping an exercise or switching between bodyweight and loaded mode.
        </p>
        <p>
          The top line (next to week/intensity) shows your current phase, like <strong>Hypertrophy</strong> or{" "}
          <strong>Strength</strong>.
        </p>
      </>
    ),
  },
  {
    title: "How do I log or edit a set?",
    body: (
      <>
        <p>
          For an unfinished set, tap <strong>Done</strong> to log it. For a completed set that you edit later, tap{" "}
          <strong>Save</strong> to update it.
        </p>
        <p>
          If you change weight on a set, the app can carry that load to remaining unfinished sets for that exercise so
          you don&apos;t have to type it repeatedly.
        </p>
      </>
    ),
  },
  {
    title: "How are weights suggested?",
    body: (
      <>
        <p>
          RPE is your effort level. The app uses your targets plus your training history to suggest helpful loads, but
          you&apos;re always in control and can adjust based on how you feel.
        </p>
        <p>
          Your <strong>1RM</strong> entries are used to improve percentage-based suggestions. Update these on the{" "}
          <strong>1RM</strong> page when needed.
        </p>
      </>
    ),
  },
  {
    title: "Why do I enter sleep, stress, and soreness?",
    body: (
      <p>
        Before some workouts, you&apos;ll log sleep, stress, and soreness. This helps the app gently adjust that
        day&apos;s recommendations.
      </p>
    ),
  },
  {
    title: "How does the rest timer work?",
    body: (
      <p>
        Rest is automatic after sets. You can customize rest-by-RPE in <strong>Settings</strong>. If your program has
        fixed rest for an exercise, that fixed value takes priority.
      </p>
    ),
  },
  {
    title: "How do supersets work?",
    body: (
      <p>
        Supersets are grouped in rounds (for example A1 then A2). Complete all exercises in the round, then rest.
      </p>
    ),
  },
  {
    title: "Where can I review past workouts?",
    body: (
      <p>
        Open <strong>History</strong> to review past workouts. You can update completed set values and save them if you
        need to correct a log.
      </p>
    ),
  },
  {
    title: "Where are app options and account settings?",
    body: (
      <p>
        Use <strong>Settings</strong> for theme, units, rest preferences, and keep-awake behavior during workouts. Use{" "}
        <strong>Account</strong> for profile details.
      </p>
    ),
  },
  {
    title: "Quick tips",
    body: (
      <>
        <p>
          Keep logging simple: hit targets, mark done, and move on. Perfect data is less important than consistent
          training.
        </p>
        <p>If a recommendation feels too heavy or too light, adjust it. The app learns from your logs over time.</p>
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="page-stack mx-auto max-w-2xl pb-2">
      <PageHeader
        title="Help & FAQ"
        description="Quick answers for common workout app questions."
        backLink={{ href: "/settings", label: "← Back to Settings" }}
      />

      <div className="space-y-4">
        {sections.map((s) => (
          <section
            key={s.title}
            className="rounded-2xl border bg-card/40 px-4 py-4 shadow-sm ring-1 ring-foreground/5 sm:px-5 sm:py-5"
          >
            <h2 className="text-base font-semibold font-heading leading-snug sm:text-lg">{s.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <Link
        href="/settings"
        className={cn(buttonVariants({ variant: "outline" }), "inline-flex h-11 w-full items-center justify-center rounded-xl sm:h-10 sm:w-auto")}
      >
        Back to Settings
      </Link>
    </div>
  );
}
