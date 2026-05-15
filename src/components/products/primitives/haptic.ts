/**
 * Best-effort haptic tick. Silent no-op on iOS Safari (which doesn't
 * implement navigator.vibrate) and on desktop. Duplicated across three
 * product files before — single source of truth here.
 */
export function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
