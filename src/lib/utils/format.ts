export function money(n: number | null | undefined, opts: { showFree?: boolean } = {}): string {
  if (n === null || n === undefined) return "—";
  if (n === 0 && opts.showFree) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function weight(lbs: number | null | undefined): string {
  if (lbs === null || lbs === undefined) return "";
  return `${lbs.toFixed(lbs < 10 ? 1 : 0)} lb`;
}

/**
 * Title-case a buyer/account name typed in any casing so the buyer-facing
 * UI doesn't render "test Brent" or "test Store" when the underlying row
 * happens to be lowercased. Only touches the FIRST letter of each
 * whitespace-separated word — preserves intra-word caps (McDonald's,
 * 5-Acre, etc.) and leaves empty / null safely as-is.
 */
export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/(^|\s)(\S)/g, (_, lead, ch) => lead + ch.toUpperCase());
}

// "YYYY-MM-DD" is parsed by `new Date(...)` as UTC midnight, which renders
// as the previous day in any negative-offset timezone (EST/EDT for FLF).
// Treat date-only strings as local calendar dates so a delivery dated
// 2026-05-15 shows as May 15 in upstate NY, not May 14.
function parseLocal(d: string | Date): Date {
  if (typeof d !== "string") return d;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(d);
  if (dateOnly) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

export function dateShort(d: string | Date | null | undefined): string {
  if (!d) return "";
  return parseLocal(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateLong(d: string | Date | null | undefined): string {
  if (!d) return "";
  return parseLocal(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dateShort(date);
}

/** Format a countdown like "17h 23m" or "42m". */
export function countdown(ms: number): string {
  if (ms <= 0) return "past";
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}
