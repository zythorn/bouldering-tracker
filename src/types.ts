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

export interface ActivationHangs {
  sets: number;
  secondsPerHang: number;
  effortPct: number;
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

/** A boulder being projected across sessions. Personal-only, not aggregated. */
export interface Project {
  name: string;
  sent: boolean;
}

export interface WorkdaySession {
  id: string;
  kind: "workday";
  date: string;
  sessionType: SessionType;
  gym?: string;
  activation?: ActivationHangs;
  mainHang?: MainHang; // omitted entirely when main hangs are skipped this session
  grades: GradeCount[];
  accessory?: Accessory;
  project?: Project;
  notes?: string;
}

export interface WeekendSession {
  id: string;
  kind: "weekend";
  date: string;
  gym?: string;
  grades?: GradeCount[];
  project?: Project;
  notes?: string;
}

export type Session = WorkdaySession | WeekendSession;

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
  strengthTests: StrengthTest[];
}

export const DEFAULT_DATA: AppData = {
  unit: "kg",
  grades: ["V2", "V3", "V4", "V5", "V6"],
  gradeColors: {},
  gyms: [],
  bodyweights: [],
  sessions: [],
  strengthTests: [],
};
