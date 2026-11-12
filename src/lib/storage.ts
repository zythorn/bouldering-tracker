import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppData,
  Block,
  BlockKind,
  BoulderLog,
  CoreHipBlock,
  DEFAULT_DATA,
  GradeCount,
  MainHang,
  PainScores,
  Session,
  SessionType,
  TrackedProject,
} from "../types";
import { sessionBoulders } from "./calculations";
import { todayISO } from "./format";

const STORAGE_KEY = "bouldering-training-log:v1";
const BACKUP_PREFIX = "bouldering-training-log:backup:";

/**
 * A session as older versions stored it: one of three fixed kinds instead of
 * a list of blocks. Only read by migrate().
 */
interface LegacySession extends Omit<CoreHipBlock, "kind"> {
  id: string;
  kind?: "workday" | "weekend" | "strength";
  date: string;
  gym?: string;
  rpe?: number;
  pain?: PainScores;
  durationMin?: number;
  notes?: string;
  blocks?: Block[];
  // work-day / weekend
  grades?: GradeCount[];
  boulders?: BoulderLog[];
  mainHang?: MainHang;
  sessionTypeOverride?: SessionType;
  sessionType?: SessionType; // manual tag, unused since dates decide
  accessory?: {
    type: "bodyweight" | "weighted";
    sets?: number;
    reps: number;
    addedWeight?: number;
  };
  // removed features
  project?: { name?: string; sent?: boolean };
  activation?: unknown;
}

/** Convert an old fixed-kind session into a session made of blocks. */
function toBlocks(s: LegacySession): Session {
  const blocks: Block[] = [];
  if (s.kind === "strength") {
    blocks.push({
      kind: "corehip",
      breathing: s.breathing,
      deadlift: s.deadlift,
      glutBridge: s.glutBridge,
      sidePlank: s.sidePlank,
    });
  } else {
    const grades = (s.grades ?? []).filter((g) => g.count > 0);
    if (grades.length > 0 || s.boulders?.length) {
      blocks.push({
        kind: "bouldering",
        grades,
        boulders: s.boulders?.length ? s.boulders : undefined,
      });
    }
    if (s.mainHang) {
      blocks.push({
        kind: "hangs",
        ...s.mainHang,
        typeOverride: s.sessionTypeOverride,
      });
    }
    const acc = s.accessory;
    if (acc && acc.reps != null) {
      // "3 sets × 8 reps" becomes three logged sets of 8.
      const addedWeight =
        acc.type === "weighted" && acc.addedWeight ? acc.addedWeight : undefined;
      blocks.push({
        kind: "pullups",
        sets: Array.from({ length: Math.max(1, acc.sets ?? 1) }, () => ({
          reps: acc.reps,
          addedWeight,
        })),
      });
    }
  }
  return {
    id: s.id,
    date: s.date,
    gym: s.gym,
    blocks,
    rpe: s.rpe,
    pain: s.pain,
    durationMin: s.durationMin,
    notes: s.notes,
  };
}

/**
 * Bring stored or imported data up to the current model. Safe to run on
 * already-migrated data (it then only fills in defaults).
 *
 * - Old per-session `project: {name, sent}` entries become TrackedProjects
 *   (grouped by name), with a linked BoulderLog on each session. The old field
 *   never recorded a grade or attempts, so those stay empty.
 * - Activation-hang data is dropped (the feature was removed).
 * - Fixed session kinds (work-day / weekend / core/hip) become blocks: a
 *   bouldering block when anything was climbed, a hangs block when hangs were
 *   logged, a core/hip block, and a pull-ups block from accessory (one logged
 *   set per set). The work-day / weekend distinction is dropped.
 */
export function migrate(raw: Partial<AppData>): AppData {
  const data: AppData = {
    ...DEFAULT_DATA,
    ...raw,
    grades: raw.grades?.length ? raw.grades : DEFAULT_DATA.grades,
    sessions: raw.sessions ?? [],
    projects: raw.projects ?? [],
  };
  const legacy = data.sessions as unknown as LegacySession[];

  const byName = new Map<string, TrackedProject>(
    data.projects.map((p) => [p.name.trim().toLowerCase(), p]),
  );

  // Oldest first, so each project gets the gym and date it was first worked.
  const ordered = [...legacy]
    .filter((s) => !s.blocks && s.kind !== "strength")
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const s of ordered) {
    delete s.activation;
    const old = s.project;
    delete s.project;
    const name = old?.name?.trim();
    if (!name) continue;

    let project = byName.get(name.toLowerCase());
    if (!project) {
      project = {
        id: newId(),
        name,
        gym: s.gym,
        tags: [],
        createdDate: s.date,
      };
      byName.set(name.toLowerCase(), project);
      data.projects.push(project);
    }
    s.boulders = [
      ...(s.boulders ?? []),
      {
        id: newId(),
        outcome: old?.sent ? "send" : "attempt",
        tags: [],
        projectId: project.id,
      },
    ];
  }

  data.sessions = legacy.map((s) => (s.blocks ? (s as Session) : toBlocks(s)));
  return data;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    // Normalise formatting first so whitespace alone never counts as a change.
    const original = JSON.stringify(JSON.parse(raw));
    const data = migrate(JSON.parse(raw) as Partial<AppData>);
    // If migrating changed anything, keep the untouched original before the
    // upgraded version is saved over it (one backup per day, never overwritten).
    if (JSON.stringify(data) !== original) {
      const key = BACKUP_PREFIX + todayISO();
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    }
    return data;
  } catch {
    return DEFAULT_DATA;
  }
}

