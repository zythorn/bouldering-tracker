import { PainScores } from "../types";
import { PAIN_AREAS, PAIN_SCALE, PAIN_STOP } from "../lib/pain";
import { ChipToggle } from "./ui";

const SCORES = [0, 1, 2, 3, 4, 5];

/**
 * Optional 0–5 pain check per area. Nothing is selected by default, so
 * "not recorded" stays distinct from 0; tap the active score to clear it.
 */
export default function PainField({
  value,
  onChange,
}: {
  value: PainScores;
  onChange: (p: PainScores) => void;
}) {
  return (
    <>
      <h3>Pain check</h3>
      {PAIN_AREAS.map((area) => (
        <div className="pain-row" key={area.key}>
          <span className="pain-label">{area.label}</span>
          <div className="chip-row">
            {SCORES.map((n) => (
              <ChipToggle
                key={n}
                active={value[area.key] === n}
                warn={n >= PAIN_STOP}
                label={`${area.label} pain ${n}`}
                onClick={() =>
                  onChange({
                    ...value,
                    [area.key]: value[area.key] === n ? undefined : n,
                  })
                }
              >
                {n}
              </ChipToggle>
            ))}
          </div>
        </div>
      ))}
      <p className="hint" style={{ marginTop: 6 }}>
        {PAIN_SCALE}. Leave empty if you didn't check.
      </p>
    </>
  );
}
