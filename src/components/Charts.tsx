import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppData } from "../types";
import { Actions } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  hangSessions,
  loadPercentBW,
  sessionGrades,
} from "../lib/calculations";
import { gradeFill } from "../lib/colors";
import { PAIN_AREAS, PAIN_STOP, hasPainCheck } from "../lib/pain";
import {
  CHART_RANGES,
  ChartRange,
  GymRow,
  TABLE_PERIODS,
  TablePeriod,
  gradeFilterIncludes,
  gradeFilterOptions,
  gymGradeTable,
  rangeStart,
} from "../lib/trends";
import {
  MIN_TAG_SAMPLE,
  Summary,
  collectBoulders,
  gradeSummaries,
  mean,
  median,
  rpeRows,
  tagSummaries,
} from "../lib/stats";
import { RPE_LABELS, TAG_LABELS } from "../lib/boulders";
import { round, shortDate, todayISO } from "../lib/format";
import { ChipToggle, Segmented } from "./ui";

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

export default function Charts({
  data,
  actions,
}: {
  data: AppData;
  actions: Actions;
}) {
  const hasHangs = hangSessions(data.sessions).length > 0;
  const hasGrades = data.sessions.some((s) =>
    sessionGrades(s).some((g) => g.count > 0),
  );
  const hasPain = data.sessions.some((s) => hasPainCheck(s.pain));
  const hasTests = data.strengthTests.length > 0;
  const hasBoulders = collectBoulders(data.sessions, data.projects).length > 0;
  const hasRpe = data.sessions.some((s) => s.rpe != null);

  if (!hasHangs && !hasGrades && !hasPain && !hasTests && !hasRpe) {
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
      {hasGrades && <GradeVolumeChart data={data} />}
      {hasGrades && <GymGradeTable data={data} actions={actions} />}
      {hasBoulders && <BoulderStats data={data} />}
      {hasRpe && <RpeChart data={data} />}
      {hasPain && <PainChart data={data} />}
      {/* Hangs are paused, so this sits below the bouldering charts. */}
      {hasHangs && <HangboardChart data={data} />}
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
    for (const { session: s, hang } of hangSessions(data.sessions)) {
      const bw = bodyweightOnOrBefore(data.bodyweights, s.date);
      if (!bw) continue;
      const load = round(loadPercentBW(bw.weight, hang.addedWeight));
      const ts = new Date(s.date).getTime();
      edgeSet.add(hang.edgeMm);
      const row = rowMap.get(ts) ?? { ts };
      row[String(hang.edgeMm)] = load;
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

/**
 * Grade volume over time — a stacked bar per session. A gym filter lets
 * progress be compared within one gym, without differences between gyms.
 */
function GradeVolumeChart({ data }: { data: AppData }) {
  const [range, setRange] = useState<ChartRange>("3m");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [gym, setGym] = useState(""); // "" = all gyms

  // Gyms that actually have graded sessions, so the filter never offers an
  // empty view.
  const gymOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of data.sessions) {
      if (s.gym && sessionGrades(s).some((g) => g.count > 0))
        set.add(s.gym);
    }
    return [...set].sort();
  }, [data.sessions]);

  const gradeOptions = useMemo(
    () => gradeFilterOptions(data.grades),
    [data.grades],
  );

  const { rows, grades, sends } = useMemo(() => {
    const from = rangeStart(range, todayISO());
    const includes = gradeFilterIncludes(gradeFilter, data.grades);
    const gradeSet = new Set<string>();
    let total = 0;
    // Every session with sends stays on the axis, even with none in the
    // chosen grades, so "V5 and up" also shows how often they happen.
    const rowList = data.sessions
      .filter((s) => sessionGrades(s).some((g) => g.count > 0))
      .filter((s) => !from || s.date >= from)
      .filter((s) => !gym || s.gym === gym)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const row: Record<string, number | string> = { date: shortDate(s.date) };
        for (const g of sessionGrades(s)) {
          if (g.count > 0 && includes(g.grade)) {
            row[g.grade] = g.count;
            gradeSet.add(g.grade);
            total += g.count;
          }
        }
        return row;
      });
    // Stack in the user's grade order (easiest at the bottom).
    const rank = (g: string) => {
      const i = data.grades.indexOf(g);
      return i < 0 ? data.grades.length : i;
    };
    const gradeList = [...gradeSet].sort((a, b) => rank(a) - rank(b));
    return { rows: rowList, grades: gradeList, sends: total };
  }, [data, range, gradeFilter, gym]);

  const gradeLabel =
    gradeFilter === "all"
      ? ""
      : ` ${gradeOptions.find((o) => o.value === gradeFilter)?.label ?? ""}`;

  return (
    <div className="card">
      <h2>Grade volume per session</h2>
      <div className="chart-controls">
        <select
          className="compact"
          aria-label="Time range"
          value={range}
          onChange={(e) => setRange(e.target.value as ChartRange)}
        >
          {CHART_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          className="compact"
          aria-label="Grades shown"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          {gradeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {gymOptions.length > 0 && (
          <select
            className="compact"
            aria-label="Filter by gym"
            value={gym}
            onChange={(e) => setGym(e.target.value)}
          >
            <option value="">All gyms</option>
            {gymOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="hint" style={{ margin: "0 0 8px" }}>
        {rows.length} sessions · {sends}
        {gradeLabel} sends
        {gym && <> at {gym} (sessions without a gym are left out)</>}
      </p>
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

/**
 * Sends per grade at each gym for a calendar period, with each gym's session
 * count for context. Grade columns can be hidden (e.g. warm-up grades); the
 * choice is saved with the data and Total only counts the visible grades.
 */
function GymGradeTable({ data, actions }: { data: AppData; actions: Actions }) {
  const [period, setPeriod] = useState<TablePeriod>("month");
  const table = useMemo(
    () => gymGradeTable(data.sessions, data.grades, period, todayISO()),
    [data.sessions, data.grades, period],
  );

  const hidden = new Set(data.tableHiddenGrades ?? []);
  // Offer every configured grade as a toggle, plus any others in this period.
  const toggleable = [
    ...data.grades,
    ...table.grades.filter((g) => !data.grades.includes(g)),
  ];
  const shown = table.grades.filter((g) => !hidden.has(g));

  function toggleGrade(g: string) {
    const next = new Set(hidden);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    actions.setTableHiddenGrades([...next]);
  }

  const rowTotal = (r: GymRow) => shown.reduce((n, g) => n + (r.counts[g] ?? 0), 0);
  const cell = (n?: number) =>
    n ? n : <span className="muted">–</span>;
  const rows = table.noGym ? [...table.rows, table.noGym] : table.rows;
  const periodLabel = TABLE_PERIODS.find((p) => p.value === period)!.label;

  return (
    <div className="card">
      <h2>Sends by gym</h2>
      <Segmented value={period} onChange={setPeriod} options={TABLE_PERIODS} />
      <div className="chip-row" style={{ margin: "10px 0" }}>
        <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
          Show:
        </span>
        {toggleable.map((g) => (
          <ChipToggle
            key={g}
            active={!hidden.has(g)}
            label={`Show ${g} column`}
            onClick={() => toggleGrade(g)}
          >
            {g}
          </ChipToggle>
        ))}
      </div>

      {table.total.sessions === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}>
          No climbing sessions {periodLabel.toLowerCase()} yet.
        </div>
      ) : (
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th title="Climbing sessions">Sess.</th>
                {shown.map((g) => (
                  <th key={g}>{g}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gym} className={r === table.noGym ? "muted-row" : ""}>
                  <td>{r.gym}</td>
                  <td className="muted">{r.sessions}</td>
                  {shown.map((g) => (
                    <td key={g}>{cell(r.counts[g])}</td>
                  ))}
                  <td>
                    <b>{cell(rowTotal(r))}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{table.total.sessions}</td>
                {shown.map((g) => (
                  <td key={g}>{cell(table.total.counts[g])}</td>
                ))}
                <td>{cell(rowTotal(table.total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Median attempts to send, with the average underneath when it differs. */
function AttemptsCell({ summary }: { summary: Summary }) {
  const m = median(summary.attempts);
  const avg = mean(summary.attempts);
  if (m == null) return <span className="muted">–</span>;
  return (
    <>
      {num(m)}
      {avg != null && Math.abs(avg - m) >= 0.05 && (
        <span className="sub-num">avg {avg.toFixed(1)}</span>
      )}
    </>
  );
}

/**
 * Stats from detailed boulders: per grade (hardest first) and per tag at one
 * grade. Each project counts as one boulder with its attempts summed across
 * sessions; send rate sits next to attempts so unsent boulders aren't hidden.
 */
function BoulderStats({ data }: { data: AppData }) {
  const [range, setRange] = useState<ChartRange>("3m");
  const [tagGrade, setTagGrade] = useState<string>();

  const units = useMemo(
    () =>
      collectBoulders(data.sessions, data.projects, rangeStart(range, todayISO())),
    [data.sessions, data.projects, range],
  );
  const grades = useMemo(
    () => gradeSummaries(units, data.grades),
    [units, data.grades],
  );

  // Default the tag view to the hardest grade with a usable sample.
  const defaultGrade =
    grades.find((g) => g.summary.boulders >= 5)?.grade ?? grades[0]?.grade;
  const shownTagGrade =
    tagGrade && grades.some((g) => g.grade === tagGrade) ? tagGrade : defaultGrade;
  const tags = shownTagGrade ? tagSummaries(units, shownTagGrade) : [];
  const unknownAttempts = units.some((u) => u.sent && u.attempts == null);

  return (
    <div className="card">
      <h2>Boulder stats</h2>
      <div className="chart-controls">
        <select
          className="compact"
          aria-label="Time range"
          value={range}
          onChange={(e) => setRange(e.target.value as ChartRange)}
        >
          {CHART_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {grades.length === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}>
          No boulders logged in detail in this range.
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Boulders</th>
                  <th>Sent</th>
                  <th>Flash</th>
                  <th>Attempts to send</th>
                </tr>
              </thead>
              <tbody>
                {grades.map(({ grade, summary: s }) => (
                  <tr key={grade}>
                    <td>
                      <b>{grade}</b>
                    </td>
                    <td>{s.boulders}</td>
                    <td title={`${s.sent} of ${s.boulders}`}>
                      {pct(s.sent, s.boulders)}
                    </td>
                    <td title={`${s.flashed} of ${s.boulders}`}>
                      {pct(s.flashed, s.boulders)}
                    </td>
                    <td>
                      <AttemptsCell summary={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Based on boulders logged in detail:{" "}
            {grades.map((g) => `${g.grade} ${g.summary.boulders}`).join(" · ")}.
            Each project counts as one boulder, with its attempts added up across
            sessions. Attempts to send: median, with the average below.
            {unknownAttempts &&
              " Projects from before detailed logging have no attempt count, so they only count toward send rates."}
          </p>

          {shownTagGrade && tags.length > 0 && (
            <>
              <div className="card-head" style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0 }}>By tag</h3>
                <select
                  className="compact"
                  aria-label="Grade for tag stats"
                  value={shownTagGrade}
                  onChange={(e) => setTagGrade(e.target.value)}
                >
                  {grades.map((g) => (
                    <option key={g.grade} value={g.grade}>
                      {g.grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Boulders</th>
                      <th>Sent</th>
                      <th>Attempts to send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map(({ tag, summary: s }) => (
                      <tr
                        key={tag}
                        className={s.boulders < MIN_TAG_SAMPLE ? "low-n" : ""}
                      >
                        <td>{TAG_LABELS[tag]}</td>
                        <td>{s.boulders}</td>
                        <td title={`${s.sent} of ${s.boulders}`}>
                          {pct(s.sent, s.boulders)}
                        </td>
                        <td>
                          <AttemptsCell summary={s} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                Weakest first: lowest send rate, then most attempts. Greyed out:
                fewer than {MIN_TAG_SAMPLE} boulders. A boulder with several tags
                counts under each.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Session RPE as dots, with a line through each Mon–Sun week's average. */
function RpeChart({ data }: { data: AppData }) {
  const [range, setRange] = useState<ChartRange>("3m");
  const rows = useMemo(
    () => rpeRows(data.sessions, rangeStart(range, todayISO())),
    [data.sessions, range],
  );
  const color = "#d9a441";

  return (
    <div className="card">
      <h2>Session RPE</h2>
      <div className="chart-controls">
        <select
          className="compact"
          aria-label="Time range"
          value={range}
          onChange={(e) => setRange(e.target.value as ChartRange)}
        >
          {CHART_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <div className="empty" style={{ padding: "20px 0" }}>
          No rated sessions in this range.
        </div>
      ) : (
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -24 }}>
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
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(ts, payload) => {
                  const week = payload?.[0]?.payload?.week as string | undefined;
                  return week
                    ? `Week of ${shortDate(week)}`
                    : shortDate(new Date(Number(ts)).toISOString().slice(0, 10));
                }}
                formatter={(v: number, name: string) => [
                  `${v} · ${RPE_LABELS[Math.round(v)]}`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                dataKey="rpe"
                name="Session"
                stroke="none"
                legendType="circle"
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
              <Line
                dataKey="avg"
                name="Weekly average"
                type="linear"
                stroke="#e6edf3"
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, fill: "#e6edf3", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="hint" style={{ marginTop: 6 }}>
        0 light · 1 easy · 2 moderate · 3 hard · 4 very hard · 5 limit. The line
        is each Monday–Sunday week's average.
      </p>
    </div>
  );
}

const PAIN_COLORS: Record<string, string> = {
  elbow: "#e5825b",
  wrist: "#6ba7e5",
  back: "#b77de5",
};

/**
 * Pain check over time, one line per area, with the plan's stop threshold as
 * a dashed line. Lines are straight (not smoothed) since exact scores matter.
 */
function PainChart({ data }: { data: AppData }) {
  const rows = useMemo(
    () =>
      data.sessions
        .filter((s) => hasPainCheck(s.pain))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({
          date: shortDate(s.date),
          elbow: s.pain!.elbow ?? null,
          wrist: s.pain!.wrist ?? null,
          back: s.pain!.back ?? null,
        })),
    [data.sessions],
  );

  return (
    <div className="card">
      <h2>Pain check</h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -24 }}>
            <CartesianGrid stroke={grid} />
            <XAxis dataKey="date" tick={axis} stroke={grid} />
            <YAxis
              tick={axis}
              stroke={grid}
              domain={[0, 5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              allowDecimals={false}
            />
            <ReferenceLine
              y={PAIN_STOP}
              stroke="#e5534b"
              strokeDasharray="5 4"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {PAIN_AREAS.map((a) => (
              <Line
                key={a.key}
                type="linear"
                dataKey={a.key}
                name={a.label}
                stroke={PAIN_COLORS[a.key]}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, fill: PAIN_COLORS[a.key], strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Dashed line: the plan's stop threshold ({PAIN_STOP}). Only sessions with
        a pain check are plotted.
      </p>
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
