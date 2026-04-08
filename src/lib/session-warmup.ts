/**
 * Pre-workout warmup copy keyed off the first exercise of the session (~5–8 min:
 * temperature + pattern prep + barbell ramp reminder). Coaching-style guidance only.
 */

export type WarmupFocus = "squat" | "bench" | "deadlift" | "general";

export type WarmupSection = {
  heading: string;
  minutesHint: string;
  bullets: string[];
};

export type WarmupContent = {
  focus: WarmupFocus;
  title: string;
  subtitle: string;
  accentExerciseName: string;
  sections: WarmupSection[];
  atTheBar: string[];
};

const SQUAT_SLUGS = new Set<string>([
  "squat",
  "front-squat",
  "low-bar-squat",
  "pause-squat",
  "hack-squat",
  "goblet-squat",
  "bulgarian-split-squat",
  "smith-squat",
  "walking-lunge",
  "step-up",
]);

const BENCH_SLUGS = new Set<string>([
  "bench-press",
  "close-grip-bench",
  "dumbbell-bench-press",
  "incline-barbell-bench",
  "incline-dumbbell-press",
  "pin-press",
  "machine-chest-press",
  "pec-deck",
  "cable-fly",
  "chest-dip",
  "landmine-press",
]);

const DEADLIFT_SLUGS = new Set<string>([
  "deadlift",
  "sumo-deadlift",
  "romanian-deadlift",
  "deficit-deadlift",
  "rack-pull",
]);

export function sessionWarmupStorageKey(sessionId: string): string {
  return `pbSessionWarmupDone:${sessionId}`;
}

export function resolveWarmupFocus(slug: string): WarmupFocus {
  const s = slug.trim().toLowerCase();
  if (SQUAT_SLUGS.has(s)) return "squat";
  if (BENCH_SLUGS.has(s)) return "bench";
  if (DEADLIFT_SLUGS.has(s)) return "deadlift";
  return "general";
}

export function getWarmupContent(focus: WarmupFocus, firstExerciseName: string): WarmupContent {
  const name = firstExerciseName.trim() || "First lift";

  const barbellRamp = [
    "Empty bar: 2 × 5–10 smooth reps.",
    "Then ramp toward your first working weight: roughly 40–50% × 5, 60–70% × 3, ~80% × 2 (add steps if jumps feel big).",
    "Rest ~30–45s on light sets; take ~2 min before heavier singles near working weight. Stop before you are fatigued.",
  ];

  if (focus === "squat") {
    return {
      focus,
      title: "Warm-up for squat day",
      subtitle: `Pattern prep for ${name} — about 5–8 minutes before your first heavy sets.`,
      accentExerciseName: name,
      sections: [
        {
          heading: "Get warm",
          minutesHint: "~2 min",
          bullets: [
            "Easy movement until you feel a bit warmer: brisk walk, easy bike, or light calisthenics.",
          ],
        },
        {
          heading: "Squat pattern prep",
          minutesHint: "~2–3 min",
          bullets: [
            "Bodyweight squats 10–15, controlled depth.",
            "Leg swings 10 per leg (front-to-back, then side-to-side).",
            "Optional: light hip hinge / good morning motion 8–10 reps to wake the posterior chain.",
          ],
        },
      ],
      atTheBar: [`At the rack for ${name}:`, ...barbellRamp],
    };
  }

  if (focus === "bench") {
    return {
      focus,
      title: "Warm-up for bench day",
      subtitle: `Shoulder and press pattern prep for ${name} — about 5–8 minutes.`,
      accentExerciseName: name,
      sections: [
        {
          heading: "Get warm",
          minutesHint: "~2 min",
          bullets: ["Light movement: easy rower/bike or arm circles and easy push movement until you feel warm."],
        },
        {
          heading: "Press pattern prep",
          minutesHint: "~2–3 min",
          bullets: [
            "Shoulder circles 10 each direction.",
            "Upper-back activation: band pull-aparts or wall slides (15–20 quality reps), or scap push-ups.",
            "Push-ups 5–10 with full range, shoulders packed.",
          ],
        },
      ],
      atTheBar: [`On the bench for ${name}:`, ...barbellRamp],
    };
  }

  if (focus === "deadlift") {
    return {
      focus,
      title: "Warm-up for deadlift day",
      subtitle: `Hinge and hinge pattern prep for ${name} — about 5–8 minutes.`,
      accentExerciseName: name,
      sections: [
        {
          heading: "Get warm",
          minutesHint: "~2 min",
          bullets: ["Light cardio or brisk movement until you feel warmer through hips and back."],
        },
        {
          heading: "Hinge prep",
          minutesHint: "~2–3 min",
          bullets: [
            "Bodyweight hip hinges 10–12 (push hips back, soft knees, long spine).",
            "Leg swings 10 per leg.",
            "Cat-cow or gentle thoracic mobility 8–10 slow reps.",
            "Optional: glute bridge 10–12 to feel glutes on.",
          ],
        },
      ],
      atTheBar: [`At the bar for ${name}:`, ...barbellRamp],
    };
  }

  return {
    focus: "general",
    title: "Warm-up before lifting",
    subtitle: `General prep before ${name} — about 5–8 minutes.`,
    accentExerciseName: name,
    sections: [
      {
        heading: "Get warm",
        minutesHint: "~2 min",
        bullets: ["Easy march, bike, or rope skip until you feel lightly warm—not winded."],
      },
      {
        heading: "Full-body primer",
        minutesHint: "~3–4 min",
        bullets: [
          "Bodyweight squats 10–15.",
          "Hip hinges 10–12.",
          "Push-ups or inchworms 5–10.",
          "Upper-back: band pull-aparts, light rows, or wall slides 15–20 reps.",
        ],
      },
    ],
    atTheBar: firstExerciseName.trim()
      ? [`Before ${name}, use empty-bar reps of the same pattern, then ramp:`, ...barbellRamp]
      : ["Use empty-bar reps of your first lift, then ramp:", ...barbellRamp],
  };
}
