import { useMemo, useState } from "react";
import { AppData, Session } from "../types";
import { Actions } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  loadPercentBW,
  totalBoulders,
} from "../lib/calculations";
import { formatDate, pct, signed } from "../lib/format";

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
      <div className="section-title">
        <h2>History</h2>
        <span className="muted">{sessions.length} sessions</span>
      </div>

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

      {session.project && (
        <div className={`project-line ${session.project.sent ? "sent" : ""}`}>
          {session.project.sent ? "🎉 Project sent" : "🧗 Project"}:{" "}
          <b>{session.project.name}</b>
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
