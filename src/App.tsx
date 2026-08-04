import { useEffect, useState } from "react";
import { useAppData } from "./lib/storage";
import { progressionStatus } from "./lib/calculations";
import { signed } from "./lib/format";
import { Session } from "./types";
import LogSession from "./components/LogSession";
import History from "./components/History";
import Bodyweight from "./components/Bodyweight";
import StrengthTests from "./components/StrengthTests";
import Charts from "./components/Charts";
import Settings from "./components/Settings";

type Tab = "log" | "history" | "weight" | "strength" | "charts" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "log", label: "Log", icon: "➕" },
  { id: "history", label: "History", icon: "📋" },
  { id: "charts", label: "Trends", icon: "📈" },
  { id: "weight", label: "Weight", icon: "⚖️" },
  { id: "strength", label: "Strength", icon: "💪" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function App() {
  const { data, actions } = useAppData();
  const [tab, setTab] = useState<Tab>("log");
  const [editing, setEditing] = useState<Session | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  const prog = progressionStatus(data.sessions);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function goLog(session?: Session) {
    setEditing(session);
    setTab("log");
  }

  function finishLog() {
    setEditing(undefined);
    setToast("Saved ✓");
    setTab("history");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧗 Training Log</h1>
        <span className="sub">
          {data.sessions.length} sessions · {data.unit}
        </span>
      </header>

      {tab === "log" && (
        <>
          {!editing && prog?.ready && (
            <div className="flag">
              <span className="icon">🎯</span>
              <div className="body">
                <strong>Ready to progress?</strong> {prog.streak} clean sessions
                in a row at {prog.edgeMm}mm / {signed(prog.addedWeight, data.unit)}.
                Add weight or reduce the edge size.
              </div>
            </div>
          )}
          <LogSession
            data={data}
            actions={actions}
            editing={editing}
            onDone={finishLog}
          />
        </>
      )}

      {tab === "history" && (
        <History data={data} actions={actions} onEdit={goLog} />
      )}
      {tab === "charts" && <Charts data={data} />}
      {tab === "weight" && <Bodyweight data={data} actions={actions} />}
      {tab === "strength" && <StrengthTests data={data} actions={actions} />}
      {tab === "settings" && <Settings data={data} actions={actions} />}

      {toast && <div className="toast">{toast}</div>}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              if (t.id === "log") setEditing(undefined);
              setTab(t.id);
            }}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
