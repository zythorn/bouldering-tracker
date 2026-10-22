import {
  BodyweightEntry,
  BoulderLog,
  ClimbingSession,
  GradeCount,
  Session,
  SessionType,
  Unit,
  WorkdaySession,
} from "../types";
import { daysBetween } from "./format";

/** The most recent bodyweight entry dated on or before `date`. */
export function bodyweightOnOrBefore(
  bodyweights: BodyweightEntry[],
  date: string,
): BodyweightEntry | undefined {
  return bodyweights
    .filter((b) => b.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Load as %bodyweight given a bodyweight and signed added weight. */
export function loadPercentBW(bodyweight: number, addedWeight: number): number {
  if (!bodyweight) return 0;
  return ((bodyweight + addedWeight) / bodyweight) * 100;
}

export function isWorkday(s: Session): s is WorkdaySession {
  return s.kind === "workday";
}

export function isClimbing(s: Session): s is ClimbingSession {
  return s.kind !== "strength";
}

/** Grade counts of a session (core/hip sessions have none). */
export function sessionGrades(s: Session): GradeCount[] {
  return isClimbing(s) ? (s.grades ?? []) : [];
}

/** Detailed boulders of a session (core/hip sessions have none). */
export function sessionBoulders(s: Session): BoulderLog[] {
  return isClimbing(s) ? (s.boulders ?? []) : [];
}

/**
 * A work-day is compressed-rest when the previous work-day session was at
 * most this many calendar days earlier (e.g. Mon → Wed). Weekend and core/hip
 * sessions don't count as "previous".
 */
export const COMPRESSED_MAX_GAP_DAYS = 2;

export interface DerivedSessionType {
  type: SessionType;
  prevDate?: string; // previous work-day session, if any
  gapDays?: number;
}

/** Normal vs compressed-rest for a work-day on `date`, from the dates alone. */
export function deriveSessionType(
  date: string,
  sessions: Session[],
  excludeId?: string,
): DerivedSessionType {
  const prev = sessions
    .filter((s) => isWorkday(s) && s.id !== excludeId && s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prev) return { type: "normal" };
  const gapDays = daysBetween(prev.date, date);
  return {
    type: gapDays <= COMPRESSED_MAX_GAP_DAYS ? "compressed-rest" : "normal",
    prevDate: prev.date,
    gapDays,
  };
}

/**
 * Effective type of every work-day session, keyed by id: the user's override
 * if set, otherwise derived from dates. The legacy stored `sessionType` tag is
 * deliberately ignored (older data tagged it inconsistently).
 */
export function sessionTypes(sessions: Session[]): Map<string, SessionType> {
  const types = new Map<string, SessionType>();
  for (const s of sessions) {
    if (!isWorkday(s)) continue;
    types.set(
      s.id,
      s.sessionTypeOverride ?? deriveSessionType(s.date, sessions).type,
    );
  }
  return types;
}

/** Workday sessions that recorded a main hang, newest first. */
export function mainHangSessions(sessions: Session[]): WorkdaySession[] {
  return sessions
    .filter(isWorkday)
    .filter((s): s is WorkdaySession => !!s.mainHang)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface ProgressionStatus {
  ready: boolean;
  streak: number;
  edgeMm: number;
  addedWeight: number;
}

/**
 * Progression rule from the training plan: if the last N main-hang entries at
 * the *same edge and weight* were all completed cleanly (every intended set),
 * suggest progressing. Compressed-rest sessions are skipped entirely — they
 * neither extend nor break the streak.
 */
export function progressionStatus(
  sessions: Session[],
  n = 3,
): ProgressionStatus | null {
  const types = sessionTypes(sessions);
  const relevant = mainHangSessions(sessions).filter(
    (s) => types.get(s.id) !== "compressed-rest",
  );
  if (relevant.length === 0) return null;

  const { edgeMm, addedWeight } = relevant[0].mainHang!;

  let streak = 0;
  for (const s of relevant) {
    const mh = s.mainHang!;
    const sameSetting = mh.edgeMm === edgeMm && mh.addedWeight === addedWeight;
    const clean =
      mh.setsIntended > 0 && mh.setsCompleted >= mh.setsIntended;
    if (sameSetting && clean) streak += 1;
    else break;
  }

  return { ready: streak >= n, streak, edgeMm, addedWeight };
}

/** Remind to weigh in when the latest entry is at least this old. */
export const WEIGH_IN_EVERY_DAYS = 7;

/** Days since the latest bodyweight entry (undefined if there are none). */
export function daysSinceWeighIn(
  bodyweights: BodyweightEntry[],
  today: string,
): number | undefined {
  const latest = bodyweights.reduce<string | undefined>(
    (max, b) => (!max || b.date > max ? b.date : max),
    undefined,
  );
  return latest ? daysBetween(latest, today) : undefined;
}

export interface BodyweightShift {
  change: number; // current minus at the last hang session, in the user's unit
  lastHangDate: string;
}

/**
 * Bodyweight change since the most recent hang session before `date`, when it
 * exceeds ~2 kg (4.4 lb): %BW loads then need recalculating.
 */
export function bodyweightShiftSinceLastHang(
  sessions: Session[],
  bodyweights: BodyweightEntry[],
  date: string,
  unit: Unit,
  excludeId?: string,
): BodyweightShift | undefined {
  const lastHang = mainHangSessions(sessions).find(
    (s) => s.id !== excludeId && s.date <= date,
  );
  if (!lastHang) return undefined;
  const then = bodyweightOnOrBefore(bodyweights, lastHang.date);
  const now = bodyweightOnOrBefore(bodyweights, date);
  if (!then || !now) return undefined;
  const change = now.weight - then.weight;
  const threshold = unit === "kg" ? 2 : 4.4;
  return Math.abs(change) > threshold
    ? { change, lastHangDate: lastHang.date }
    : undefined;
}

/** Sum of boulders logged across all grades for a workday session. */
export function totalBoulders(s: WorkdaySession): number {
  return s.grades.reduce((sum, g) => sum + (g.count || 0), 0);
}
