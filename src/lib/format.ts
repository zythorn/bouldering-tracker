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
