import { useMemo, useState } from "react";
import {
  AppData,
  BoulderLog,
  GradeCount,
  PainScores,
  Session,
  SessionType,
  TrackedProject,
  WeekendSession,
  WorkdaySession,
} from "../types";
import { Actions, newId } from "../lib/storage";
import {
  bodyweightOnOrBefore,
  bodyweightShiftSinceLastHang,
  deriveSessionType,
  loadPercentBW,
  progressionStatus,
} from "../lib/calculations";
import { RPE_LABELS, plural } from "../lib/boulders";
import { cleanPain } from "../lib/pain";
import { pct, shortDate, signed, todayISO } from "../lib/format";
import { ChipToggle, Field, NumberInput, Segmented } from "./ui";
import BoulderingBlock from "./BoulderingBlock";
import PainField from "./PainField";
import StrengthForm from "./StrengthForm";

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

/** Whole-session effort, 0 (light) to 5 (limit). Tap the active chip to clear. */
function RpeField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <>
      <h3>
        Session RPE
        {value != null && (
          <span className="rpe-label">
            {" "}
            · {value} {RPE_LABELS[value]}
          </span>
        )}
      </h3>
      <div className="chip-row">
        {RPE_LABELS.map((label, i) => (
          <ChipToggle
            key={label}
            active={value === i}
            label={`Session RPE ${i}, ${label}`}
            onClick={() => onChange(value === i ? undefined : i)}
          >
            {i}
          </ChipToggle>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        How hard the whole session felt: 0 light · 1 easy · 2 moderate · 3 hard ·
        4 very hard · 5 limit.
      </p>
    </>
  );
}

/**
 * Projects created while logging are saved with the session — but only the
 * ones a boulder still links to, so an abandoned "Track" leaves nothing behind.
 */
function projectsToSave(
  newProjects: TrackedProject[],
  boulders: BoulderLog[],
  gym: string,
): TrackedProject[] {
  return newProjects
    .filter((p) => boulders.some((b) => b.projectId === p.id))
    .map((p) => ({ ...p, gym: p.gym ?? (gym || undefined) }));
}

interface Props {
  data: AppData;
  actions: Actions;
  editing?: Session;
  onDone: () => void; // after a save
  onCancel: () => void; // discard without saving
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

export default function LogSession({
  data,
  actions,
  editing,
  onDone,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<Session["kind"]>(editing?.kind ?? "workday");

  return (
    <div>
      {!editing && (
        <div style={{ marginBottom: 16 }}>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "workday", label: "Work-day" },
              { value: "weekend", label: "Weekend" },
              { value: "strength", label: "Core/hip" },
            ]}
          />
        </div>
      )}

      {kind === "workday" ? (
        <WorkdayForm
          data={data}
          actions={actions}
          editing={editing?.kind === "workday" ? editing : undefined}
          onDone={onDone}
          onCancel={onCancel}
        />
      ) : kind === "weekend" ? (
        <WeekendForm
          data={data}
          actions={actions}
          editing={editing?.kind === "weekend" ? editing : undefined}
          onDone={onDone}
          onCancel={onCancel}
        />
      ) : (
        <StrengthForm
          data={data}
          actions={actions}
          editing={editing?.kind === "strength" ? editing : undefined}
          onDone={onDone}
          onCancel={onCancel}
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
  onCancel,
}: {
  data: AppData;
  actions: Actions;
  editing?: WorkdaySession;
  onDone: () => void;
  onCancel: () => void;
}) {
  const unit = data.unit;

  const [date, setDate] = useState(editing?.date ?? todayISO());

  // Normal vs compressed-rest is derived from the dates; an override is only
  // stored when the user deliberately picks the other value.
  const [override, setOverride] = useState<SessionType | undefined>(
    editing?.sessionTypeOverride,
  );
  const derived = useMemo(
    () => deriveSessionType(date, data.sessions, editing?.id),
    [date, data.sessions, editing?.id],
  );
  const sessionType = override ?? derived.type;

  function pickSessionType(t: SessionType) {
    setOverride(t === derived.type ? undefined : t);
  }

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

  // Bouldering block: counters, detailed boulders, projects tracked this session
  const [grades, setGrades] = useState<GradeCount[]>(
    editing ? mergeGrades(data.grades, editing.grades) : emptyGrades(data.grades),
  );
  const [boulders, setBoulders] = useState<BoulderLog[]>(
    editing?.boulders ?? [],
  );
  const [newProjects, setNewProjects] = useState<TrackedProject[]>([]);

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
  const [rpe, setRpe] = useState<number | undefined>(editing?.rpe);
  const [pain, setPain] = useState<PainScores>(editing?.pain ?? {});

  const [gym, setGym] = useState(editing?.gym ?? "");

  // Main hangs can be skipped entirely (e.g. a compressed-rest/recovery day).
  // A skipped session stores no mainHang, so it never appears in the
  // progression graph or the progression streak.
  const [skipMainHang, setSkipMainHang] = useState(!!editing && !editing.mainHang);

  const bw = useMemo(
    () => bodyweightOnOrBefore(data.bodyweights, date),
    [data.bodyweights, date],
  );

  const hangLoadPct =
    bw && edgeMm != null && addedWeight != null
      ? loadPercentBW(bw.weight, addedWeight)
      : undefined;

  // >2 kg bodyweight change since the last hang session: loads need a rethink.
  const bwShift = useMemo(
    () =>
      bodyweightShiftSinceLastHang(
        data.sessions,
        data.bodyweights,
        date,
        unit,
        editing?.id,
      ),
    [data.sessions, data.bodyweights, date, unit, editing?.id],
  );

  const accLoadPct =
    bw && accType === "weighted" && accAdded != null
      ? loadPercentBW(bw.weight, accAdded)
      : undefined;

  function save() {
    const session: WorkdaySession = {
      id: editing?.id ?? newId(),
      kind: "workday",
      date,
      sessionType: editing?.sessionType, // legacy tag, carried over untouched
      sessionTypeOverride: override,
      gym: gym || undefined,
      grades: grades.filter((g) => g.count > 0 || data.grades.includes(g.grade)),
      boulders: boulders.length > 0 ? boulders : undefined,
      rpe,
      pain: cleanPain(pain),
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
    if (showAccessory && accReps != null) {
      session.accessory = {
        type: accType,
        sets: accSets,
        reps: accReps,
        addedWeight: accType === "weighted" ? accAdded : undefined,
      };
    }

    actions.saveSession(session, projectsToSave(newProjects, boulders, gym));
    onDone();
  }

  // Live progression preview: what would the streak look like including this entry?
  const progPreview = useMemo(() => {
    if (sessionType === "compressed-rest") return null;
    const draft: WorkdaySession = {
      id: editing?.id ?? "__draft__",
      kind: "workday",
      date,
      sessionTypeOverride: sessionType, // the form's effective value
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
          onChange={pickSessionType}
          options={[
            { value: "normal", label: "Normal" },
            { value: "compressed-rest", label: "Compressed rest" },
          ]}
        />
      </Field>
      <p className="hint" style={{ marginTop: -4 }}>
        {override ? (
          <>
            Set manually; from the dates it would be{" "}
            {derived.type === "normal" ? "normal" : "compressed rest"}.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => setOverride(undefined)}
            >
              Use automatic
            </button>
          </>
        ) : derived.prevDate ? (
          <>
            Automatic: {plural(derived.gapDays!, "day")} since the last work-day
            session ({shortDate(derived.prevDate)}).
          </>
        ) : (
          <>Automatic: no earlier work-day session.</>
        )}
      </p>
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
          {bwShift && (
            <div className="flag warn" style={{ marginTop: 10 }}>
              <span className="icon">⚖️</span>
              <div className="body">
                Bodyweight is <strong>{signed(bwShift.change, unit)}</strong>{" "}
                since your last hang session ({shortDate(bwShift.lastHangDate)}),
                so the same added weight is a different %BW load. Recalculate
                before hanging.
              </div>
            </div>
          )}
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

      <h3>Bouldering block</h3>
      <BoulderingBlock
        data={data}
        grades={grades}
        setGrades={setGrades}
        boulders={boulders}
        setBoulders={setBoulders}
        newProjects={newProjects}
        setNewProjects={setNewProjects}
        gym={gym}
        date={date}
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

      <RpeField value={rpe} onChange={setRpe} />

      <PainField value={pain} onChange={setPain} />

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
        <button className="btn ghost" onClick={onCancel}>
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
  onCancel,
}: {
  data: AppData;
  actions: Actions;
  editing?: WeekendSession;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [gym, setGym] = useState(editing?.gym ?? "");
  const [rpe, setRpe] = useState<number | undefined>(editing?.rpe);
  const [pain, setPain] = useState<PainScores>(editing?.pain ?? {});
  const [showGrades, setShowGrades] = useState(
    !!editing?.grades?.some((g) => g.count > 0) || !!editing?.boulders?.length,
  );
  const [grades, setGrades] = useState<GradeCount[]>(
    editing?.grades
      ? mergeGrades(data.grades, editing.grades)
      : emptyGrades(data.grades),
  );
  const [boulders, setBoulders] = useState<BoulderLog[]>(
    editing?.boulders ?? [],
  );
  const [newProjects, setNewProjects] = useState<TrackedProject[]>([]);

  function save() {
    const logged = grades.filter((g) => g.count > 0);
    const keptBoulders = showGrades ? boulders : [];
    const session: WeekendSession = {
      id: editing?.id ?? newId(),
      kind: "weekend",
      date,
      gym: gym || undefined,
      grades: showGrades && logged.length > 0 ? logged : undefined,
      boulders: keptBoulders.length > 0 ? keptBoulders : undefined,
      rpe,
      pain: cleanPain(pain),
      notes: notes.trim() || undefined,
    };
    actions.saveSession(session, projectsToSave(newProjects, keptBoulders, gym));
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
        {/* Can't hide the block while it holds detailed boulders. */}
        {!(showGrades && boulders.length > 0) && (
          <button
            className="btn ghost"
            style={{ padding: "2px 8px", fontSize: 12 }}
            onClick={() => setShowGrades((s) => !s)}
          >
            {showGrades ? "hide" : "add"}
          </button>
        )}
      </h3>
      {showGrades && (
        <BoulderingBlock
          data={data}
          grades={grades}
          setGrades={setGrades}
          boulders={boulders}
          setBoulders={setBoulders}
          newProjects={newProjects}
          setNewProjects={setNewProjects}
          gym={gym}
          date={date}
        />
      )}

      <RpeField value={rpe} onChange={setRpe} />

      <PainField value={pain} onChange={setPain} />

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
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
