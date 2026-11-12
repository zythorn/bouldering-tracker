// Time ranges, grade filters and the gym × grade table for the Trends tab.
import { Session } from "../types";
import { sessionGrades } from "./calculations";
import { hasBlock } from "./blocks";
import { addDays, addMonths, weekStart } from "./format";

/** Rolling ranges for the per-session chart (calendar periods would leave it
 *  nearly empty early in a week or month). */
export type ChartRange = "4w" | "3m" | "all";

export const CHART_RANGES: { value: ChartRange; label: string }[] = [
  { value: "4w", label: "Last 4 weeks" },
  { value: "3m", label: "Last 3 months" },
  { value: "all", label: "All time" },
];

export function rangeStart(range: ChartRange, today: string): string | undefined {
  if (range === "4w") return addDays(today, -27); // today plus the 27 days before
  if (range === "3m") return addMonths(today, -3);
  return undefined;
}

/** Calendar periods for the gym table ("how many V5s this month?"). */
export type TablePeriod = "week" | "month" | "all";

export const TABLE_PERIODS: { value: TablePeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

/** Inclusive [from, to] bounds of a period; undefined bounds are open. */
export function periodBounds(
  period: TablePeriod,
  today: string,
): { from?: string; to?: string } {
  if (period === "week") {
    const from = weekStart(today);
    return { from, to: addDays(from, 6) };
  }
  if (period === "month") {
    const from = today.slice(0, 8) + "01";
    return { from, to: addDays(addMonths(from, 1), -1) };
  }
  return {};
}

/**
 * Grade filter for the chart, encoded as "all", "only:V5" or "up:V5"
 * ("V5 and up", by position in the user's grade list).
 */
export function gradeFilterOptions(grades: string[]): { value: string; label: string }[] {
  const opts = [{ value: "all", label: "All grades" }];
  grades.forEach((g, i) => {
    opts.push({ value: `only:${g}`, label: `${g} only` });
    // "First grade and up" is just "All"; "last grade and up" is just "only".
    if (i > 0 && i < grades.length - 1)
      opts.push({ value: `up:${g}`, label: `${g} and up` });
  });
  return opts;
}

/** Predicate for the grades a filter includes. */
export function gradeFilterIncludes(
  filter: string,
  order: string[],
): (grade: string) => boolean {
  if (filter.startsWith("only:")) {
    const g = filter.slice(5);
    return (grade) => grade === g;
  }
  if (filter.startsWith("up:")) {
    const min = order.indexOf(filter.slice(3));
    return (grade) => order.indexOf(grade) >= min;
  }
  return () => true;
}

export interface GymRow {
  gym: string; // display name; "No gym" for sessions without one
  sessions: number; // climbing sessions in the period, including ones with no sends
  counts: Record<string, number>; // sends per grade
}

export interface GymTable {
  rows: GymRow[]; // gyms, most-visited first
  noGym?: GymRow; // sessions logged without a gym
  total: GymRow;
  grades: string[]; // every grade with a send in the period, in list order
}

/** Sends per grade at each gym within a period (sessions with a bouldering block). */
export function gymGradeTable(
  sessions: Session[],
  gradeOrder: string[],
  period: TablePeriod,
  today: string,
): GymTable {
  const { from, to } = periodBounds(period, today);
  const byGym = new Map<string, GymRow>();
  let noGym: GymRow | undefined;
  const total: GymRow = { gym: "Total", sessions: 0, counts: {} };
  const seen = new Set<string>();

  for (const s of sessions) {
    if (!hasBlock(s, "bouldering")) continue;
    if ((from && s.date < from) || (to && s.date > to)) continue;
    let row: GymRow;
    if (s.gym) {
      row = byGym.get(s.gym) ?? { gym: s.gym, sessions: 0, counts: {} };
      byGym.set(s.gym, row);
    } else {
      noGym ??= { gym: "No gym", sessions: 0, counts: {} };
      row = noGym;
    }
    row.sessions += 1;
    total.sessions += 1;
    for (const g of sessionGrades(s)) {
      if (!g.count) continue;
      row.counts[g.grade] = (row.counts[g.grade] ?? 0) + g.count;
      total.counts[g.grade] = (total.counts[g.grade] ?? 0) + g.count;
      seen.add(g.grade);
    }
  }

  const rank = (g: string) => {
    const i = gradeOrder.indexOf(g);
    return i < 0 ? gradeOrder.length : i;
  };
  return {
    rows: [...byGym.values()].sort(
      (a, b) => b.sessions - a.sessions || a.gym.localeCompare(b.gym),
    ),
    noGym,
    total,
    grades: [...seen].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
  };
}
