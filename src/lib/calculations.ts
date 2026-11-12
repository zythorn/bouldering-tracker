import {
  BodyweightEntry,
  BoulderLog,
  GradeCount,
  HangBlock,
  Session,
  SessionType,
  Unit,
} from "../types";
import { getBlock } from "./blocks";
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

/** Grade counts of a session's bouldering block (none without one). */
export function sessionGrades(s: Session): GradeCount[] {
  return getBlock(s, "bouldering")?.grades ?? [];
}

/** Detailed boulders of a session's bouldering block (none without one). */
export function sessionBoulders(s: Session): BoulderLog[] {
  return getBlock(s, "bouldering")?.boulders ?? [];
}

/** A session together with its hangs block. */
export interface HangSession {
  session: Session;
  hang: HangBlock;
}

/** Sessions with a hangs block, newest first. */
export function hangSessions(sessions: Session[]): HangSession[] {
  const out: HangSession[] = [];
  for (const session of sessions) {
    const hang = getBlock(session, "hangs");
    if (hang) out.push({ session, hang });
  }
  return out.sort((a, b) => b.session.date.localeCompare(a.session.date));
}

/**
 * A hang session is compressed-rest when the previous session with hangs was
 * at most this many calendar days earlier (e.g. Mon → Wed). Sessions without
 * a hangs block don't count as "previous".
 */
export const COMPRESSED_MAX_GAP_DAYS = 2;

export interface DerivedSessionType {
  type: SessionType;
  prevDate?: string; // previous session with hangs, if any
  gapDays?: number;
}

/** Normal vs compressed-rest for hangs on `date`, from the dates alone. */
export function deriveSessionType(
  date: string,
  sessions: Session[],
  excludeId?: string,
): DerivedSessionType {
  const prev = hangSessions(sessions)
    .map((h) => h.session)
    .find((s) => s.id !== excludeId && s.date < date);
  if (!prev) return { type: "normal" };
  const gapDays = daysBetween(prev.date, date);
  return {
    type: gapDays <= COMPRESSED_MAX_GAP_DAYS ? "compressed-rest" : "normal",
    prevDate: prev.date,
    gapDays,
  };
}

/**
 * Effective type of every session with hangs, keyed by session id: the
 * user's override if set, otherwise derived from dates.
 */
export function sessionTypes(sessions: Session[]): Map<string, SessionType> {
  const types = new Map<string, SessionType>();
  for (const { session, hang } of hangSessions(sessions)) {
    types.set(
      session.id,
      hang.typeOverride ?? deriveSessionType(session.date, sessions).type,
    );
  }
  return types;
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
  const relevant = hangSessions(sessions).filter(
    (h) => types.get(h.session.id) !== "compressed-rest",
  );
  if (relevant.length === 0) return null;

  const { edgeMm, addedWeight } = relevant[0].hang;

  let streak = 0;
  for (const { hang: mh } of relevant) {
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
  const lastHang = hangSessions(sessions)
    .map((h) => h.session)
    .find((s) => s.id !== excludeId && s.date <= date);
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
