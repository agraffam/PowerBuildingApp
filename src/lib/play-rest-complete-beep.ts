/** Short beep when rest countdown completes (best-effort; may be blocked until user gesture). */
export function playRestCompleteBeep() {
  try {
    const Ctx = typeof window !== "undefined" ? window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.12;
    const t0 = ctx.currentTime;
    osc.start(t0);
    osc.stop(t0 + 0.12);
    setTimeout(() => {
      void ctx.close();
    }, 200);
  } catch {
    // ignore
  }
}
