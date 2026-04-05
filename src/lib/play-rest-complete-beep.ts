/**
 * Rest-complete tone via Web Audio. Safari (macOS + iOS) keeps AudioContext
 * suspended until a user gesture; call `unlockRestTimerAudio()` from pointer/touch
 * handlers (we register listeners from the rest timer UI).
 */

let sharedCtx: AudioContext | null = null;

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
        // iOS Safari often needs a real output during the unlock gesture.
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

export function playRestCompleteBeep() {
  const ctx = getOrCreateContext();
  if (!ctx || ctx.state === "closed") return;
  const play = () => {
    try {
      if (ctx.state === "suspended") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      const t0 = ctx.currentTime;
      osc.start(t0);
      osc.stop(t0 + 0.22);
    } catch {
      // ignore
    }
  };

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
