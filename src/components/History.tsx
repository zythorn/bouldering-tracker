import { useMemo, useState } from "react";
import {
  AppData,
  Block,
  BlockKind,
  BoulderLog,
  PullupSet,
  Session,
  SessionType,
} from "../types";
import { Actions } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  loadPercentBW,
  sessionBoulders,
  sessionTypes,
} from "../lib/calculations";
import { BLOCK_KINDS, hasBlock } from "../lib/blocks";
import { describePain, hasPainCheck, painAlerts } from "../lib/pain";
import { prescriptionGaps } from "../lib/strength";
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

type Filter = "all" | BlockKind | "compressed-rest";

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
  // Effective normal/compressed-rest per session with hangs (from dates).
  const types = useMemo(() => sessionTypes(data.sessions), [data.sessions]);

  const shown = sessions.filter((s) => {
    if (filter === "all") return true;
    if (filter === "compressed-rest")
      return types.get(s.id) === "compressed-rest";
    return hasBlock(s, filter);
  });

  // Only offer filters that match something.
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    ...BLOCK_KINDS.filter((k) => sessions.some((s) => hasBlock(s, k.kind))).map(
      (k) => ({ value: k.kind as Filter, label: k.label }),
    ),
    ...([...types.values()].includes("compressed-rest")
      ? [{ value: "compressed-rest" as Filter, label: "Compressed" }]
      : []),
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
            sessionType={types.get(s.id)}
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
  sessionType,
  data,
  onEdit,
  onDelete,
}: {
  session: Session;
  sessionType?: SessionType; // effective type, sessions with hangs only
  data: AppData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Detailed boulders can make a card long, so they start collapsed.
  const [showBoulders, setShowBoulders] = useState(false);
  const boulders = sessionBoulders(session);
  // Project sends stay visible in the collapsed summary.
  const projectSends = boulders.filter(
    (b) => isSend(b) && data.projects.some((p) => p.id === b.projectId),
  ).length;
  const painFlagged = painAlerts(session.pain).length > 0;

  return (
    <div className={`entry ${painFlagged ? "pain-flagged" : ""}`}>
      <div className="entry-head">
        <span className="date">{formatDate(session.date)}</span>
        <span className="badges">
          {session.gym && <span className="badge gym">📍 {session.gym}</span>}
          {session.rpe != null && (
            <span className="badge">
              RPE {session.rpe} · {RPE_LABELS[session.rpe]}
            </span>
          )}
          {session.durationMin != null && (
            <span className="badge">⏱ {session.durationMin} min</span>
          )}
          {sessionType === "compressed-rest" && (
            <span className="badge compressed">Compressed rest</span>
          )}
        </span>
      </div>

      {session.blocks.length > 0 ? (
        <div className="entry-blocks">
          {session.blocks.map((b) => (
            <BlockSummary key={b.kind} block={b} session={session} data={data} />
          ))}
        </div>
      ) : (
        <div className="entry-meta muted">No blocks logged</div>
      )}
      {session.notes && <div className="entry-notes">{session.notes}</div>}

      {session.pain && hasPainCheck(session.pain) && (
        <div className={`pain-line ${painFlagged ? "flagged" : ""}`}>
          {painFlagged ? "⚠️ " : ""}Pain: {describePain(session.pain)}
        </div>
      )}

      {boulders.length > 0 && (
        <>
          <button
            type="button"
            className="details-toggle"
            aria-expanded={showBoulders}
            onClick={() => setShowBoulders((s) => !s)}
          >
            {showBoulders
              ? "▾ Hide boulder details"
              : `▸ ${plural(boulders.length, "boulder")} in detail`}
            {!showBoulders && projectSends > 0 && (
              <span className="sent-note">
                {" "}
                · 🎉 {plural(projectSends, "project")} sent
              </span>
            )}
          </button>
          {showBoulders && (
            <div className="boulder-list">
              {boulders.map((b) => (
                <LoggedBoulder
                  key={b.id}
                  log={b}
                  session={session}
                  data={data}
                />
              ))}
            </div>
          )}
        </>
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

/** "3×8 · 2×5 @ +10 kg": consecutive identical sets are grouped. */
function describeSets(sets: PullupSet[], unit: string): string {
  const groups: { n: number; set: PullupSet }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.set.reps === s.reps && last.set.addedWeight === s.addedWeight)
      last.n += 1;
    else groups.push({ n: 1, set: s });
  }
  return groups
    .map(
      ({ n, set }) =>
        (n > 1 ? `${n}×${set.reps}` : `${set.reps}`) +
        (set.addedWeight ? ` @ ${signed(set.addedWeight, unit)}` : ""),
    )
    .join(" · ");
}

/** One line per block in a session card. */
function BlockSummary({
  block,
  session,
  data,
}: {
  block: Block;
  session: Session;
  data: AppData;
}) {
  const unit = data.unit;
  switch (block.kind) {
    case "bouldering": {
      const sends = block.grades.filter((g) => g.count > 0);
      return (
        <div className="entry-meta">
          <span>
            Boulders:{" "}
            {sends.length ? (
              <b>{sends.map((g) => `${g.grade}×${g.count}`).join("  ")}</b>
            ) : (
              <span className="muted">no sends</span>
            )}
          </span>
        </div>
      );
    }
    case "hangs": {
      const bw = bodyweightOnOrBefore(data.bodyweights, session.date);
      const load = bw ? loadPercentBW(bw.weight, block.addedWeight) : undefined;
      return (
        <div className="entry-meta">
          <span>
            Hangs:{" "}
            <b>
              {block.edgeMm}mm {signed(block.addedWeight, unit)}
            </b>
            {load != null && <> · {pct(load)} BW</>} · {block.setsCompleted}/
            {block.setsIntended} sets
          </span>
        </div>
      );
    }
    case "corehip": {
      const gaps = prescriptionGaps(block, unit);
      const { deadlift: dl, glutBridge: gb, sidePlank: sp } = block;
      const done = [
        block.breathing && "breathing ✓",
        dl &&
          `deadlift ${dl.sets ?? "?"}×${dl.reps ?? "?"}` +
            (dl.weight != null ? ` @ ${dl.weight} ${unit}` : ""),
        gb && `glute bridge ${gb.sets ?? "?"}×${gb.reps ?? "?"}/side`,
        sp && `side plank ${sp.sets ?? "?"}×${sp.seconds ?? "?"} s/side`,
      ].filter(Boolean);
      return (
        <>
          <div className="entry-meta">
            <span>
              Core/hip: {done.length ? done.join(" · ") : "nothing ticked"}
            </span>
          </div>
          <div className={`prescribed ${gaps.length ? "" : "ok"}`}>
            {gaps.length
              ? `Short of prescription: ${gaps.join(", ")}`
              : "✓ As prescribed"}
          </div>
        </>
      );
    }
    case "pullups":
      return (
        <div className="entry-meta">
          <span>
            Pull-ups:{" "}
            <b>{describeSets(block.sets, unit)}</b>
          </span>
        </div>
      );
  }
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
