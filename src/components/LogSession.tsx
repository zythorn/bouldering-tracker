import { useMemo, useState } from "react";
import {
  AppData,
  GradeCount,
  Session,
  SessionType,
  WeekendSession,
  WorkdaySession,
} from "../types";
import { Actions, newId } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  lastProjectName,
  loadPercentBW,
  progressionStatus,
} from "../lib/calculations";
import { pct, signed, todayISO } from "../lib/format";
import { Field, NumberInput, Segmented, Stepper } from "./ui";

/** Gym picker: a select over the saved gyms with an inline "add new" option. */
function GymField({
  gyms,
  value,
  onChange,
  onAddGym,
}: {
  gyms: string[];
  value: string;
  onChange: (v: string) => void;
  onAddGym: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function add() {
    const g = name.trim();
    if (!g) return;
    onAddGym(g);
    onChange(g);
    setName("");
    setAdding(false);
  }

  // Include the current value even if it's no longer in the saved list.
  const options = value && !gyms.includes(value) ? [value, ...gyms] : gyms;

  return (
    <Field label="Gym">
      {adding ? (
        <div className="row">
          <input
            autoFocus
            value={name}
            placeholder="Gym name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            type="button"
            className="btn"
            style={{ flex: "0 0 auto" }}
            onClick={add}
          >
            Add
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ flex: "0 0 auto" }}
            onClick={() => {
              setAdding(false);
              setName("");
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__add__") setAdding(true);
            else onChange(e.target.value);
          }}
        >
          <option value="">—</option>
          {options.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value="__add__">＋ Add new gym…</option>
        </select>
      )}
    </Field>
  );
}

/** Project boulder field: name + "sent" toggle + copy-from-last shortcut. */
function ProjectField({
  name,
  sent,
  onName,
  onSent,
  lastName,
}: {
  name: string;
  sent: boolean;
  onName: (v: string) => void;
  onSent: (v: boolean) => void;
  lastName?: string;
}) {
  return (
    <>
      <h3>Project boulder</h3>
      <div className="row">
        <input
          value={name}
          placeholder="e.g. blue V5 on the cave wall"
          onChange={(e) => onName(e.target.value)}
        />
        {lastName && !name.trim() && (
          <button
            type="button"
            className="btn ghost"
            style={{ flex: "0 0 auto" }}
            title={`Copy: ${lastName}`}
            onClick={() => onName(lastName)}
          >
            Copy last
          </button>
        )}
      </div>
      {name.trim() && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={sent ? "btn primary" : "btn"}
            onClick={() => onSent(!sent)}
          >
            {sent ? "🎉 Project sent" : "Mark as sent"}
          </button>
        </div>
      )}
    </>
  );
}

interface Props {
  data: AppData;
  actions: Actions;
  editing?: Session;
  onDone: () => void;
}

function emptyGrades(grades: string[]): GradeCount[] {
  return grades.map((g) => ({ grade: g, count: 0 }));
}

/** Merge the configured grade list with any counts already on the session. */
function mergeGrades(grades: string[], existing: GradeCount[]): GradeCount[] {
  const byGrade = new Map(existing.map((g) => [g.grade, g.count]));
  const base = grades.map((g) => ({ grade: g, count: byGrade.get(g) ?? 0 }));
  // Keep any grades on the session that aren't in the current config list.
  for (const g of existing) {
    if (!grades.includes(g.grade)) base.push({ ...g });
  }
  return base;
}

