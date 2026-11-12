// Boulder stats and session-RPE series for the Trends tab.
import { BoulderLog, BoulderTag, Session, TrackedProject } from "../types";
import { isClimbing, sessionBoulders } from "./calculations";
import { isSend, logAttempts } from "./boulders";
import { round, weekStart } from "./format";

/**
 * One boulder for stats purposes. A detailed log is one boulder, except that
 * every log of a tracked project is merged into a single boulder: otherwise a
 * project sent on its third session would look like a 2-attempt send.
 */
export interface BoulderUnit {
  grade: string;
  sent: boolean;
  flashed: boolean;
  attempts?: number; // to send (or so far, if unsent); undefined if not recorded
  tags: BoulderTag[];
}

/**
 * Boulders logged in detail, optionally only those decided on/after `from`
 * (a project counts by its send date, or its latest session if unsent, but
 * always with all its attempts). Boulders without a grade are skipped.
 */
export function collectBoulders(
  sessions: Session[],
  projects: TrackedProject[],
  from?: string,
): BoulderUnit[] {
  const units: BoulderUnit[] = [];
  const projectLogs = new Map<string, { date: string; log: BoulderLog }[]>();

  for (const s of sessions) {
    for (const log of sessionBoulders(s)) {
      if (log.projectId && projects.some((p) => p.id === log.projectId)) {
        const list = projectLogs.get(log.projectId) ?? [];
        list.push({ date: s.date, log });
        projectLogs.set(log.projectId, list);
      } else if (log.grade && (!from || s.date >= from)) {
        units.push({
          grade: log.grade,
          sent: isSend(log),
          flashed: log.outcome === "flash",
          attempts: logAttempts(log),
          tags: log.tags,
        });
      }
    }
  }

  for (const [id, entries] of projectLogs) {
    const project = projects.find((p) => p.id === id)!;
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const sendIdx = entries.findIndex((e) => isSend(e.log));
    // Attempts count up to and including the send; repeats afterwards don't.
    const counted = sendIdx >= 0 ? entries.slice(0, sendIdx + 1) : entries;
    if (from && counted[counted.length - 1].date < from) continue;

    const grade =
      project.grade ??
      [...entries].reverse().find((e) => e.log.grade)?.log.grade;
    if (!grade) continue;

    let attempts = 0;
    let known = true;
    for (const e of counted) {
      const n = logAttempts(e.log);
      if (n == null) known = false;
      else attempts += n;
    }
    units.push({
      grade,
      sent: sendIdx >= 0,
      flashed: sendIdx === 0 && entries[0].log.outcome === "flash",
      attempts: known ? attempts : undefined,
      tags: project.tags.length
        ? project.tags
        : [...new Set(entries.flatMap((e) => e.log.tags))],
    });
  }
  return units;
}

export interface Summary {
  boulders: number;
  sent: number;
  flashed: number;
  attempts: number[]; // attempts-to-send of sent boulders with a known count
}

export function summarize(units: BoulderUnit[]): Summary {
  const sent = units.filter((u) => u.sent);
  return {
    boulders: units.length,
    sent: sent.length,
    flashed: units.filter((u) => u.flashed).length,
    attempts: sent
      .map((u) => u.attempts)
      .filter((n): n is number => n != null),
  };
}

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
}

/** Per-grade summaries, hardest grade first (by the user's grade list). */
export function gradeSummaries(
  units: BoulderUnit[],
  gradeOrder: string[],
): { grade: string; summary: Summary }[] {
  const rank = (g: string) => {
    const i = gradeOrder.indexOf(g);
    return i < 0 ? -1 : i;
  };
  return [...new Set(units.map((u) => u.grade))]
    .sort((a, b) => rank(b) - rank(a) || a.localeCompare(b))
    .map((grade) => ({
      grade,
      summary: summarize(units.filter((u) => u.grade === grade)),
    }));
}

/** Tags with too few boulders to say much; shown greyed out. */
export const MIN_TAG_SAMPLE = 3;

/**
 * Per-tag summaries at one grade, weakest first: lowest send rate, then the
 * most attempts to send. A boulder with several tags counts under each.
 */
export function tagSummaries(
  units: BoulderUnit[],
  grade: string,
): { tag: BoulderTag; summary: Summary }[] {
  const atGrade = units.filter((u) => u.grade === grade);
  const tags = [...new Set(atGrade.flatMap((u) => u.tags))];
  return tags
    .map((tag) => ({
      tag,
      summary: summarize(atGrade.filter((u) => u.tags.includes(tag))),
    }))
    .sort(
      (a, b) =>
        a.summary.sent / a.summary.boulders -
          b.summary.sent / b.summary.boulders ||
        (median(b.summary.attempts) ?? 0) - (median(a.summary.attempts) ?? 0),
    );
}

export interface RpeRow {
  ts: number;
  rpe?: number; // one session
  avg?: number; // weekly (Mon–Sun) average
  week?: string; // Monday of that week, for the tooltip
}

const tsOf = (iso: string) => new Date(iso + "T00:00:00Z").getTime();

/**
 * Session RPE points plus one weekly-average point per Mon–Sun week, placed at
 * the middle of that week's sessions so it never lands in the future.
 */
export function rpeRows(sessions: Session[], from?: string): RpeRow[] {
  const rated = sessions
    .filter(isClimbing)
    .filter((s) => s.rpe != null && (!from || s.date >= from));
  const rows: RpeRow[] = rated.map((s) => ({ ts: tsOf(s.date), rpe: s.rpe }));

  const weeks = new Map<string, { ts: number[]; rpe: number[] }>();
  for (const s of rated) {
    const w = weeks.get(weekStart(s.date)) ?? { ts: [], rpe: [] };
    w.ts.push(tsOf(s.date));
    w.rpe.push(s.rpe!);
    weeks.set(weekStart(s.date), w);
  }
  for (const [week, w] of weeks) {
    rows.push({ ts: mean(w.ts)!, avg: round(mean(w.rpe)!, 1), week });
  }
  return rows.sort((a, b) => a.ts - b.ts);
}
