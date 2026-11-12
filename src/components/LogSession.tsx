import { Dispatch, SetStateAction, useState } from "react";
import {
  AppData,
  BlockKind,
  BoulderLog,
  GradeCount,
  PainScores,
  Session,
  TrackedProject,
} from "../types";
import { Actions, newId } from "../lib/storage";
import { BLOCK_KINDS, blockLabel, findBlock, newBlock } from "../lib/blocks";
import { RPE_LABELS } from "../lib/boulders";
import { cleanPain } from "../lib/pain";
import { todayISO } from "../lib/format";
import { ChipToggle, DurationField, Field } from "./ui";
import { DraftBlock, fromDraft, toDraft } from "./blockDraft";
import BoulderingBlock from "./BoulderingBlock";
import HangsBlock from "./HangsBlock";
import CoreHipBlock from "./CoreHipBlock";
import PullupsBlock from "./PullupsBlock";
import PainField from "./PainField";

/** Gym picker: a select over the saved gyms with an inline "add new" option. */
function GymField({
  gyms,
  value,
  onChange,
  onAddGym,
}: {
  gyms: string[];
  value: string;
  onChange: (v: string) => void;
  onAddGym: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function add() {
    const g = name.trim();
    if (!g) return;
    onAddGym(g);
    onChange(g);
    setName("");
    setAdding(false);
  }

  // Include the current value even if it's no longer in the saved list.
  const options = value && !gyms.includes(value) ? [value, ...gyms] : gyms;

  return (
    <Field label="Gym">
      {adding ? (
        <div className="row">
          <input
            autoFocus
            value={name}
            placeholder="Gym name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            type="button"
            className="btn"
            style={{ flex: "0 0 auto" }}
            onClick={add}
          >
            Add
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ flex: "0 0 auto" }}
            onClick={() => {
              setAdding(false);
              setName("");
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__add__") setAdding(true);
            else onChange(e.target.value);
          }}
        >
          <option value="">—</option>
          {options.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value="__add__">＋ Add new gym…</option>
        </select>
      )}
    </Field>
  );
}

