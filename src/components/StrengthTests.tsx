import { useMemo, useState } from "react";
import { AppData, StrengthTest } from "../types";
import { Actions, newId } from "../lib/storage";
import { bodyweightOnOrBefore, loadPercentBW } from "../lib/calculations";
import { formatDate, pct, signed, todayISO } from "../lib/format";
import { Field, NumberInput } from "./ui";

export default function StrengthTests({
  data,
  actions,
}: {
  data: AppData;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const tests = useMemo(
    () => [...data.strengthTests].sort((a, b) => b.date.localeCompare(a.date)),
    [data.strengthTests],
  );

  return (
    <div>
      <div className="section-title">
        <h2>Strength tests</h2>
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "＋ New test"}
        </button>
      </div>

      {open && (
        <TestForm
          data={data}
          actions={actions}
          onDone={() => setOpen(false)}
        />
      )}

      {tests.length === 0 ? (
        <div className="empty">
          No strength tests logged. These are occasional benchmarks, not every
          session.
        </div>
      ) : (
        tests.map((t) => (
          <TestCard
            key={t.id}
            test={t}
            data={data}
            onDelete={() => actions.deleteStrengthTest(t.id)}
          />
        ))
      )}
    </div>
  );
}

function TestForm({
  data,
  actions,
  onDone,
}: {
  data: AppData;
  actions: Actions;
  onDone: () => void;
}) {
  const unit = data.unit;
  const [date, setDate] = useState(todayISO());
  const [maxPullups, setMaxPullups] = useState<number | undefined>();
  const [w1, setW1] = useState<number | undefined>();
  const [w2, setW2] = useState<number | undefined>();
  const [edge, setEdge] = useState<number | undefined>();
  const [hangAdded, setHangAdded] = useState<number | undefined>();
  const [dur, setDur] = useState<number | undefined>();

  const bw = bodyweightOnOrBefore(data.bodyweights, date);

  function save() {
    const test: StrengthTest = { id: newId(), date };
    if (maxPullups != null) test.maxPullups = maxPullups;
    if (w1 != null) test.weighted1RMAdded = w1;
    if (w2 != null) test.weighted2RMAdded = w2;
    if (edge != null && dur != null) {
      test.maxHang = { edgeMm: edge, addedWeight: hangAdded ?? 0, durationSec: dur };
    }
    actions.upsertStrengthTest(test);
    onDone();
  }

  return (
    <div className="card">
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <h3>Pull-ups</h3>
      <div className="grid-2">
        <Field label="Max bodyweight pull-ups (reps)">
          <NumberInput value={maxPullups} onChange={setMaxPullups} min={0} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label={`Weighted 1RM added (${unit})`}>
          <NumberInput value={w1} onChange={setW1} step={0.5} />
        </Field>
        <Field label={`Weighted 2RM added (${unit})`}>
          <NumberInput value={w2} onChange={setW2} step={0.5} />
        </Field>
      </div>
      {bw && (w1 != null || w2 != null) && (
        <div className="calc">
          {w1 != null && (
            <>
              1RM = <strong>{pct(loadPercentBW(bw.weight, w1))} BW</strong>
            </>
          )}
          {w1 != null && w2 != null && " · "}
          {w2 != null && (
            <>
              2RM = <strong>{pct(loadPercentBW(bw.weight, w2))} BW</strong>
            </>
          )}
        </div>
      )}

      <h3>Max hang test</h3>
      <div className="row">
        <Field label="Edge (mm)">
          <NumberInput value={edge} onChange={setEdge} min={1} />
        </Field>
        <Field label={`Added (${unit})`}>
          <NumberInput value={hangAdded} onChange={setHangAdded} step={0.5} />
        </Field>
        <Field label="Duration (s)">
          <NumberInput value={dur} onChange={setDur} min={0} />
        </Field>
      </div>
      {bw && edge != null && hangAdded != null && (
        <div className="calc">
          Max hang load ={" "}
          <strong>{pct(loadPercentBW(bw.weight, hangAdded))} BW</strong>
        </div>
      )}

      <div className="btn-row">
        <button className="btn primary block" onClick={save}>
          Save test
        </button>
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TestCard({
  test,
  data,
  onDelete,
}: {
  test: StrengthTest;
  data: AppData;
  onDelete: () => void;
}) {
  const unit = data.unit;
  const bw = bodyweightOnOrBefore(data.bodyweights, test.date);

  return (
    <div className="entry">
      <div className="entry-head">
        <span className="date">{formatDate(test.date)}</span>
      </div>
      <div className="entry-meta">
        {test.maxPullups != null && (
          <span>
            Max pull-ups: <b>{test.maxPullups}</b>
          </span>
        )}
        {test.weighted1RMAdded != null && (
          <span>
            1RM: <b>{signed(test.weighted1RMAdded, unit)}</b>
            {bw && ` · ${pct(loadPercentBW(bw.weight, test.weighted1RMAdded))} BW`}
          </span>
        )}
        {test.weighted2RMAdded != null && (
          <span>
            2RM: <b>{signed(test.weighted2RMAdded, unit)}</b>
            {bw && ` · ${pct(loadPercentBW(bw.weight, test.weighted2RMAdded))} BW`}
          </span>
        )}
        {test.maxHang && (
          <span>
            Max hang:{" "}
            <b>
              {test.maxHang.edgeMm}mm {signed(test.maxHang.addedWeight, unit)} ·{" "}
              {test.maxHang.durationSec}s
            </b>
            {bw &&
              ` · ${pct(loadPercentBW(bw.weight, test.maxHang.addedWeight))} BW`}
          </span>
        )}
      </div>
      <div className="entry-actions">
        <button className="btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
