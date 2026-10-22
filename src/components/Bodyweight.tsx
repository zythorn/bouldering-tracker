import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppData } from "../types";
import { Actions, newId } from "../lib/storage";
import { WEIGH_IN_EVERY_DAYS, daysSinceWeighIn } from "../lib/calculations";
import { formatDate, shortDate, todayISO } from "../lib/format";
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

  const sinceWeighIn = daysSinceWeighIn(data.bodyweights, todayISO());
  const chartRows = [...entries]
    .reverse()
    .map((e) => ({ date: shortDate(e.date), weight: e.weight }));

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

      {sinceWeighIn != null && sinceWeighIn >= WEIGH_IN_EVERY_DAYS && (
        <div className="status-line">
          ⚖️ No weigh-in for {sinceWeighIn} days. Weekly weigh-ins keep %BW
          loads accurate.
        </div>
      )}

      {chartRows.length >= 2 && (
        <div className="card">
          <h2>Trend</h2>
          <div className="chart-wrap" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartRows}
                margin={{ top: 8, right: 12, bottom: 4, left: -18 }}
              >
                <CartesianGrid stroke="#2e3947" />
                <XAxis
                  dataKey="date"
                  tick={{ stroke: "#8b98a9", fontSize: 11 }}
                  stroke="#2e3947"
                />
                <YAxis
                  tick={{ stroke: "#8b98a9", fontSize: 11 }}
                  stroke="#2e3947"
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tickFormatter={(v: number) => String(Math.round(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a212b",
                    border: "1px solid #2e3947",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e6edf3",
                  }}
                  formatter={(v: number) => [`${v} ${unit}`, "Bodyweight"]}
                />
                <Line
                  type="linear"
                  dataKey="weight"
                  stroke="#4cc38a"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#4cc38a", strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
