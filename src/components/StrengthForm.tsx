import { ReactNode, useState } from "react";
import { AppData, PainScores, StrengthSession } from "../types";
import { Actions, newId } from "../lib/storage";
import {
  CORE_PRESCRIPTION,
  deadliftLimit,
  prescriptionGaps,
} from "../lib/strength";
import { cleanPain } from "../lib/pain";
import { todayISO } from "../lib/format";
import { Field, NumberInput } from "./ui";
import PainField from "./PainField";

/** One checklist item: a "done" checkbox, revealing its inputs when ticked. */
function Exercise({
  title,
  hint,
  done,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  done: boolean;
  onToggle: (done: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="exercise">
      <label className="check">
        <input
          type="checkbox"
          aria-label={`${title} done`}
          checked={done}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>{title}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
      {done && children && <div className="row">{children}</div>}
    </div>
  );
}

/**
 * Core/hip session: the physio's fixed checklist. New sessions start at the
 * prescribed dose with everything ticked, so a routine done as prescribed is
 * a date and a tap on Save.
 */
export default function StrengthForm({
  data,
  actions,
  editing,
  onDone,
  onCancel,
}: {
  data: AppData;
  actions: Actions;
  editing?: StrengthSession;
  onDone: () => void;
  onCancel: () => void;
}) {
  const unit = data.unit;
  const p = CORE_PRESCRIPTION;

  // Carry the deadlift weight over from the last core/hip session.
  const lastWeight = data.sessions
    .filter((s): s is StrengthSession => s.kind === "strength")
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((s) => s.deadlift?.weight != null)?.deadlift?.weight;

  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [breathing, setBreathing] = useState(editing ? !!editing.breathing : true);
  const [deadlift, setDeadlift] = useState({
    done: editing ? !!editing.deadlift : true,
    sets: editing ? editing.deadlift?.sets : p.deadlift.sets,
    reps: editing ? editing.deadlift?.reps : p.deadlift.reps,
    weight: editing ? editing.deadlift?.weight : lastWeight,
  });
  const [bridge, setBridge] = useState({
    done: editing ? !!editing.glutBridge : true,
    sets: editing ? editing.glutBridge?.sets : p.glutBridge.sets,
    reps: editing ? editing.glutBridge?.reps : p.glutBridge.reps,
  });
  const [plank, setPlank] = useState({
    done: editing ? !!editing.sidePlank : true,
    sets: editing ? editing.sidePlank?.sets : p.sidePlank.sets,
    seconds: editing ? editing.sidePlank?.seconds : p.sidePlank.seconds,
  });
  const [pain, setPain] = useState<PainScores>(editing?.pain ?? {});
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const session: StrengthSession = {
    id: editing?.id ?? newId(),
    kind: "strength",
    date,
    breathing,
    deadlift: deadlift.done
      ? { sets: deadlift.sets, reps: deadlift.reps, weight: deadlift.weight }
      : undefined,
    glutBridge: bridge.done ? { sets: bridge.sets, reps: bridge.reps } : undefined,
    sidePlank: plank.done
      ? { sets: plank.sets, seconds: plank.seconds }
      : undefined,
    pain: cleanPain(pain),
    notes: notes.trim() || undefined,
  };
  const gaps = prescriptionGaps(session, unit);

  function save() {
    actions.saveSession(session);
    onDone();
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

      <h3>Core / hip routine</h3>
      <Exercise
        title="Breathing / core control"
        done={breathing}
        onToggle={setBreathing}
      />
      <Exercise
        title="Deadlift (banded)"
        hint={`${p.deadlift.sets}×${p.deadlift.reps}, under ${deadliftLimit(unit)} ${unit}`}
        done={deadlift.done}
        onToggle={(done) => setDeadlift((d) => ({ ...d, done }))}
      >
        <Field label="Sets">
          <NumberInput
            value={deadlift.sets}
            min={0}
            onChange={(sets) => setDeadlift((d) => ({ ...d, sets }))}
          />
        </Field>
        <Field label="Reps">
          <NumberInput
            value={deadlift.reps}
            min={0}
            onChange={(reps) => setDeadlift((d) => ({ ...d, reps }))}
          />
        </Field>
        <Field label={`Weight (${unit})`}>
          <NumberInput
            value={deadlift.weight}
            min={0}
            step={0.5}
            onChange={(weight) => setDeadlift((d) => ({ ...d, weight }))}
          />
        </Field>
      </Exercise>
      <Exercise
        title="Single-leg glute bridge"
        hint={`${p.glutBridge.sets}×${p.glutBridge.reps} per side`}
        done={bridge.done}
        onToggle={(done) => setBridge((b) => ({ ...b, done }))}
      >
        <Field label="Sets">
          <NumberInput
            value={bridge.sets}
            min={0}
            onChange={(sets) => setBridge((b) => ({ ...b, sets }))}
          />
        </Field>
        <Field label="Reps / side">
          <NumberInput
            value={bridge.reps}
            min={0}
            onChange={(reps) => setBridge((b) => ({ ...b, reps }))}
          />
        </Field>
      </Exercise>
      <Exercise
        title="Side plank"
        hint={`${p.sidePlank.sets}×30–40 s per side`}
        done={plank.done}
        onToggle={(done) => setPlank((s) => ({ ...s, done }))}
      >
        <Field label="Sets">
          <NumberInput
            value={plank.sets}
            min={0}
            onChange={(sets) => setPlank((s) => ({ ...s, sets }))}
          />
        </Field>
        <Field label="Seconds / side">
          <NumberInput
            value={plank.seconds}
            min={0}
            onChange={(seconds) => setPlank((s) => ({ ...s, seconds }))}
          />
        </Field>
      </Exercise>

      <div className="calc" style={{ marginTop: 4 }}>
        {gaps.length === 0 ? (
          <strong>✓ Completed as prescribed</strong>
        ) : (
          <>Short of the prescription: {gaps.join(", ")}</>
        )}
      </div>

      <PainField value={pain} onChange={setPain} />

      <h3>Notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="How it felt, band used…"
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
