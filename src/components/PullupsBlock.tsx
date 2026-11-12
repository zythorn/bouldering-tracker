import { AppData } from "../types";
import { bodyweightOnOrBefore, loadPercentBW } from "../lib/calculations";
import { pct } from "../lib/format";
import { NumberInput } from "./ui";
import { PullupDraft, PullupSetDraft } from "./blockDraft";

/** Pull-ups, one row per set: reps and (optional, signed) added weight. */
export default function PullupsBlock({
  block,
  onChange,
  data,
  date,
}: {
  block: PullupDraft;
  onChange: (b: PullupDraft) => void;
  data: AppData;
  date: string;
}) {
  const unit = data.unit;
  const bw = bodyweightOnOrBefore(data.bodyweights, date);
  const sets = block.sets;

  function setSet(i: number, patch: Partial<PullupSetDraft>) {
    onChange({
      ...block,
      sets: sets.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  }

  function addSet() {
    // Start from the previous set's numbers; most sets repeat them.
    const last = sets[sets.length - 1] ?? {};
    onChange({ ...block, sets: [...sets, { ...last }] });
  }

  function removeSet(i: number) {
    onChange({ ...block, sets: sets.filter((_, j) => j !== i) });
  }

  return (
    <>
      <div className="set-grid">
        <span className="set-head">Set</span>
        <span className="set-head">Reps</span>
        <span className="set-head">Added ({unit})</span>
        <span />
        {sets.map((s, i) => (
          <SetRow
            key={i}
            n={i + 1}
            set={s}
            load={
              bw && s.addedWeight
                ? loadPercentBW(bw.weight, s.addedWeight)
                : undefined
            }
            onChange={(patch) => setSet(i, patch)}
            onRemove={sets.length > 1 ? () => removeSet(i) : undefined}
          />
        ))}
      </div>
      <button type="button" className="btn ghost add-set" onClick={addSet}>
        ＋ Add set
      </button>
      <p className="hint" style={{ marginTop: 6 }}>
        Leave added weight empty for bodyweight; use a negative number for
        assistance. Sets without reps aren't saved.
      </p>
    </>
  );
}

function SetRow({
  n,
  set,
  load,
  onChange,
  onRemove,
}: {
  n: number;
  set: PullupSetDraft;
  load?: number;
  onChange: (patch: Partial<PullupSetDraft>) => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <span className="set-n">
        {n}
        {load != null && <span className="sub-num">{pct(load)} BW</span>}
      </span>
      <NumberInput
        label={`set ${n} reps`}
        value={set.reps}
        onChange={(reps) => onChange({ reps })}
        min={0}
        placeholder="reps"
      />
      <NumberInput
        label={`set ${n} added weight`}
        value={set.addedWeight}
        onChange={(addedWeight) => onChange({ addedWeight })}
        step={0.5}
        placeholder="0"
      />
      {onRemove ? (
        <button
          type="button"
          className="btn danger set-remove"
          aria-label={`remove set ${n}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : (
        <span />
      )}
    </>
  );
}
