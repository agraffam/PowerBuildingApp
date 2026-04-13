/** Display seconds as `m:ss` (e.g. 5:00, 0:45). */
export function formatSecAsMmSs(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Parse `m:ss` or plain integer seconds. */
export function parseDurationInputToSec(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) {
    const min = parseInt(m[1]!, 10);
    const sec = parseInt(m[2]!, 10);
    if (sec >= 60 || min > 999) return null;
    return Math.min(86400, Math.max(0, min * 60 + sec));
  }
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(86400, n);
}
