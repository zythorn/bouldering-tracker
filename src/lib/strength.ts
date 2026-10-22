// Core/hip routine prescribed by the physio.
import { Session, StrengthSession, Unit } from "../types";
import { addDays, weekStart } from "./format";

export const CORE_PRESCRIPTION = {
  deadlift: { sets: 3, reps: 12 },
  glutBridge: { sets: 3, reps: 12 }, // per side
  sidePlank: { sets: 3, seconds: 30 }, // per side; plan says 30–40 s
};

/** Deadlift stays light (banded): under 20 kg. */
export function deadliftLimit(unit: Unit): number {
  return unit === "kg" ? 20 : 44;
}

export const CORE_WEEKLY_TARGET = 3;
export const CORE_WEEKLY_MIN = 2;

/**
 * What fell short of the prescription; empty means "completed as prescribed".
 */
export function prescriptionGaps(s: StrengthSession, unit: Unit): string[] {
  const gaps: string[] = [];
  const p = CORE_PRESCRIPTION;
  if (!s.breathing) gaps.push("breathing / core control");

  const dl = s.deadlift;
  if (!dl) gaps.push("deadlift");
  else {
    if ((dl.sets ?? 0) < p.deadlift.sets || (dl.reps ?? 0) < p.deadlift.reps)
      gaps.push(`deadlift ${dl.sets ?? 0}×${dl.reps ?? 0}`);
    if (dl.weight != null && dl.weight >= deadliftLimit(unit))
      gaps.push(`deadlift weight ${dl.weight} ${unit}`);
  }

  const gb = s.glutBridge;
  if (!gb) gaps.push("glute bridge");
  else if ((gb.sets ?? 0) < p.glutBridge.sets || (gb.reps ?? 0) < p.glutBridge.reps)
    gaps.push(`glute bridge ${gb.sets ?? 0}×${gb.reps ?? 0}`);

  const sp = s.sidePlank;
  if (!sp) gaps.push("side plank");
  else if (
    (sp.sets ?? 0) < p.sidePlank.sets ||
    (sp.seconds ?? 0) < p.sidePlank.seconds
  )
    gaps.push(`side plank ${sp.sets ?? 0}×${sp.seconds ?? 0} s`);

  return gaps;
}

/** Core/hip sessions in the Monday–Sunday week containing `today`. */
export function coreSessionsThisWeek(sessions: Session[], today: string): number {
  const from = weekStart(today);
  const to = addDays(from, 6);
  return sessions.filter(
    (s) => s.kind === "strength" && s.date >= from && s.date <= to,
  ).length;
}
