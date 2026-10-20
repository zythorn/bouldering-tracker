import {
  BodyweightEntry,
  Session,
  WorkdaySession,
} from "../types";

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
  const relevant = mainHangSessions(sessions).filter(
    (s) => s.sessionType !== "compressed-rest",
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

/** Sum of boulders logged across all grades for a workday session. */
export function totalBoulders(s: WorkdaySession): number {
  return s.grades.reduce((sum, g) => sum + (g.count || 0), 0);
}
