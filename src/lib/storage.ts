import { useCallback, useEffect, useMemo, useState } from "react";
import { AppData, DEFAULT_DATA } from "../types";

const STORAGE_KEY = "bouldering-training-log:v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Merge with defaults so older/partial payloads stay valid.
    return {
      ...DEFAULT_DATA,
      ...parsed,
      grades: parsed.grades?.length ? parsed.grades : DEFAULT_DATA.grades,
    };
  } catch {
    return DEFAULT_DATA;
  }
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
