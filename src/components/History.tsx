import { useMemo, useState } from "react";
import { AppData, BoulderLog, Session } from "../types";
import { Actions } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  loadPercentBW,
  totalBoulders,
} from "../lib/calculations";
import {
  RPE_LABELS,
  attemptsText,
  describeLog,
  isSend,
  logAttempts,
  plural,
  projectStats,
} from "../lib/boulders";
import { formatDate, pct, signed } from "../lib/format";
import { Segmented } from "./ui";
import Projects from "./Projects";

type Filter = "all" | "workday" | "weekend" | "compressed-rest";

export default function History({
  data,
  actions,
  onEdit,
}: {
  data: AppData;
  actions: Actions;
  onEdit: (s: Session) => void;
}) {
  const [view, setView] = useState<"sessions" | "projects">("sessions");

  return (
    <div>
      <div className="section-title">
        <h2>History</h2>
      </div>
      <div style={{ margin: "8px 0" }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "sessions", label: `Sessions (${data.sessions.length})` },
            { value: "projects", label: `Projects (${data.projects.length})` },
          ]}
        />
      </div>
      {view === "sessions" ? (
        <SessionList data={data} actions={actions} onEdit={onEdit} />
      ) : (
        <Projects data={data} actions={actions} />
      )}
    </div>
  );
}

function SessionList({
  data,
  actions,
  onEdit,
}: {
  data: AppData;
  actions: Actions;
  onEdit: (s: Session) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const sessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [data.sessions],
  );

  const shown = sessions.filter((s) => {
    if (filter === "all") return true;
    if (filter === "workday") return s.kind === "workday";
    if (filter === "weekend") return s.kind === "weekend";
    if (filter === "compressed-rest")
      return s.kind === "workday" && s.sessionType === "compressed-rest";
    return true;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "workday", label: "Work-day" },
    { value: "weekend", label: "Weekend" },
    { value: "compressed-rest", label: "Compressed" },
  ];

  return (
    <div>
      <div className="filter-bar">
        {filters.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "active" : ""}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">No sessions match this filter yet.</div>
      ) : (
        shown.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            data={data}
            onEdit={() => onEdit(s)}
            onDelete={() => {
              if (confirm("Delete this session?")) actions.deleteSession(s.id);
            }}
          />
        ))
      )}
    </div>
  );
}

function SessionCard({
  session,
  data,
  onEdit,
  onDelete,
}: {
  session: Session;
  data: AppData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unit = data.unit;

  return (
    <div className="entry">
      <div className="entry-head">
        <span className="date">{formatDate(session.date)}</span>
        <span className="badges">
          {session.gym && <span className="badge gym">📍 {session.gym}</span>}
          {session.rpe != null && (
            <span className="badge">
              RPE {session.rpe} · {RPE_LABELS[session.rpe]}
            </span>
          )}
          {session.kind === "weekend" ? (
            <span className="badge weekend">Weekend</span>
          ) : session.sessionType === "compressed-rest" ? (
            <span className="badge compressed">Compressed rest</span>
          ) : (
            <span className="badge">Work-day</span>
          )}
        </span>
      </div>

      {session.kind === "workday" ? (
        <>
          <div className="entry-meta">
            {session.mainHang &&
              (() => {
                const bw = bodyweightOnOrBefore(
                  data.bodyweights,
                  session.date,
                );
                const load = bw
                  ? loadPercentBW(bw.weight, session.mainHang.addedWeight)
                  : undefined;
                return (
                  <span>
                    Hang:{" "}
                    <b>
                      {session.mainHang.edgeMm}mm{" "}
                      {signed(session.mainHang.addedWeight, unit)}
                    </b>
                    {load != null && <> · {pct(load)} BW</>} ·{" "}
                    {session.mainHang.setsCompleted}/
                    {session.mainHang.setsIntended} sets
                  </span>
                );
              })()}
            {totalBoulders(session) > 0 && (
              <span>
                Boulders:{" "}
                <b>
                  {session.grades
                    .filter((g) => g.count > 0)
                    .map((g) => `${g.grade}×${g.count}`)
                    .join("  ")}
                </b>
              </span>
            )}
            {session.accessory && (
              <span>
                {session.accessory.type === "weighted" ? "Weighted" : "BW"}{" "}
                pull-ups:{" "}
                <b>
                  {session.accessory.sets != null &&
                    `${session.accessory.sets} × `}
                  {session.accessory.reps} reps
                </b>
                {session.accessory.type === "weighted" &&
                  session.accessory.addedWeight != null &&
                  ` ${signed(session.accessory.addedWeight, unit)}`}
              </span>
            )}
          </div>
          {session.notes && <div className="entry-notes">{session.notes}</div>}
        </>
      ) : (
        <>
          {session.grades && session.grades.some((g) => g.count > 0) && (
            <div className="entry-meta">
              <span>
                Boulders:{" "}
                <b>
                  {session.grades
                    .filter((g) => g.count > 0)
                    .map((g) => `${g.grade}×${g.count}`)
                    .join("  ")}
                </b>
              </span>
            </div>
          )}
          {session.notes && <div className="entry-notes">{session.notes}</div>}
        </>
      )}

      {session.boulders && session.boulders.length > 0 && (
        <div className="boulder-list">
          {session.boulders.map((b) => (
            <LoggedBoulder key={b.id} log={b} session={session} data={data} />
          ))}
        </div>
      )}

      <div className="entry-actions">
        <button className="btn ghost" onClick={onEdit}>
          Edit
        </button>
        <button className="btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * One detailed boulder in a session card. Project work also shows the running
 * total up to this session, e.g. "5 attempts today · 26 so far over 3 sessions".
 */
function LoggedBoulder({
  log,
  session,
  data,
}: {
  log: BoulderLog;
  session: Session;
  data: AppData;
}) {
  const project = data.projects.find((p) => p.id === log.projectId);
  if (!project) {
    return (
      <div className={`boulder-item ${isSend(log) ? "" : "unsent"}`}>
        {describeLog(log)}
        {log.notes && <div className="muted">{log.notes}</div>}
      </div>
    );
  }

  const sent = isSend(log);
  const sofar = projectStats(data.sessions, project.id, session.date);
  const total = attemptsText(sofar);
  // Entries migrated from the old project field carry no grade or attempts.
  const detail =
    log.grade || logAttempts(log) != null ? describeLog(log) : undefined;

  return (
    <div className={`project-line ${sent ? "sent" : ""}`}>
      {sent ? "🎉 Project sent" : "🧗 Project"}: <b>{project.name}</b>
      {detail && <div>{detail}</div>}
      {total && (
        <div className="muted">
          {sent ? "Took" : "So far"} {total} over{" "}
          {plural(sofar.sessions, "session")}
        </div>
      )}
      {log.notes && <div className="muted">{log.notes}</div>}
    </div>
  );
}
