import {
  BoulderLog,
  BoulderOutcome,
  BoulderTag,
  GradeFeel,
  Session,
  TrackedProject,
} from "../types";

export const OUTCOMES: { value: BoulderOutcome; label: string }[] = [
  { value: "flash", label: "Flash" },
  { value: "send", label: "Send" },
  { value: "attempt", label: "Not sent" },
];

export const GRADE_FEELS: { value: GradeFeel; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "fair", label: "Fair" },
  { value: "hard", label: "Hard" },
];

/** Tags in two groups: wall angle, then movement style. */
export const TAG_GROUPS: {
  label: string;
  tags: { value: BoulderTag; label: string }[];
}[] = [
  {
    label: "Angle",
    tags: [
      { value: "slab", label: "slab" },
      { value: "vertical", label: "vertical" },
      { value: "overhang", label: "overhang" },
    ],
  },
  {
    label: "Style",
    tags: [
      { value: "power", label: "power" },
      { value: "technical", label: "technical" },
      { value: "dyno", label: "dyno / coordination" },
    ],
  },
];

export const TAG_LABELS = Object.fromEntries(
  TAG_GROUPS.flatMap((g) => g.tags).map((t) => [t.value, t.label]),
) as Record<BoulderTag, string>;

/** Session RPE labels, indexed 0–5. */
export const RPE_LABELS = [
  "light",
  "easy",
  "moderate",
  "hard",
  "very hard",
  "limit",
];

/** Projects not worked for this long drop out of the quick picker. */
export const PROJECT_IDLE_DAYS = 42;

export function isSend(log: BoulderLog): boolean {
  return log.outcome !== "attempt";
}

/** Attempts a log represents (a flash is always 1). */
export function logAttempts(log: BoulderLog): number | undefined {
  return log.outcome === "flash" ? 1 : log.attempts;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** One-line summary, e.g. "V5 · sent in 4 · hard · overhang, power". */
export function describeLog(log: BoulderLog): string {
  const parts: string[] = [];
  if (log.grade) parts.push(log.grade);
  if (log.outcome === "flash") parts.push("⚡ flash");
  else if (log.outcome === "send")
    parts.push(log.attempts ? `sent in ${log.attempts}` : "sent");
  else
    parts.push(
      log.attempts ? `${plural(log.attempts, "attempt")}, not sent` : "not sent",
    );
  if (log.feel) parts.push(log.feel);
  if (log.tags.length) parts.push(log.tags.map((t) => TAG_LABELS[t]).join(", "));
  return parts.join(" · ");
}

export interface ProjectStats {
  sessions: number; // distinct sessions with a linked log
  attempts: number; // sum of known attempts
  attemptsComplete: boolean; // false if a linked log has no attempt count (migrated)
  sentDate?: string; // date of the first linked send
  lastWorked?: string; // date of the most recent linked log
}

/**
 * Progress on a project, derived from every log that references it. With
 * `upTo`, only sessions on or before that date count (for "31 total so far").
 */
export function projectStats(
  sessions: Session[],
  projectId: string,
  upTo?: string,
): ProjectStats {
  const stats: ProjectStats = {
    sessions: 0,
    attempts: 0,
    attemptsComplete: true,
  };
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of ordered) {
    if (upTo && s.date > upTo) continue;
    const logs = (s.boulders ?? []).filter((b) => b.projectId === projectId);
    if (logs.length === 0) continue;
    stats.sessions += 1;
    stats.lastWorked = s.date;
    for (const log of logs) {
      const n = logAttempts(log);
      if (n == null) stats.attemptsComplete = false;
      else stats.attempts += n;
      if (isSend(log) && !stats.sentDate) stats.sentDate = s.date;
    }
  }
  return stats;
}

/**
 * "31 attempts", or "12+ attempts" when some linked logs have no count
 * (migrated entries). Undefined when nothing was counted at all.
 */
export function attemptsText(stats: ProjectStats): string | undefined {
  if (stats.attemptsComplete) return plural(stats.attempts, "attempt");
  return stats.attempts > 0 ? `${stats.attempts}+ attempts` : undefined;
}

export type ProjectStatus = "open" | "idle" | "sent" | "retired";

function daysBetween(fromISO: string, toISO: string): number {
  const ms =
    new Date(toISO + "T00:00:00").getTime() -
    new Date(fromISO + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

export function projectStatus(
  project: TrackedProject,
  stats: ProjectStats,
  today: string,
): ProjectStatus {
  if (project.retired) return "retired";
  if (stats.sentDate) return "sent";
  const lastActivity = stats.lastWorked ?? project.createdDate;
  return daysBetween(lastActivity, today) > PROJECT_IDLE_DAYS ? "idle" : "open";
}
