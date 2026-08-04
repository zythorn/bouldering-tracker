// Named hold colours the user can assign to grades. Hex values are tuned to
// read well on the dark UI (pure white/black would wash out or vanish, so they
// are nudged slightly and the chart draws a thin separator stroke around bars).

export const GRADE_COLOR_NAMES = [
  "white",
  "yellow",
  "green",
  "blue",
  "red",
  "black",
  "purple",
  "orange",
] as const;

export type GradeColorName = (typeof GRADE_COLOR_NAMES)[number];

export const GRADE_COLOR_HEX: Record<GradeColorName, string> = {
  white: "#eef2f7",
  yellow: "#f2c744",
  green: "#57c06a",
  blue: "#5b8def",
  red: "#e5554e",
  black: "#20242b",
  purple: "#b07de5",
  orange: "#e8823c",
};

// Fallback palette for grades with no explicitly assigned colour ("Auto").
const FALLBACK = [
  "#4cc38a",
  "#6ba7e5",
  "#d9a441",
  "#e5825b",
  "#b77de5",
  "#5be5c8",
  "#e55b8b",
];

/**
 * Resolve the fill colour for a grade: the user's assigned named colour if set,
 * otherwise a stable fallback based on the grade's position in `gradeOrder`.
 */
export function gradeFill(
  grade: string,
  gradeColors: Record<string, string>,
  gradeOrder: string[],
): string {
  const name = gradeColors[grade];
  if (name && name in GRADE_COLOR_HEX) {
    return GRADE_COLOR_HEX[name as GradeColorName];
  }
  const i = gradeOrder.indexOf(grade);
  return FALLBACK[(i < 0 ? 0 : i) % FALLBACK.length];
}
