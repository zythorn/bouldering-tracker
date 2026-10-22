export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Format a signed added-weight value with an explicit +/- sign. */
export function signed(n: number, unit: string): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${round(n)} ${unit}`;
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function pct(n: number): string {
  return `${round(n)}%`;
}

// Calendar arithmetic on ISO dates. Done in UTC so DST shifts can't turn a
// one-day gap into 0.96 or 1.04 days.
const utc = (iso: string) => new Date(iso + "T00:00:00Z");

/** Whole calendar days from `fromISO` to `toISO` (negative if earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((utc(toISO).getTime() - utc(fromISO).getTime()) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the (Mon–Sun) week containing `iso`. */
export function weekStart(iso: string): string {
  const weekday = (utc(iso).getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  return addDays(iso, -weekday);
}
