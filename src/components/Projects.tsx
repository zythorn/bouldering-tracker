import { useMemo, useState } from "react";
import { AppData, BoulderTag, TrackedProject } from "../types";
import { Actions, newId } from "../lib/storage";
import {
  PROJECT_IDLE_DAYS,
  ProjectStats,
  ProjectStatus,
  TAG_GROUPS,
  TAG_LABELS,
  attemptsText,
  plural,
  projectStats,
  projectStatus,
} from "../lib/boulders";
import { shortDate, todayISO } from "../lib/format";
import { ChipToggle, Field } from "./ui";

type Filter = "active" | "sent" | "inactive";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "sent", label: "Sent" },
  { value: "inactive", label: "Inactive" },
];

function matches(filter: Filter, status: ProjectStatus): boolean {
  if (filter === "active") return status === "open";
  if (filter === "sent") return status === "sent";
  return status === "idle" || status === "retired";
}

export default function Projects({
  data,
  actions,
}: {
  data: AppData;
  actions: Actions;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<TrackedProject>();

  const rows = useMemo(() => {
    const today = todayISO();
    return data.projects
      .map((p) => {
        const stats = projectStats(data.sessions, p.id);
        return { p, stats, status: projectStatus(p, stats, today) };
      })
      .sort((a, b) =>
        (b.stats.lastWorked ?? b.p.createdDate).localeCompare(
          a.stats.lastWorked ?? a.p.createdDate,
        ),
      );
  }, [data.projects, data.sessions]);

  const shown = rows.filter((r) => matches(filter, r.status));

  return (
    <div>
      <div className="filter-bar" style={{ alignItems: "center" }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "active" : ""}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({rows.filter((r) => matches(f.value, r.status)).length})
          </button>
        ))}
        <button
          style={{ marginLeft: "auto" }}
          onClick={() =>
            setEditing({
              id: newId(),
              name: "",
              tags: [],
              createdDate: todayISO(),
            })
          }
        >
          ＋ New
        </button>
      </div>

      {editing && !data.projects.some((p) => p.id === editing.id) && (
        <ProjectForm
          data={data}
          project={editing}
          onSave={(p) => {
            actions.upsertProject(p);
            setEditing(undefined);
            setFilter("active");
          }}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {shown.length === 0 ? (
        <div className="empty">
          {filter === "active"
            ? "No active projects. Mark a boulder “Not sent” while logging and tap “Track as project”."
            : "Nothing here yet."}
        </div>
      ) : (
        shown.map(({ p, stats, status }) =>
          editing?.id === p.id ? (
            <ProjectForm
              key={p.id}
              data={data}
              project={editing}
              onSave={(next) => {
                actions.upsertProject(next);
                setEditing(undefined);
              }}
              onCancel={() => setEditing(undefined)}
            />
          ) : (
            <ProjectCard
              key={p.id}
              project={p}
              stats={stats}
              status={status}
              onEdit={() => setEditing(p)}
              onToggleRetired={() =>
                actions.upsertProject({ ...p, retired: !p.retired })
              }
              onDelete={() => {
                if (
                  confirm(
                    `Delete “${p.name}”? Its boulders stay in your sessions, just no longer linked to a project.`,
                  )
                )
                  actions.deleteProject(p.id);
              }}
            />
          ),
        )
      )}
    </div>
  );
}

function ProjectCard({
  project,
  stats,
  status,
  onEdit,
  onToggleRetired,
  onDelete,
}: {
  project: TrackedProject;
  stats: ProjectStats;
  status: ProjectStatus;
  onEdit: () => void;
  onToggleRetired: () => void;
  onDelete: () => void;
}) {
  const attempts = attemptsText(stats);

  return (
    <div className="entry">
      <div className="entry-head">
        <span className="date">{project.name}</span>
        <span className="badges">
          {project.grade && <span className="badge">{project.grade}</span>}
          {project.gym && <span className="badge gym">📍 {project.gym}</span>}
        </span>
      </div>

      <div className="entry-meta">
        {stats.sessions > 0 ? (
          <span>
            <b>{plural(stats.sessions, "session")}</b>
            {attempts && (
              <>
                {" "}
                · <b>{attempts}</b>
              </>
            )}{" "}
            · last worked {shortDate(stats.lastWorked!)}
          </span>
        ) : (
          <span>Not worked yet · added {shortDate(project.createdDate)}</span>
        )}
        {project.tags.length > 0 && (
          <span>{project.tags.map((t) => TAG_LABELS[t]).join(", ")}</span>
        )}
      </div>

      {status === "sent" && (
        <div className="project-line sent">
          🎉 Sent {shortDate(stats.sentDate!)}
          {attempts && (
            <>
              {" "}
              after <b>{attempts}</b>
            </>
          )}
        </div>
      )}
      {status === "idle" && (
        <p className="hint" style={{ marginTop: 8 }}>
          Not worked in {PROJECT_IDLE_DAYS / 7}+ weeks, so it's hidden from the
          picker. Log it again (under “Not worked in 6+ weeks”) to revive it.
        </p>
      )}
      {status === "retired" && (
        <p className="hint" style={{ marginTop: 8 }}>
          Retired.
        </p>
      )}

      <div className="entry-actions">
        <button className="btn ghost" onClick={onEdit}>
          Edit
        </button>
        {status !== "sent" && (
          <button className="btn ghost" onClick={onToggleRetired}>
            {project.retired ? "Restore" : "Retire"}
          </button>
        )}
        <button className="btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function ProjectForm({
  data,
  project,
  onSave,
  onCancel,
}: {
  data: AppData;
  project: TrackedProject;
  onSave: (p: TrackedProject) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [grade, setGrade] = useState(project.grade ?? "");
  const [gym, setGym] = useState(project.gym ?? "");
  const [tags, setTags] = useState<BoulderTag[]>(project.tags);

  const gradeOptions =
    grade && !data.grades.includes(grade) ? [grade, ...data.grades] : data.grades;
  const gymOptions =
    gym && !data.gyms.includes(gym) ? [gym, ...data.gyms] : data.gyms;

  function toggleTag(t: BoulderTag) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  return (
    <div className="card">
      <Field label="Name">
        <input
          autoFocus
          value={name}
          placeholder="e.g. red roof in the cave"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="grid-2">
        <Field label="Grade">
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">—</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gym">
          <select value={gym} onChange={(e) => setGym(e.target.value)}>
            <option value="">—</option>
            {gymOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {TAG_GROUPS.map((group) => (
        <Field key={group.label} label={group.label}>
          <div className="chip-row">
            {group.tags.map((t) => (
              <ChipToggle
                key={t.value}
                active={tags.includes(t.value)}
                onClick={() => toggleTag(t.value)}
              >
                {t.label}
              </ChipToggle>
            ))}
          </div>
        </Field>
      ))}
      <div className="btn-row">
        <button
          className="btn primary block"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              ...project,
              name: name.trim(),
              grade: grade || undefined,
              gym: gym || undefined,
              tags,
            })
          }
        >
          Save project
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
