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

// ---- Training blocks -------------------------------------------------
// A session is a list of blocks, at most one of each kind, in the order they
// were added. Adding a new kind of training means adding a block kind here.

/** Grade counters plus optional per-boulder detail. */
export interface BoulderBlock {
  kind: "bouldering";
  grades: GradeCount[]; // counts > 0 only (counters are the total of sends)
  boulders?: BoulderLog[];
}

/**
 * Main hangs. Normal vs compressed-rest is derived from the dates of hang
 * sessions (see sessionTypes() in lib/calculations); `typeOverride` is set
 * only when the user deliberately disagrees with the derived value.
 */
export interface HangBlock extends MainHang {
  kind: "hangs";
  typeOverride?: SessionType;
}

/**
 * Physio-prescribed core/hip routine. An omitted exercise means it wasn't
 * done; whether it matched the prescription is derived (see lib/strength).
 */
export interface CoreHipBlock {
  kind: "corehip";
  breathing?: boolean; // breathing / core control
  deadlift?: { sets?: number; reps?: number; weight?: number }; // banded, light
  glutBridge?: { sets?: number; reps?: number }; // single-leg, reps per side
  sidePlank?: { sets?: number; seconds?: number }; // seconds per side
}

export interface PullupSet {
  reps: number;
  addedWeight?: number; // signed, in the user's unit; absent = bodyweight
}

/** Pull-ups, each set logged separately. */
export interface PullupBlock {
  kind: "pullups";
  sets: PullupSet[];
}

export type Block = BoulderBlock | HangBlock | CoreHipBlock | PullupBlock;
export type BlockKind = Block["kind"];
export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

export interface Session {
  id: string;
  date: string;
  gym?: string;
  blocks: Block[];
  rpe?: number; // session effort, 0 (light) to 5 (limit)
  pain?: PainScores;
  durationMin?: number;
  notes?: string;
}

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
  tableHiddenGrades?: string[]; // grade columns hidden in the Trends gym table
  hiddenBlocks?: BlockKind[]; // block kinds left out of the "Add a block" menu
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
