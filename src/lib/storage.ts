import { useCallback, useEffect, useMemo, useState } from "react";
import { AppData, ClimbingSession, DEFAULT_DATA, TrackedProject } from "../types";
import { isClimbing, sessionBoulders } from "./calculations";
import { todayISO } from "./format";

const STORAGE_KEY = "bouldering-training-log:v1";
const BACKUP_PREFIX = "bouldering-training-log:backup:";

// Fields older versions stored on sessions that the current model replaced.
type LegacySession = ClimbingSession & {
  project?: { name?: string; sent?: boolean };
  activation?: unknown;
};

/**
 * Bring stored or imported data up to the current model. Safe to run on
 * already-migrated data (it then only fills in defaults).
 *
 * - Old per-session `project: {name, sent}` entries become TrackedProjects
 *   (grouped by name), with a linked BoulderLog on each session. The old field
 *   never recorded a grade or attempts, so those stay empty.
 * - Activation-hang data is dropped (the feature was removed).
 */
export function migrate(raw: Partial<AppData>): AppData {
  const data: AppData = {
    ...DEFAULT_DATA,
    ...raw,
    grades: raw.grades?.length ? raw.grades : DEFAULT_DATA.grades,
    sessions: raw.sessions ?? [],
    projects: raw.projects ?? [],
  };

  const byName = new Map<string, TrackedProject>(
    data.projects.map((p) => [p.name.trim().toLowerCase(), p]),
  );

  // Oldest first, so each project gets the gym and date it was first worked.
  const ordered = [...data.sessions].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  for (const s of ordered.filter(isClimbing) as LegacySession[]) {
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
  return data;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const data = migrate(JSON.parse(raw) as Partial<AppData>);
    // If migrating changed anything, keep the untouched original before the
    // upgraded version is saved over it (one backup per day, never overwritten).
    if (JSON.stringify(data) !== raw) {
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
