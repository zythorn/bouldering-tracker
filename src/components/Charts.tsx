import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppData } from "../types";
import {
  bodyweightOnOrBefore,
  isWorkday,
  loadPercentBW,
} from "../lib/calculations";
import { gradeFill } from "../lib/colors";
import { round, shortDate } from "../lib/format";

const PALETTE = [
  "#4cc38a",
  "#6ba7e5",
  "#d9a441",
  "#e5825b",
  "#b77de5",
  "#5be5c8",
  "#e55b8b",
];

function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const axis = { stroke: "#8b98a9", fontSize: 11 };
const grid = "#2e3947";

const tooltipStyle = {
  background: "#1a212b",
  border: "1px solid #2e3947",
  borderRadius: 8,
  fontSize: 12,
  color: "#e6edf3",
};

export default function Charts({ data }: { data: AppData }) {
  const hasHangs = data.sessions.some((s) => isWorkday(s) && s.mainHang);
  const hasGrades = data.sessions.some((s) =>
    (s.grades ?? []).some((g) => g.count > 0),
  );
  const hasTests = data.strengthTests.length > 0;

  if (!hasHangs && !hasGrades && !hasTests) {
    return (
      <div>
        <div className="section-title">
          <h2>Trends</h2>
        </div>
        <div className="empty">
          Log a few sessions and the charts will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">
        <h2>Trends</h2>
      </div>
      {hasHangs && <HangboardChart data={data} />}
      {hasGrades && <GradeVolumeChart data={data} />}
      {hasTests && <PullupChart data={data} />}
    </div>
  );
}

/** Hangboard load (%BW) over time, one colour-coded (smoothed) line per edge. */
function HangboardChart({ data }: { data: AppData }) {
  const { rows, series, edges } = useMemo(() => {
    // Merge every logged main hang into rows keyed by timestamp, with one
    // column per edge size (e.g. "20", "33"). Missing edges are left undefined
    // so each line bridges its own gaps via connectNulls.
    const rowMap = new Map<number, Record<string, number>>();
    const edgeSet = new Set<number>();
    for (const s of data.sessions) {
      if (!isWorkday(s) || !s.mainHang) continue;
      const bw = bodyweightOnOrBefore(data.bodyweights, s.date);
      if (!bw) continue;
      const load = round(loadPercentBW(bw.weight, s.mainHang.addedWeight));
      const ts = new Date(s.date).getTime();
      edgeSet.add(s.mainHang.edgeMm);
      const row = rowMap.get(ts) ?? { ts };
      row[String(s.mainHang.edgeMm)] = load;
      rowMap.set(ts, row);
    }
    const rowList = [...rowMap.values()].sort((a, b) => a.ts - b.ts);
    const edgeList = [...edgeSet].sort((a, b) => b - a); // larger edge first
    const seriesData = edgeList.map((edge, i) => ({
      edge,
      key: String(edge),
      color: colorFor(i),
    }));
    return { rows: rowList, series: seriesData, edges: edgeList };
  }, [data]);

  return (
    <div className="card">
      <h2>Hangboard load (%BW)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 4, left: -8 }}
          >
            <CartesianGrid stroke={grid} />
            <XAxis
              type="number"
              dataKey="ts"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) =>
                shortDate(new Date(ts).toISOString().slice(0, 10))
              }
              tick={axis}
              stroke={grid}
            />
            <YAxis
              tick={axis}
              stroke={grid}
              unit="%"
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: grid }}
              labelFormatter={(ts) =>
                shortDate(new Date(Number(ts)).toISOString().slice(0, 10))
              }
              formatter={(v: number, name: string) => [`${v}% BW`, `${name}mm`]}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={String(s.edge)}
                stroke={s.color}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.edge}>
            <span className="swatch" style={{ background: s.color }} />
            {s.edge}mm
          </span>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Loads are only comparable within the same edge size, so each edge
        ({edges.join(", ")}mm) is its own line.
      </p>
    </div>
  );
}

/** Grade volume over time — a stacked bar per session. */
function GradeVolumeChart({ data }: { data: AppData }) {
  const { rows, grades } = useMemo(() => {
    const gradeSet = new Set<string>();
    const rowList = data.sessions
      .filter((s) => (s.grades ?? []).some((g) => g.count > 0))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const row: Record<string, number | string> = { date: shortDate(s.date) };
        for (const g of s.grades ?? []) {
          if (g.count > 0) {
            row[g.grade] = g.count;
            gradeSet.add(g.grade);
          }
        }
        return row;
      });
    // Keep a stable, sorted grade order for the stack.
    const gradeList = [...gradeSet].sort();
    return { rows: rowList, grades: gradeList };
  }, [data]);

  return (
    <div className="card">
      <h2>Grade volume per session</h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={axis} stroke={grid} />
            <YAxis tick={axis} stroke={grid} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff10" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {grades.map((g, i) => (
              <Bar
                key={g}
                dataKey={g}
                stackId="grades"
                fill={gradeFill(g, data.gradeColors, data.grades)}
                stroke="#0f1419"
                strokeWidth={1}
                radius={i === grades.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Sparse pull-up strength trend from periodic strength tests. */
function PullupChart({ data }: { data: AppData }) {
  const rows = useMemo(() => {
    return [...data.strengthTests]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => {
        const bw = bodyweightOnOrBefore(data.bodyweights, t.date);
        return {
          date: shortDate(t.date),
          maxPullups: t.maxPullups ?? null,
          oneRM:
            bw && t.weighted1RMAdded != null
              ? round(loadPercentBW(bw.weight, t.weighted1RMAdded))
              : null,
        };
      });
  }, [data]);

  return (
    <div className="card">
      <h2>Pull-up strength</h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={grid} />
            <XAxis dataKey="date" tick={axis} stroke={grid} />
            <YAxis
              yAxisId="reps"
              tick={axis}
              stroke={grid}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={axis}
              stroke={grid}
              unit="%"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="reps"
              type="monotone"
              dataKey="maxPullups"
              name="Max pull-ups (reps)"
              stroke={colorFor(0)}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="oneRM"
              name="Weighted 1RM (%BW)"
              stroke={colorFor(1)}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
