import { ReactNode } from "react";
import { AppData, CoreHipBlock as CoreHip } from "../types";
import {
  CORE_PRESCRIPTION,
  deadliftLimit,
  prescriptionGaps,
} from "../lib/strength";
import { lastDeadliftWeight } from "../lib/blocks";
import { Field, NumberInput } from "./ui";

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
 * The physio's fixed core/hip checklist. A new block starts at the prescribed
 * dose with everything ticked; re-ticking an exercise restores that dose.
 */
export default function CoreHipBlock({
  block,
  onChange,
  data,
}: {
  block: CoreHip;
  onChange: (b: CoreHip) => void;
  data: AppData;
}) {
  const unit = data.unit;
  const p = CORE_PRESCRIPTION;
  const set = (patch: Partial<CoreHip>) => onChange({ ...block, ...patch });
  const { deadlift, glutBridge, sidePlank } = block;
  const gaps = prescriptionGaps(block, unit);

  return (
    <>
      <Exercise
        title="Breathing / core control"
        done={!!block.breathing}
        onToggle={(breathing) => set({ breathing })}
      />
      <Exercise
        title="Deadlift (banded)"
        hint={`${p.deadlift.sets}×${p.deadlift.reps}, under ${deadliftLimit(unit)} ${unit}`}
        done={!!deadlift}
        onToggle={(done) =>
          set({
            deadlift: done
              ? { ...p.deadlift, weight: lastDeadliftWeight(data.sessions) }
              : undefined,
          })
        }
      >
        <Field label="Sets">
          <NumberInput
            value={deadlift?.sets}
            min={0}
            onChange={(sets) => set({ deadlift: { ...deadlift, sets } })}
          />
        </Field>
        <Field label="Reps">
          <NumberInput
            value={deadlift?.reps}
            min={0}
            onChange={(reps) => set({ deadlift: { ...deadlift, reps } })}
          />
        </Field>
        <Field label={`Weight (${unit})`}>
          <NumberInput
            value={deadlift?.weight}
            min={0}
            step={0.5}
            onChange={(weight) => set({ deadlift: { ...deadlift, weight } })}
          />
        </Field>
      </Exercise>
      <Exercise
        title="Single-leg glute bridge"
        hint={`${p.glutBridge.sets}×${p.glutBridge.reps} per side`}
        done={!!glutBridge}
        onToggle={(done) =>
          set({ glutBridge: done ? { ...p.glutBridge } : undefined })
        }
      >
        <Field label="Sets">
          <NumberInput
            value={glutBridge?.sets}
            min={0}
            onChange={(sets) => set({ glutBridge: { ...glutBridge, sets } })}
          />
        </Field>
        <Field label="Reps / side">
          <NumberInput
            value={glutBridge?.reps}
            min={0}
            onChange={(reps) => set({ glutBridge: { ...glutBridge, reps } })}
          />
        </Field>
      </Exercise>
      <Exercise
        title="Side plank"
        hint={`${p.sidePlank.sets}×30–40 s per side`}
        done={!!sidePlank}
        onToggle={(done) =>
          set({ sidePlank: done ? { ...p.sidePlank } : undefined })
        }
      >
        <Field label="Sets">
          <NumberInput
            value={sidePlank?.sets}
            min={0}
            onChange={(sets) => set({ sidePlank: { ...sidePlank, sets } })}
          />
        </Field>
        <Field label="Seconds / side">
          <NumberInput
            value={sidePlank?.seconds}
            min={0}
            onChange={(seconds) => set({ sidePlank: { ...sidePlank, seconds } })}
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
    </>
  );
}
