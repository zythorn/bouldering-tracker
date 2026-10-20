import { useEffect, useMemo, useState } from "react";
import {
  BoulderLog,
  BoulderOutcome,
  BoulderTag,
  GradeFeel,
  Session,
  TrackedProject,
} from "../types";
import { newId } from "../lib/storage";
import {
  GRADE_FEELS,
  OUTCOMES,
  TAG_GROUPS,
  projectStats,
  projectStatus,
} from "../lib/boulders";
import { todayISO } from "../lib/format";
import { ChipToggle, Field, Segmented, Stepper } from "./ui";

interface Props {
  log: BoulderLog; // the draft to edit (new ones arrive with grade prefilled)
  isNew: boolean;
  grades: string[];
  projects: TrackedProject[]; // saved projects plus ones pending in this session
  sessions: Session[];
  gym?: string;
  sessionDate: string;
  onSave: (log: BoulderLog, newProject?: TrackedProject) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Bottom sheet for logging one boulder in detail. */
export default function BoulderSheet({
  log,
  isNew,
  grades,
  projects,
  sessions,
  gym,
  sessionDate,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [grade, setGrade] = useState(log.grade);
  const [outcome, setOutcome] = useState<BoulderOutcome>(log.outcome);
  const [attempts, setAttempts] = useState(log.attempts ?? 1);
  const [feel, setFeel] = useState<GradeFeel | undefined>(log.feel);
  const [tags, setTags] = useState<BoulderTag[]>(log.tags);
  const [notes, setNotes] = useState(log.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!log.notes);
  const [projectId, setProjectId] = useState(log.projectId);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<TrackedProject>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Picker options: open projects (same gym first), then idle ones. Sent and
  // retired projects are left out unless this log is already linked to one.
  const { active, idle } = useMemo(() => {
    const today = todayISO();
    const rows = projects.map((p) => {
      const stats = projectStats(sessions, p.id);
      return {
        p,
        status: projectStatus(p, stats, today),
        last: stats.lastWorked ?? p.createdDate,
      };
    });
    type Row = (typeof rows)[number];
    const byRelevance = (a: Row, b: Row) =>
      Number(b.p.gym === gym) - Number(a.p.gym === gym) ||
      b.last.localeCompare(a.last);
    return {
      // A sent/retired project only shows if this log is already linked to it.
      active: rows
        .filter(
          (r) =>
            r.status === "open" ||
            (r.p.id === log.projectId && r.status !== "idle"),
        )
        .sort(byRelevance)
        .map((r) => r.p),
      idle: rows
        .filter((r) => r.status === "idle")
        .sort(byRelevance)
        .map((r) => r.p),
    };
  }, [projects, sessions, gym, log.projectId]);

  const pickable = newProject ? [newProject, ...active] : active;

  function changeOutcome(o: BoulderOutcome) {
    setOutcome(o);
    if (o === "send" && attempts < 2) setAttempts(2);
  }

  function toggleTag(t: BoulderTag) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function pickProject(id: string) {
    if (!id) {
      setProjectId(undefined);
      return;
    }
    setProjectId(id);
    const p = [...pickable, ...idle].find((x) => x.id === id);
    if (p?.grade) setGrade(p.grade);
    if (p && tags.length === 0 && p.tags.length) setTags(p.tags);
  }

  function track() {
    const name = trackName?.trim();
    if (!name) return;
    const p: TrackedProject = {
      id: newId(),
      name,
      grade,
      gym: gym || undefined,
      tags,
      createdDate: sessionDate,
    };
    setNewProject(p);
    setProjectId(p.id);
    setTrackName(null);
  }

  function save() {
    const next: BoulderLog = {
      id: log.id,
      grade,
      outcome,
      attempts: outcome === "flash" ? undefined : attempts,
      feel,
      tags,
      notes: notes.trim() || undefined,
      projectId,
    };
    // A project tracked from this sheet takes the boulder's final grade/tags.
    const created =
      newProject && projectId === newProject.id
        ? { ...newProject, grade, tags }
        : undefined;
    onSave(next, created);
  }

  const linked = pickable.find((p) => p.id === projectId) ??
    idle.find((p) => p.id === projectId);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label="Boulder detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{isNew ? "Add boulder detail" : "Edit boulder"}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>

        <Field label="Grade">
          <div className="chip-row">
            {grades.map((g) => (
              <ChipToggle
                key={g}
                active={grade === g}
                onClick={() => setGrade(g)}
              >
                {g}
              </ChipToggle>
            ))}
          </div>
        </Field>

        <Field label="Outcome">
          <Segmented value={outcome} onChange={changeOutcome} options={OUTCOMES} />
        </Field>

        {outcome !== "flash" && (
          <div className="field">
            <Stepper
              label="Attempts"
              value={attempts}
              onChange={setAttempts}
              min={1}
            />
          </div>
        )}

        <Field label="Grade feel">
          <div className="chip-row">
            {GRADE_FEELS.map((f) => (
              <ChipToggle
                key={f.value}
                active={feel === f.value}
                onClick={() => setFeel(feel === f.value ? undefined : f.value)}
              >
                {f.label}
              </ChipToggle>
            ))}
          </div>
        </Field>

        {TAG_GROUPS.map((group) => (
          <Field key={group.label} label={group.label}>
            <div className="chip-row">
              {group.tags.map((t) => (
                <ChipToggle
                  key={t.value}
                  active={tags.includes(t.value)}
                  onClick={() => toggleTag(t.value)}
                >
                  {t.label}
                </ChipToggle>
              ))}
            </div>
          </Field>
        ))}

        {(pickable.length > 0 || idle.length > 0) && (
          <Field label="Project">
            <select
              value={projectId ?? ""}
              onChange={(e) => pickProject(e.target.value)}
            >
              <option value="">— not a project —</option>
              {pickable.length > 0 && (
                <optgroup label="Active">
                  {pickable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.grade ? ` (${p.grade})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {idle.length > 0 && (
                <optgroup label="Not worked in 6+ weeks">
                  {idle.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.grade ? ` (${p.grade})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
        )}

        {outcome === "attempt" && !projectId && (
          <div className="field">
            {trackName === null ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setTrackName("")}
              >
                🧗 Track as project
              </button>
            ) : (
              <div className="row">
                <input
                  autoFocus
                  value={trackName}
                  placeholder="Name, e.g. red roof in the cave"
                  onChange={(e) => setTrackName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && track()}
                />
                <button
                  type="button"
                  className="btn"
                  style={{ flex: "0 0 auto" }}
                  onClick={track}
                >
                  Track
                </button>
              </div>
            )}
          </div>
        )}
        {linked && newProject?.id === linked.id && (
          <p className="hint" style={{ marginTop: -4 }}>
            New project “{linked.name}” is created when you save the session.
          </p>
        )}

        {showNotes ? (
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Beta, what stopped you…"
            />
          </Field>
        ) : (
          <button
            type="button"
            className="btn ghost"
            style={{ marginBottom: 12 }}
            onClick={() => setShowNotes(true)}
          >
            + note
          </button>
        )}

        <div className="btn-row">
          <button className="btn primary block" onClick={save}>
            {isNew ? "Add" : "Save"}
          </button>
          {onDelete && (
            <button className="btn danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