/** Whole-session effort, 0 (light) to 5 (limit). Tap the active chip to clear. */
function RpeField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <>
      <h3>
        Session RPE
        {value != null && (
          <span className="rpe-label">
            {" "}
            · {value} {RPE_LABELS[value]}
          </span>
        )}
      </h3>
      <div className="chip-row">
        {RPE_LABELS.map((label, i) => (
          <ChipToggle
            key={label}
            active={value === i}
            label={`Session RPE ${i}, ${label}`}
            onClick={() => onChange(value === i ? undefined : i)}
          >
            {i}
          </ChipToggle>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        How hard the whole session felt: 0 light · 1 easy · 2 moderate · 3 hard ·
        4 very hard · 5 limit.
      </p>
    </>
  );
}

/**
 * Projects created while logging are saved with the session — but only the
 * ones a boulder still links to, so an abandoned "Track" leaves nothing behind.
 */
function projectsToSave(
  newProjects: TrackedProject[],
  boulders: BoulderLog[],
  gym: string,
): TrackedProject[] {
  return newProjects
    .filter((p) => boulders.some((b) => b.projectId === p.id))
    .map((p) => ({ ...p, gym: p.gym ?? (gym || undefined) }));
}

/** Whether removing this block would throw away something the user entered. */
function hasInput(d: DraftBlock, data: AppData): boolean {
  switch (d.kind) {
    case "bouldering":
      return d.grades.some((g) => g.count > 0) || !!d.boulders?.length;
    case "pullups":
      return d.sets.some((s) => s.reps != null || s.addedWeight != null);
    default:
      // Prefilled blocks: anything changed from the defaults counts.
      return (
        JSON.stringify(d) !==
        JSON.stringify(toDraft(newBlock(d.kind, data), data.grades))
      );
  }
}

/**
 * The session form: date and gym, then the session's training blocks (added
 * one at a time from "Add a block"), then duration, RPE, pain and notes.
 */
export default function LogSession({
  data,
  actions,
  editing,
  onDone,
  onCancel,
}: {
  data: AppData;
  actions: Actions;
  editing?: Session;
  onDone: () => void; // after a save
  onCancel: () => void; // discard without saving
}) {
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [gym, setGym] = useState(editing?.gym ?? "");
  const [blocks, setBlocks] = useState<DraftBlock[]>(
    () => editing?.blocks.map((b) => toDraft(b, data.grades)) ?? [],
  );
  const [newProjects, setNewProjects] = useState<TrackedProject[]>([]);
  const [picking, setPicking] = useState(false);

  const [durationMin, setDurationMin] = useState(editing?.durationMin);
  const [rpe, setRpe] = useState<number | undefined>(editing?.rpe);
  const [pain, setPain] = useState<PainScores>(editing?.pain ?? {});
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const hidden = new Set(data.hiddenBlocks ?? []);
  const addable = BLOCK_KINDS.filter(
    (k) => !hidden.has(k.kind) && !blocks.some((b) => b.kind === k.kind),
  );

  function addBlock(kind: BlockKind) {
    setBlocks((bs) => [...bs, toDraft(newBlock(kind, data), data.grades)]);
    setPicking(false);
  }

  function removeBlock(kind: BlockKind) {
    const block = blocks.find((b) => b.kind === kind);
    if (
      block &&
      hasInput(block, data) &&
      !confirm(`Remove the ${blockLabel(kind)} block and what's logged in it?`)
    )
      return;
    setBlocks((bs) => bs.filter((b) => b.kind !== kind));
  }

  function replaceBlock(next: DraftBlock) {
    setBlocks((bs) => bs.map((b) => (b.kind === next.kind ? next : b)));
  }

  // BoulderingBlock works with React-style setters (it updates counters and
  // boulders together), so adapt those onto the bouldering block.
  function boulderingSetter<F extends "grades" | "boulders">(field: F) {
    type V = F extends "grades" ? GradeCount[] : BoulderLog[];
    const setter: Dispatch<SetStateAction<V>> = (action) =>
      setBlocks((bs) =>
        bs.map((b) => {
          if (b.kind !== "bouldering") return b;
          const prev = (b[field] ?? []) as V;
          const next =
            typeof action === "function"
              ? (action as (p: V) => V)(prev)
              : action;
          return { ...b, [field]: next };
        }),
      );
    return setter;
  }

  function save() {
    const saved = blocks
      .map(fromDraft)
      .filter((b): b is NonNullable<typeof b> => !!b);
    const session: Session = {
      id: editing?.id ?? newId(),
      date,
      gym: gym || undefined,
      blocks: saved,
      rpe,
      pain: cleanPain(pain),
      durationMin,
      notes: notes.trim() || undefined,
    };
    const boulders = findBlock(saved, "bouldering")?.boulders ?? [];
    actions.saveSession(session, projectsToSave(newProjects, boulders, gym));
    onDone();
  }

  function renderBlock(b: DraftBlock) {
    switch (b.kind) {
      case "bouldering":
        return (
          <BoulderingBlock
            data={data}
            grades={b.grades}
            setGrades={boulderingSetter("grades")}
            boulders={b.boulders ?? []}
            setBoulders={boulderingSetter("boulders")}
            newProjects={newProjects}
            setNewProjects={setNewProjects}
            gym={gym}
            date={date}
          />
        );
      case "hangs":
        return (
          <HangsBlock
            block={b}
            onChange={replaceBlock}
            data={data}
            date={date}
            sessionId={editing?.id}
          />
        );
      case "corehip":
        return <CoreHipBlock block={b} onChange={replaceBlock} data={data} />;
      case "pullups":
        return (
          <PullupsBlock
            block={b}
            onChange={replaceBlock}
            data={data}
            date={date}
          />
        );
    }
  }

  return (
    <div className="card">
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <GymField
        gyms={data.gyms}
        value={gym}
        onChange={setGym}
        onAddGym={(name) => actions.setGyms([...data.gyms, name])}
      />

      {blocks.map((b) => (
        <section className="train-block" key={b.kind}>
          <div className="block-head">
            <h3>{blockLabel(b.kind)}</h3>
            <button
              type="button"
              className="btn danger block-remove"
              aria-label={`remove ${blockLabel(b.kind)} block`}
              onClick={() => removeBlock(b.kind)}
            >
              Remove
            </button>
          </div>
          {renderBlock(b)}
        </section>
      ))}

      {addable.length > 0 &&
        (picking ? (
          <div className="block-picker">
            <div className="chip-row">
              {addable.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  className="btn"
                  onClick={() => addBlock(k.kind)}
                >
                  {k.label}
                </button>
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPicking(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn block add-block"
            onClick={() => setPicking(true)}
          >
            ＋ Add a block…
          </button>
        ))}
      {blocks.length === 0 && (
        <p className="hint" style={{ marginTop: 6 }}>
          Add a block for each part of the session.
        </p>
      )}

      <DurationField value={durationMin} onChange={setDurationMin} />

      <RpeField value={rpe} onChange={setRpe} />

      <PainField value={pain} onChange={setPain} />

      <h3>Notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What felt good/bad, specific problems…"
      />

      <div className="btn-row">
        <button className="btn primary block" onClick={save}>
          {editing ? "Save changes" : "Save session"}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
