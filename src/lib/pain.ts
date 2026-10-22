// Pain check: the app only records scores and points back to the user's own
// stop rules from the training plan. It never interprets them.
import { PainScores, Session } from "../types";

export const PAIN_AREAS: { key: keyof PainScores; label: string }[] = [
  { key: "elbow", label: "Elbow" },
  { key: "wrist", label: "Wrist" },
  { key: "back", label: "Lower back" },
];

/** Scores at or above this are the plan's stop threshold. */
export const PAIN_STOP = 2;

export const PAIN_SCALE =
  "0 nothing · 1 faint awareness · 2 clear discomfort (stop threshold) · " +
  "3–5 worsening, up to sharp or limiting";

/** True when at least one area was scored (0 counts as recorded). */
export function hasPainCheck(p?: PainScores): boolean {
  return !!p && PAIN_AREAS.some((a) => p[a.key] != null);
}

/** Drop unscored areas; undefined when nothing was scored. */
export function cleanPain(p: PainScores): PainScores | undefined {
  const out: PainScores = {};
  for (const a of PAIN_AREAS) if (p[a.key] != null) out[a.key] = p[a.key];
  return hasPainCheck(out) ? out : undefined;
}

/** Areas at or above the stop threshold, e.g. [{label: "Lower back", score: 2}]. */
export function painAlerts(p?: PainScores): { label: string; score: number }[] {
  if (!p) return [];
  return PAIN_AREAS.filter((a) => (p[a.key] ?? 0) >= PAIN_STOP).map((a) => ({
    label: a.label,
    score: p[a.key]!,
  }));
}

/** "elbow 1 · lower back 2" (recorded areas only). */
export function describePain(p: PainScores): string {
  return PAIN_AREAS.filter((a) => p[a.key] != null)
    .map((a) => `${a.label.toLowerCase()} ${p[a.key]}`)
    .join(" · ");
}

/**
 * The most recent session that recorded a pain check. Sessions logged without
 * one are skipped, so the banner keeps pointing at the last real check.
 */
export function lastPainCheck(sessions: Session[]): Session | undefined {
  return sessions
    .filter((s) => hasPainCheck(s.pain))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
