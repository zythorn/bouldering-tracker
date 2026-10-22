// Core data model for the training log.
// All weights are stored in the user's chosen unit (kg or lb). Because every
// %bodyweight figure is a ratio, the unit cancels out — so as long as bodyweight
// and added weight share the same unit, the maths is unit-agnostic.

export type Unit = "kg" | "lb";

export type SessionType = "normal" | "compressed-rest";

export interface BodyweightEntry {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  weight: number;
}

export interface MainHang {
  edgeMm: number;
  addedWeight: number; // signed; e.g. -5 means 5 removed via pulley
  setsCompleted: number;
  setsIntended: number;
}

export interface GradeCount {
  grade: string; // e.g. "V4"
  count: number;
}

export interface Accessory {
  type: "bodyweight" | "weighted";
  sets?: number;
  reps: number; // reps per set
  addedWeight?: number; // only for weighted
}

export type BoulderTag =
  | "slab"
  | "vertical"
  | "overhang"
  | "power"
  | "technical"
  | "dyno";

export type BoulderOutcome = "flash" | "send" | "attempt"; // attempt = not sent

export type GradeFeel = "soft" | "fair" | "hard";

/**
 * A single boulder logged in detail within one session. Detailed sends are
 * also included in that grade's counter, so counters stay the total.
 */
export interface BoulderLog {
  id: string;
  grade?: string; // absent only on entries migrated from the old project field
  outcome: BoulderOutcome;
  attempts?: number; // absent on migrated entries; a flash is always 1
  feel?: GradeFeel;
  tags: BoulderTag[];
  notes?: string;
  projectId?: string; // set when this was work on a tracked project
}

/**
 * A boulder worked across sessions. Progress (attempts, sessions, sent date)
 * is derived from the BoulderLogs that reference it, never stored here.
 */
export interface TrackedProject {
  id: string;
  name: string;
  grade?: string;
  gym?: string;
  tags: BoulderTag[];
  createdDate: string;
  retired?: boolean;
}

/** Pain check, 0–5 per area. A missing area means "not recorded" (not 0). */
export interface PainScores {
  elbow?: number;
  wrist?: number;
  back?: number; // lower back
}

export interface WorkdaySession {
  id: string;
  kind: "workday";
  date: string;
  // Normal vs compressed-rest is derived from dates (see sessionTypes() in
  // lib/calculations). `sessionType` is the manual tag older versions stored;
  // it is kept untouched but no longer read. `sessionTypeOverride` is set only
  // when the user deliberately disagrees with the derived value.
  sessionType?: SessionType;
  sessionTypeOverride?: SessionType;
  gym?: string;
  mainHang?: MainHang; // omitted entirely when main hangs are skipped this session
  grades: GradeCount[];
  boulders?: BoulderLog[];
  accessory?: Accessory;
  rpe?: number; // session effort, 0 (light) to 5 (limit)
  pain?: PainScores;
  notes?: string;
}

export interface WeekendSession {
  id: string;
  kind: "weekend";
  date: string;
  gym?: string;
  grades?: GradeCount[];
  boulders?: BoulderLog[];
  rpe?: number;
  pain?: PainScores;
  notes?: string;
}

/**
 * Physio-prescribed core/hip routine. An omitted exercise means it wasn't
 * done; whether the session matched the prescription is derived
 * (see lib/strength).
 */
export interface StrengthSession {
  id: string;
  kind: "strength";
  date: string;
  breathing?: boolean; // breathing / core control
  deadlift?: { sets?: number; reps?: number; weight?: number }; // banded, light
  glutBridge?: { sets?: number; reps?: number }; // single-leg, reps per side
  sidePlank?: { sets?: number; seconds?: number }; // seconds per side
  pain?: PainScores;
  notes?: string;
}

export type Session = WorkdaySession | WeekendSession | StrengthSession;

/** Sessions with a bouldering block (everything except core/hip). */
export type ClimbingSession = WorkdaySession | WeekendSession;

export interface StrengthTest {
  id: string;
  date: string;
  maxPullups?: number; // reps at bodyweight
  weighted1RMAdded?: number; // added weight for a 1RM weighted pull-up
  weighted2RMAdded?: number;
  maxHang?: {
    edgeMm: number;
    addedWeight: number;
    durationSec: number;
  };
}

export interface AppData {
  unit: Unit;
  grades: string[]; // editable list of grade labels used by the counters
  gradeColors: Record<string, string>; // grade -> named colour (see lib/colors)
  gyms: string[]; // editable list of gym names
  bodyweights: BodyweightEntry[];
  sessions: Session[];
  projects: TrackedProject[];
  strengthTests: StrengthTest[];
}

export const DEFAULT_DATA: AppData = {
  unit: "kg",
  grades: ["V2", "V3", "V4", "V5", "V6"],
  gradeColors: {},
  gyms: [],
  bodyweights: [],
  sessions: [],
  projects: [],
  strengthTests: [],
};
