import { Dispatch, SetStateAction, useState } from "react";
import { AppData, BoulderLog, GradeCount, TrackedProject } from "../types";
import { newId } from "../lib/storage";
import { describeLog, isSend } from "../lib/boulders";
import { Stepper } from "./ui";
import BoulderSheet from "./BoulderSheet";

interface Props {
  data: AppData;
  grades: GradeCount[];
  setGrades: Dispatch<SetStateAction<GradeCount[]>>;
  boulders: BoulderLog[];
  setBoulders: Dispatch<SetStateAction<BoulderLog[]>>;
  newProjects: TrackedProject[];
  setNewProjects: Dispatch<SetStateAction<TrackedProject[]>>;
  gym: string;
  date: string;
}

/**
 * Grade counters plus optional per-boulder detail. Counters stay the total
 * number of sends: saving a detailed send adds 1 to its grade, removing it
 * takes 1 away, and a counter can't drop below its detailed sends.
 */
export default function BoulderingBlock({
  data,
  grades,
  setGrades,
  boulders,
  setBoulders,
  newProjects,
  setNewProjects,
  gym,
  date,
}: Props) {
  const [sheet, setSheet] = useState<{ log: BoulderLog; isNew: boolean }>();

  const allProjects = [...data.projects, ...newProjects];

  function detailedSends(grade: string): number {
    return boulders.filter((b) => b.grade === grade && isSend(b)).length;
  }

  function setCount(grade: string, count: number) {
    setGrades((prev) =>
      prev.map((g) => (g.grade === grade ? { ...g, count } : g)),
    );
  }

  /** Keep counters in step when a detailed log is added, edited or removed. */
  function applyDelta(prev?: BoulderLog, next?: BoulderLog) {
    setGrades((gs) =>
      gs.map((g) => {
        let c = g.count;
        if (prev && isSend(prev) && prev.grade === g.grade) c -= 1;
        if (next && isSend(next) && next.grade === g.grade) c += 1;
        return { ...g, count: Math.max(0, c) };
      }),
    );
  }

  function openNew(grade: string) {
    setSheet({
      isNew: true,
      log: { id: newId(), grade, outcome: "send", attempts: 2, tags: [] },
    });
  }

  function saveLog(log: BoulderLog, created?: TrackedProject) {
    const prev = boulders.find((b) => b.id === log.id);
    setBoulders((bs) =>
      prev ? bs.map((b) => (b.id === log.id ? log : b)) : [...bs, log],
    );
    applyDelta(prev, log);
    if (created) {
      setNewProjects((ps) => [...ps.filter((p) => p.id !== created.id), created]);
    }
    setSheet(undefined);
  }

  function deleteLog(log: BoulderLog) {
    setBoulders((bs) => bs.filter((b) => b.id !== log.id));
    applyDelta(log, undefined);
    setSheet(undefined);
  }

  return (
    <>
      <div className="grid-2">
        {grades.map((g) => (
          <Stepper
            key={g.grade}
            label={g.grade}
            value={g.count}
            min={detailedSends(g.grade)}
            onChange={(v) => setCount(g.grade, v)}
            onLabelClick={() => openNew(g.grade)}
          />
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Tap a grade to log a boulder in detail. Edit the grade list in Settings.
      </p>

      {boulders.length > 0 && (
        <div className="boulder-list">
          {boulders.map((b) => {
            const project = allProjects.find((p) => p.id === b.projectId);
            return (
              <button
                key={b.id}
                type="button"
                className={`boulder-item ${isSend(b) ? "" : "unsent"}`}
                onClick={() => setSheet({ log: b, isNew: false })}
              >
                {project && <span className="proj">🧗 {project.name}</span>}
                <span>{describeLog(b)}</span>
              </button>
            );
          })}
        </div>
      )}

      {sheet && (
        <BoulderSheet
          log={sheet.log}
          isNew={sheet.isNew}
          grades={grades.map((g) => g.grade)}
          projects={allProjects}
          sessions={data.sessions}
          gym={gym || undefined}
          sessionDate={date}
          onSave={saveLog}
          onDelete={sheet.isNew ? undefined : () => deleteLog(sheet.log)}
          onClose={() => setSheet(undefined)}
        />
      )}
    </>
  );
}
