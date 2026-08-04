import { useMemo, useState } from "react";
import { AppData } from "../types";
import { Actions, newId } from "../lib/storage";
import { formatDate, todayISO } from "../lib/format";
import { Field, NumberInput } from "./ui";

export default function Bodyweight({
  data,
  actions,
}: {
  data: AppData;
  actions: Actions;
}) {
  const unit = data.unit;
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState<number | undefined>();

  const entries = useMemo(
    () => [...data.bodyweights].sort((a, b) => b.date.localeCompare(a.date)),
    [data.bodyweights],
  );

  function add() {
    if (weight == null) return;
    actions.upsertBodyweight({ id: newId(), date, weight });
    setWeight(undefined);
  }

  return (
    <div>
      <div className="section-title">
        <h2>Bodyweight</h2>
        {entries[0] && (
          <span className="muted">
            Latest: {entries[0].weight}
            {unit}
          </span>
        )}
      </div>

      <div className="card">
        <div className="row">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={`Weight (${unit})`}>
            <NumberInput value={weight} onChange={setWeight} step={0.1} />
          </Field>
        </div>
        <button className="btn primary block" onClick={add} disabled={weight == null}>
          Add entry
        </button>
        <p className="hint" style={{ marginTop: 8 }}>
          The most recent entry on or before a session's date is used for its
          %bodyweight calculations.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="empty">No bodyweight entries yet.</div>
      ) : (
        entries.map((e) => (
          <div className="entry" key={e.id}>
            <div className="entry-head">
              <span className="date">{formatDate(e.date)}</span>
              <b>
                {e.weight}
                {unit}
              </b>
            </div>
            <div className="entry-actions">
              <button
                className="btn danger"
                onClick={() => actions.deleteBodyweight(e.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