/** Pre-upgrade backups kept by load(), newest first. */
export function listBackups(): { date: string; raw: string }[] {
  const out: { date: string; raw: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(BACKUP_PREFIX)) {
        out.push({
          date: key.slice(BACKUP_PREFIX.length),
          raw: localStorage.getItem(key) ?? "",
        });
      }
    }
  } catch {
    // Storage unavailable — no backups to show.
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Single source of truth for app state, persisted to localStorage on every change.
 */
export function useAppData() {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — nothing we can meaningfully do here.
    }
  }, [data]);

  const update = useCallback((mutator: (draft: AppData) => AppData) => {
    setData((prev) => mutator(structuredClone(prev)));
  }, []);

  const actions = useMemo(
    () => ({
      setUnit: (unit: AppData["unit"]) =>
        update((d) => {
          d.unit = unit;
          return d;
        }),
      setGrades: (grades: string[]) =>
        update((d) => {
          d.grades = grades;
          return d;
        }),
      setGradeColor: (grade: string, color: string) =>
        update((d) => {
          if (color) d.gradeColors[grade] = color;
          else delete d.gradeColors[grade];
          return d;
        }),
      setGyms: (gyms: string[]) =>
        update((d) => {
          d.gyms = gyms;
          return d;
        }),
      setTableHiddenGrades: (grades: string[]) =>
        update((d) => {
          d.tableHiddenGrades = grades.length ? grades : undefined;
          return d;
        }),
      setHiddenBlocks: (kinds: BlockKind[]) =>
        update((d) => {
          d.hiddenBlocks = kinds.length ? kinds : undefined;
          return d;
        }),

      upsertBodyweight: (entry: AppData["bodyweights"][number]) =>
        update((d) => {
          const i = d.bodyweights.findIndex((b) => b.id === entry.id);
          if (i >= 0) d.bodyweights[i] = entry;
          else d.bodyweights.push(entry);
          return d;
        }),
      deleteBodyweight: (id: string) =>
        update((d) => {
          d.bodyweights = d.bodyweights.filter((b) => b.id !== id);
          return d;
        }),

      upsertSession: (session: AppData["sessions"][number]) =>
        update((d) => {
          const i = d.sessions.findIndex((s) => s.id === session.id);
          if (i >= 0) d.sessions[i] = session;
          else d.sessions.push(session);
          return d;
        }),
      deleteSession: (id: string) =>
        update((d) => {
          d.sessions = d.sessions.filter((s) => s.id !== id);
          return d;
        }),
      /** Save a session together with any projects created while logging it. */
      saveSession: (
        session: AppData["sessions"][number],
        newProjects: TrackedProject[] = [],
      ) =>
        update((d) => {
          for (const p of newProjects) {
            if (!d.projects.some((x) => x.id === p.id)) d.projects.push(p);
          }
          const i = d.sessions.findIndex((s) => s.id === session.id);
          if (i >= 0) d.sessions[i] = session;
          else d.sessions.push(session);
          return d;
        }),

      upsertProject: (project: TrackedProject) =>
        update((d) => {
          const i = d.projects.findIndex((p) => p.id === project.id);
          if (i >= 0) d.projects[i] = project;
          else d.projects.push(project);
          return d;
        }),
      /** Delete a project; its logs stay as plain detailed boulders. */
      deleteProject: (id: string) =>
        update((d) => {
          d.projects = d.projects.filter((p) => p.id !== id);
          for (const s of d.sessions) {
            for (const b of sessionBoulders(s)) {
              if (b.projectId === id) delete b.projectId;
            }
          }
          return d;
        }),

      upsertStrengthTest: (test: AppData["strengthTests"][number]) =>
        update((d) => {
          const i = d.strengthTests.findIndex((t) => t.id === test.id);
          if (i >= 0) d.strengthTests[i] = test;
          else d.strengthTests.push(test);
          return d;
        }),
      deleteStrengthTest: (id: string) =>
        update((d) => {
          d.strengthTests = d.strengthTests.filter((t) => t.id !== id);
          return d;
        }),

      replaceAll: (next: AppData) => setData(next),
    }),
    [update],
  );

  return { data, actions };
}

export type Actions = ReturnType<typeof useAppData>["actions"];
