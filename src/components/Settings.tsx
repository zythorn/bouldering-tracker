import { useRef, useState } from "react";
import { AppData, Unit } from "../types";
import { Actions, listBackups, migrate } from "../lib/storage";
import { GRADE_COLOR_NAMES, gradeFill } from "../lib/colors";
import { Field, Segmented } from "./ui";

export default function Settings({
  data,
  actions,
}: {
  data: AppData;
  actions: Actions;
}) {
  const [newGrade, setNewGrade] = useState("");
  const [newGym, setNewGym] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addGrade() {
    const g = newGrade.trim().toUpperCase();
    if (!g || data.grades.includes(g)) return;
    actions.setGrades([...data.grades, g]);
    setNewGrade("");
  }

  function removeGrade(g: string) {
    actions.setGrades(data.grades.filter((x) => x !== g));
  }

  function addGym() {
    const g = newGym.trim();
    if (!g || data.gyms.includes(g)) return;
    actions.setGyms([...data.gyms, g]);
    setNewGym("");
  }

  function removeGym(g: string) {
    actions.setGyms(data.gyms.filter((x) => x !== g));
  }

  function download(filename: string, text: string) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportData() {
    download(
      `training-log-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
    );
  }

  const backups = listBackups();

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppData;
        if (!parsed || !Array.isArray(parsed.sessions))
          throw new Error("bad file");
        if (
          confirm(
            "Replace all current data with the imported file? This cannot be undone.",
          )
        ) {
          actions.replaceAll(migrate(parsed));
        }
      } catch {
        alert("Could not read that file — is it a valid export?");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="section-title">
        <h2>Settings</h2>
      </div>

      <div className="card">
        <Field label="Units" hint="Applies to bodyweight and added-weight entries.">
          <Segmented<Unit>
            value={data.unit}
            onChange={actions.setUnit}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
          />
        </Field>
      </div>

      <div className="card">
        <h2>Grades &amp; colours</h2>
        <p className="hint" style={{ marginTop: -6 }}>
          These drive the bouldering-block counters, and the colour sets how each
          grade appears in the grade-volume chart.
        </p>
        <div className="grade-rows">
          {data.grades.map((g) => (
            <div className="grade-row" key={g}>
              <span
                className="swatch lg"
                style={{ background: gradeFill(g, data.gradeColors, data.grades) }}
              />
              <span className="grade-name">{g}</span>
              <select
                aria-label={`colour for ${g}`}
                value={data.gradeColors[g] ?? ""}
                onChange={(e) => actions.setGradeColor(g, e.target.value)}
              >
                <option value="">Auto</option>
                {GRADE_COLOR_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                className="btn danger"
                style={{ flex: "0 0 auto", padding: "8px 12px" }}
                onClick={() => removeGrade(g)}
                aria-label={`remove ${g}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            value={newGrade}
            placeholder="e.g. V6"
            onChange={(e) => setNewGrade(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGrade()}
          />
          <button className="btn" onClick={addGrade} style={{ flex: "0 0 auto" }}>
            Add grade
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Gyms</h2>
        <p className="hint" style={{ marginTop: -6 }}>
          Optional — attach a gym to any session. Add your own; removing one here
          leaves past sessions untouched.
        </p>
        <div className="inline-list" style={{ margin: "10px 0" }}>
          {data.gyms.length === 0 && <span className="muted">No gyms yet.</span>}
          {data.gyms.map((g) => (
            <span className="chip" key={g}>
              {g}
              <button onClick={() => removeGym(g)} aria-label={`remove ${g}`}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="row">
          <input
            value={newGym}
            placeholder="e.g. The Climbing Hangar"
            onChange={(e) => setNewGym(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGym()}
          />
          <button className="btn" onClick={addGym} style={{ flex: "0 0 auto" }}>
            Add gym
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Data</h2>
        <p className="hint" style={{ marginTop: -6 }}>
          Everything is stored locally in this browser. Export a backup or move
          it to another device.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={exportData}>
            Export JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
        </div>
        {backups.length > 0 && (
          <>
            <h3>Pre-upgrade backups</h3>
            <p className="hint" style={{ marginTop: -4 }}>
              Your data exactly as it was before an app update changed its
              format. Download one and use Import JSON to go back.
            </p>
            <div className="inline-list">
              {backups.map((b) => (
                <button
                  key={b.date}
                  className="btn ghost"
                  onClick={() =>
                    download(`training-log-backup-${b.date}.json`, b.raw)
                  }
                >
                  ⬇ {b.date}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
