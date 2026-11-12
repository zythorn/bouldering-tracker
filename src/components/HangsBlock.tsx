import { useMemo } from "react";
import { AppData, Session, SessionType } from "../types";
import {
  bodyweightOnOrBefore,
  bodyweightShiftSinceLastHang,
  deriveSessionType,
  loadPercentBW,
  progressionStatus,
} from "../lib/calculations";
import { plural } from "../lib/boulders";
import { pct, shortDate, signed } from "../lib/format";
import { Field, NumberInput, Segmented } from "./ui";
import { HangDraft } from "./blockDraft";

/**
 * Main hangs: edge, load and sets, with compressed rest (derived from the
 * dates of hang sessions, overridable), the %BW calculation, a bodyweight-shift
 * warning and a live progression preview.
 */
export default function HangsBlock({
  block,
  onChange,
  data,
  date,
  sessionId,
}: {
  block: HangDraft;
  onChange: (b: HangDraft) => void;
  data: AppData;
  date: string;
  sessionId?: string; // when editing, so the session doesn't count against itself
}) {
  const unit = data.unit;
  const { edgeMm, addedWeight, setsIntended, setsCompleted, typeOverride } =
    block;
  const set = (patch: Partial<HangDraft>) => onChange({ ...block, ...patch });

  const derived = useMemo(
    () => deriveSessionType(date, data.sessions, sessionId),
    [date, data.sessions, sessionId],
  );
  const sessionType = typeOverride ?? derived.type;

  function pickSessionType(t: SessionType) {
    // Only store an override when it disagrees with the dates.
    set({ typeOverride: t === derived.type ? undefined : t });
  }

  const bw = useMemo(
    () => bodyweightOnOrBefore(data.bodyweights, date),
    [data.bodyweights, date],
  );
  const loadPct =
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
        sessionId,
      ),
    [data.sessions, data.bodyweights, date, unit, sessionId],
  );

  // Live progression preview: what would the streak look like including this entry?
  const progPreview = useMemo(() => {
    if (sessionType === "compressed-rest" || edgeMm == null) return null;
    const draft: Session = {
      id: sessionId ?? "__draft__",
      date,
      blocks: [
        {
          kind: "hangs",
          edgeMm,
          addedWeight: addedWeight ?? 0,
          setsIntended: setsIntended ?? 0,
          setsCompleted: setsCompleted ?? 0,
          typeOverride: sessionType, // the form's effective value
        },
      ],
    };
    const others = data.sessions.filter((s) => s.id !== draft.id);
    return progressionStatus([draft, ...others]);
  }, [
    data.sessions,
    sessionId,
    date,
    sessionType,
    edgeMm,
    addedWeight,
    setsIntended,
    setsCompleted,
  ]);

  return (
    <>
      <Field label="Rest before this session">
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
        {typeOverride ? (
          <>
            Set manually; from the dates it would be{" "}
            {derived.type === "normal" ? "normal" : "compressed rest"}.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => set({ typeOverride: undefined })}
            >
              Use automatic
            </button>
          </>
        ) : derived.prevDate ? (
          <>
            Automatic: {plural(derived.gapDays!, "day")} since the last session
            with hangs ({shortDate(derived.prevDate)}).
          </>
        ) : (
          <>Automatic: no earlier session with hangs.</>
        )}
      </p>
      {sessionType === "compressed-rest" && (
        <p className="hint" style={{ marginTop: -4 }}>
          Only 1 rest day — reduce to 3–4 sets and skip progression. This
          session won't count toward the progression streak.
        </p>
      )}

      <div className="grid-2">
        <Field label="Edge size (mm)">
          <NumberInput
            value={edgeMm}
            onChange={(v) => set({ edgeMm: v })}
            min={1}
          />
        </Field>
        <Field label={`Added weight (${unit}, signed)`} hint="e.g. -5 to remove">
          <NumberInput
            value={addedWeight}
            onChange={(v) => set({ addedWeight: v })}
            step={0.5}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Sets completed cleanly">
          <NumberInput
            value={setsCompleted}
            onChange={(v) => set({ setsCompleted: v })}
            min={0}
          />
        </Field>
        <Field label="Sets intended">
          <NumberInput
            value={setsIntended}
            onChange={(v) => set({ setsIntended: v })}
            min={0}
          />
        </Field>
      </div>
      <div className="calc">
        {bw ? (
          loadPct != null && (
            <>
              Load = <strong>{pct(loadPct)} BW</strong> ·{" "}
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
            Bodyweight is <strong>{signed(bwShift.change, unit)}</strong> since
            your last hang session ({shortDate(bwShift.lastHangDate)}), so the
            same added weight is a different %BW load. Recalculate before
            hanging.
          </div>
        </div>
      )}
      {progPreview?.ready && (
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
    </>
  );
}
