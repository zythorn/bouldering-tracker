import React from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Numeric input that keeps an empty string as `undefined`. */
export function NumberInput({
  value,
  onChange,
  step = 1,
  placeholder,
  min,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  placeholder?: string;
  min?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
    />
  );
}

/**
 * +/- stepper used for grade counters. `min` stops it going below a floor;
 * `onLabelClick` turns the label into a button (used for "add detail").
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  onLabelClick,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  onLabelClick?: () => void;
}) {
  return (
    <div className="stepper">
      {onLabelClick ? (
        <button
          type="button"
          className="label label-btn"
          aria-label={`add detail for ${label}`}
          onClick={onLabelClick}
        >
          {label} <span className="plus">＋</span>
        </button>
      ) : (
        <span className="label">{label}</span>
      )}
      <div className="controls">
        <button
          type="button"
          aria-label={`decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="count">{value}</span>
        <button
          type="button"
          aria-label={`increase ${label}`}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** A pill that toggles on/off (used for tags, feel and RPE). */
export function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip-toggle ${active ? "active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
