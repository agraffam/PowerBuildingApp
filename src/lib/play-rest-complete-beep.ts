/**
 * Rest timer tones via Web Audio. Safari keeps AudioContext suspended until a user gesture;
 * call `unlockRestTimerAudio()` from pointer/touch handlers.
 */

let sharedCtx: AudioContext | null = null;

/** Peak gain for countdown beeps (much louder than early 0.18). */
const PEAK_GAIN = 0.58;

function getAudioContextClass(): (typeof AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function getOrCreateContext(): AudioContext | null {
  const Ctor = getAudioContextClass();
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function runWhenReady(ctx: AudioContext, play: () => void) {
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().then(play);
    } else {
      play();
    }
  } catch {
    // ignore
  }
}

/**
 * Run from a user gesture (tap/click). Unlocks playback for later timer-fired beeps.
 */
export function unlockRestTimerAudio() {
  const ctx = getOrCreateContext();
  if (!ctx) return;
  const run = () => {
    if (ctx.state === "closed") return;
    void ctx.resume().then(() => {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.02);
      } catch {
        // ignore
      }
    });
  };
  run();
}

/** Two sine partials for a fuller, louder ping (~200ms). */
export function playRestCountdownBeepShort() {
  const ctx = getOrCreateContext();
  if (!ctx || ctx.state === "closed") return;
  runWhenReady(ctx, () => {
    try {
      if (ctx.state === "suspended") return;
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + 0.03);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

      for (const freq of [880, 1320]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(master);
        o.start(t0);
        o.stop(t0 + 0.22);
      }
    } catch {
      // ignore
    }
  });
}

/**
 * Sustained tone for the final second (duration clamped ~0.08–1.05s).
 */
export function playRestCountdownBeepFinalSecond(durationSec: number) {
  const ctx = getOrCreateContext();
  if (!ctx || ctx.state === "closed") return;
  const d = Math.min(1.05, Math.max(0.08, durationSec));
  runWhenReady(ctx, () => {
    try {
      if (ctx.state === "suspended") return;
      const t0 = ctx.currentTime;
      const attack = 0.04;
      const release = 0.05;
      const holdEnd = t0 + d - release;
      const stopT = t0 + d;

      const master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + attack);
      if (holdEnd > t0 + attack + 0.01) {
        master.gain.setValueAtTime(PEAK_GAIN, holdEnd);
      }
      master.gain.exponentialRampToValueAtTime(0.0001, stopT);

      for (const freq of [880, 1320]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(master);
        o.start(t0);
        o.stop(stopT);
      }
    } catch {
      // ignore
    }
  });
}

/** @deprecated Prefer countdown beeps; kept for callers that expect a single loud ping. */
export function playRestCompleteBeep() {
  playRestCountdownBeepShort();
}