export default function LogSession({ data, actions, editing, onDone }: Props) {
  const [kind, setKind] = useState<Session["kind"]>(editing?.kind ?? "workday");

  return (
    <div>
      {!editing && (
        <div className="seg" style={{ marginBottom: 16 }}>
          <button
            className={kind === "workday" ? "active" : ""}
            onClick={() => setKind("workday")}
          >
            Work-day session
          </button>
          <button
            className={kind === "weekend" ? "active" : ""}
            onClick={() => setKind("weekend")}
          >
            Weekend session
          </button>
        </div>
      )}

      {kind === "workday" ? (
        <WorkdayForm
          data={data}
          actions={actions}
          editing={editing?.kind === "workday" ? editing : undefined}
          onDone={onDone}
        />
      ) : (
        <WeekendForm
          data={data}
          actions={actions}
          editing={editing?.kind === "weekend" ? editing : undefined}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function WorkdayForm({
  data,
  actions,
  editing,
  onDone,
}: {
  data: AppData;
  actions: Actions;
  editing?: WorkdaySession;
  onDone: () => void;
}) {
  const unit = data.unit;

  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [sessionType, setSessionType] = useState<SessionType>(
    editing?.sessionType ?? "normal",
  );

  // Main hangs
  const [edgeMm, setEdgeMm] = useState<number | undefined>(
    editing?.mainHang?.edgeMm ?? 33,
  );
  const [addedWeight, setAddedWeight] = useState<number | undefined>(
    editing?.mainHang?.addedWeight ?? 0,
  );
  const [setsIntended, setSetsIntended] = useState<number | undefined>(
    editing?.mainHang?.setsIntended ?? 6,
  );
  const [setsCompleted, setSetsCompleted] = useState<number | undefined>(
    editing?.mainHang?.setsCompleted ?? 6,
  );

  // Activation (optional, lightly tracked)
  const [showActivation, setShowActivation] = useState(!!editing?.activation);
  const [actSets, setActSets] = useState<number | undefined>(
    editing?.activation?.sets ?? 3,
  );
  const [actSecs, setActSecs] = useState<number | undefined>(
    editing?.activation?.secondsPerHang ?? 7,
  );
  const [actEffort, setActEffort] = useState<number | undefined>(
    editing?.activation?.effortPct ?? 50,
  );

  // Grades
  const [grades, setGrades] = useState<GradeCount[]>(
    editing ? mergeGrades(data.grades, editing.grades) : emptyGrades(data.grades),
  );

  // Accessory / pull-ups (optional)
  const [showAccessory, setShowAccessory] = useState(!!editing?.accessory);
  const [accType, setAccType] = useState<"bodyweight" | "weighted">(
    editing?.accessory?.type ?? "bodyweight",
  );
  const [accSets, setAccSets] = useState<number | undefined>(
    editing?.accessory?.sets,
  );
  const [accReps, setAccReps] = useState<number | undefined>(
    editing?.accessory?.reps,
  );
  const [accAdded, setAccAdded] = useState<number | undefined>(
    editing?.accessory?.addedWeight,
  );

  const [notes, setNotes] = useState(editing?.notes ?? "");

  const [gym, setGym] = useState(editing?.gym ?? "");

  // Main hangs can be skipped entirely (e.g. a compressed-rest/recovery day).
  // A skipped session stores no mainHang, so it never appears in the
  // progression graph or the progression streak.
  const [skipMainHang, setSkipMainHang] = useState(!!editing && !editing.mainHang);

  const [projectName, setProjectName] = useState(editing?.project?.name ?? "");
  const [projectSent, setProjectSent] = useState(editing?.project?.sent ?? false);

  const lastProject = useMemo(
    () => lastProjectName(data.sessions, editing?.id),
    [data.sessions, editing?.id],
  );

  const bw = useMemo(
    () => bodyweightOnOrBefore(data.bodyweights, date),
    [data.bodyweights, date],
  );

  const hangLoadPct =
    bw && edgeMm != null && addedWeight != null
      ? loadPercentBW(bw.weight, addedWeight)
      : undefined;

  const accLoadPct =
    bw && accType === "weighted" && accAdded != null
      ? loadPercentBW(bw.weight, accAdded)
      : undefined;

  function setGrade(grade: string, count: number) {
    setGrades((prev) =>
      prev.map((g) => (g.grade === grade ? { ...g, count } : g)),
    );
  }

  function save() {
    const session: WorkdaySession = {
      id: editing?.id ?? newId(),
      kind: "workday",
      date,
      sessionType,
      gym: gym || undefined,
      grades: grades.filter((g) => g.count > 0 || data.grades.includes(g.grade)),
      project: projectName.trim()
        ? { name: projectName.trim(), sent: projectSent }
        : undefined,
      notes: notes.trim() || undefined,
    };

    if (!skipMainHang && edgeMm != null && setsIntended != null) {
      session.mainHang = {
        edgeMm,
        addedWeight: addedWeight ?? 0,
        setsIntended,
        setsCompleted: setsCompleted ?? 0,
      };
    }
    if (showActivation && actSets != null) {
      session.activation = {
        sets: actSets,
        secondsPerHang: actSecs ?? 0,
        effortPct: actEffort ?? 0,
      };
    }
    if (showAccessory && accReps != null) {
      session.accessory = {
        type: accType,
        sets: accSets,
        reps: accReps,
        addedWeight: accType === "weighted" ? accAdded : undefined,
      };
    }

    actions.upsertSession(session);
    onDone();
  }

  // Live progression preview: what would the streak look like including this entry?
  const progPreview = useMemo(() => {
    if (sessionType === "compressed-rest") return null;
    const draft: WorkdaySession = {
      id: editing?.id ?? "__draft__",
      kind: "workday",
      date,
      sessionType,
      grades: [],
      mainHang:
        !skipMainHang && edgeMm != null
          ? {
              edgeMm,
              addedWeight: addedWeight ?? 0,
              setsIntended: setsIntended ?? 0,
              setsCompleted: setsCompleted ?? 0,
            }
          : undefined,
    };
    const others = data.sessions.filter((s) => s.id !== draft.id);
    return progressionStatus([draft, ...others]);
  }, [
    data.sessions,
    editing?.id,
    date,
    sessionType,
    skipMainHang,
    edgeMm,
    addedWeight,
    setsIntended,
    setsCompleted,
  ]);

  return (
    <div className="card">
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Session type">
        <Segmented
          value={sessionType}
          onChange={setSessionType}
          options={[
            { value: "normal", label: "Normal" },
            { value: "compressed-rest", label: "Compressed rest" },
          ]}
        />
      </Field>
      {sessionType === "compressed-rest" && (
        <p className="hint" style={{ marginTop: -4 }}>
          Only 1 rest day — reduce to 3–4 sets and skip progression. This
          session won't count toward the progression streak.
        </p>
      )}

      <GymField
        gyms={data.gyms}
        value={gym}
        onChange={setGym}
        onAddGym={(name) => actions.setGyms([...data.gyms, name])}
      />

      <h3>
        Main hangs{" "}
        <button
          className="btn ghost"
          style={{ padding: "2px 8px", fontSize: 12 }}
          onClick={() => setSkipMainHang((s) => !s)}
        >
          {skipMainHang ? "include" : "skip"}
        </button>
      </h3>
      {skipMainHang ? (
        <p className="hint" style={{ marginTop: -4 }}>
          Main hangs skipped this session — it won't appear in the progression
          graph or count toward the streak.
        </p>
      ) : (
        <>
          <div className="grid-2">
            <Field label="Edge size (mm)">
              <NumberInput value={edgeMm} onChange={setEdgeMm} min={1} />
            </Field>
            <Field
              label={`Added weight (${unit}, signed)`}
              hint="e.g. -5 to remove"
            >
              <NumberInput
                value={addedWeight}
                onChange={setAddedWeight}
                step={0.5}
              />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Sets completed cleanly">
              <NumberInput
                value={setsCompleted}
                onChange={setSetsCompleted}
                min={0}
              />
            </Field>
            <Field label="Sets intended">
              <NumberInput
                value={setsIntended}
                onChange={setSetsIntended}
                min={0}
              />
            </Field>
          </div>
          <div className="calc">
            {bw ? (
              hangLoadPct != null && (
                <>
                  Load ={" "}
                  <strong>{pct(hangLoadPct)} BW</strong> ·{" "}
                  {signed(addedWeight ?? 0, unit)} on {edgeMm}mm · bodyweight{" "}
                  {bw.weight}
                  {unit} ({bw.date})
                </>
              )
            ) : (
              <>No bodyweight logged yet — add one to compute %BW load.</>
            )}
          </div>
        </>
      )}

      {!skipMainHang && progPreview?.ready && (
        <div className="flag" style={{ marginTop: 12 }}>
          <span className="icon">🎯</span>
          <div className="body">
            <strong>Consider progressing.</strong> That's {progPreview.streak}{" "}
            clean sessions in a row at {progPreview.edgeMm}mm /{" "}
            {signed(progPreview.addedWeight, unit)}. Add weight or drop an edge
            size.
          </div>
        </div>
      )}

      <h3>
        Activation hangs{" "}
        <button
          className="btn ghost"
          style={{ padding: "2px 8px", fontSize: 12 }}
          onClick={() => setShowActivation((s) => !s)}
        >
          {showActivation ? "hide" : "add"}
        </button>
      </h3>
      {showActivation && (
        <div className="row">
          <Field label="Sets">
            <NumberInput value={actSets} onChange={setActSets} min={0} />
          </Field>
          <Field label="Secs / hang">
            <NumberInput value={actSecs} onChange={setActSecs} min={0} />
          </Field>
          <Field label="Effort %">
            <NumberInput value={actEffort} onChange={setActEffort} min={0} />
          </Field>
        </div>
      )}

      <h3>Bouldering block</h3>
      <div className="grid-2">
        {grades.map((g) => (
          <Stepper
            key={g.grade}
            label={g.grade}
            value={g.count}
            onChange={(v) => setGrade(g.grade, v)}
          />
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Edit the grade list in Settings.
      </p>

      <ProjectField
        name={projectName}
        sent={projectSent}
        onName={setProjectName}
        onSent={setProjectSent}
        lastName={lastProject}
      />

      <h3>
        Accessory / pull-ups{" "}
        <button
          className="btn ghost"
          style={{ padding: "2px 8px", fontSize: 12 }}
          onClick={() => setShowAccessory((s) => !s)}
        >
          {showAccessory ? "hide" : "add"}
        </button>
      </h3>
      {showAccessory && (
        <>
          <Field label="Type">
            <Segmented
              value={accType}
              onChange={setAccType}
              options={[
                { value: "bodyweight", label: "Bodyweight" },
                { value: "weighted", label: "Weighted" },
              ]}
            />
          </Field>
          <div className="grid-2">
            <Field label="Sets">
              <NumberInput value={accSets} onChange={setAccSets} min={0} />
            </Field>
            <Field label="Reps / set">
              <NumberInput value={accReps} onChange={setAccReps} min={0} />
            </Field>
            {accType === "weighted" && (
              <Field label={`Added weight (${unit})`}>
                <NumberInput value={accAdded} onChange={setAccAdded} step={0.5} />
              </Field>
            )}
          </div>
          {accLoadPct != null && (
            <div className="calc">
              Weighted pull-up load = <strong>{pct(accLoadPct)} BW</strong>
            </div>
          )}
        </>
      )}

      <h3>Notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What felt good/bad, specific problems…"
      />

      <div className="btn-row">
        <button className="btn primary block" onClick={save}>
          {editing ? "Save changes" : "Save session"}
        </button>
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function WeekendForm({
  data,
  actions,
  editing,
  onDone,
}: {
  data: AppData;
  actions: Actions;
  editing?: WeekendSession;
  onDone: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [gym, setGym] = useState(editing?.gym ?? "");
  const [showGrades, setShowGrades] = useState(
    !!editing?.grades?.some((g) => g.count > 0),
  );
  const [grades, setGrades] = useState<GradeCount[]>(
    editing?.grades
      ? mergeGrades(data.grades, editing.grades)
      : emptyGrades(data.grades),
  );
  const [projectName, setProjectName] = useState(editing?.project?.name ?? "");
  const [projectSent, setProjectSent] = useState(editing?.project?.sent ?? false);

  const lastProject = useMemo(
    () => lastProjectName(data.sessions, editing?.id),
    [data.sessions, editing?.id],
  );

  function setGrade(grade: string, count: number) {
    setGrades((prev) =>
      prev.map((g) => (g.grade === grade ? { ...g, count } : g)),
    );
  }

  function save() {
    const logged = grades.filter((g) => g.count > 0);
    const session: WeekendSession = {
      id: editing?.id ?? newId(),
      kind: "weekend",
      date,
      gym: gym || undefined,
      grades: showGrades && logged.length > 0 ? logged : undefined,
      project: projectName.trim()
        ? { name: projectName.trim(), sent: projectSent }
        : undefined,
      notes: notes.trim() || undefined,
    };
    actions.upsertSession(session);
    onDone();
  }

  return (
    <div className="card">
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <GymField
        gyms={data.gyms}
        value={gym}
        onChange={setGym}
        onAddGym={(name) => actions.setGyms([...data.gyms, name])}
      />

      <h3>
        Bouldering block{" "}
        <button
          className="btn ghost"
          style={{ padding: "2px 8px", fontSize: 12 }}
          onClick={() => setShowGrades((s) => !s)}
        >
          {showGrades ? "hide" : "add"}
        </button>
      </h3>
      {showGrades && (
        <>
          <div className="grid-2">
            {grades.map((g) => (
              <Stepper
                key={g.grade}
                label={g.grade}
                value={g.count}
                onChange={(v) => setGrade(g.grade, v)}
              />
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Optional — counts here feed the grade-volume chart alongside work-day
            sessions.
          </p>
        </>
      )}

      <ProjectField
        name={projectName}
        sent={projectSent}
        onName={setProjectName}
        onSent={setProjectSent}
        lastName={lastProject}
      />

      <h3>Notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Social session, felt strong on slab, tried the blue V5…"
      />

      <div className="btn-row">
        <button className="btn primary block" onClick={save}>
          {editing ? "Save changes" : "Save session"}
        </button>
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
