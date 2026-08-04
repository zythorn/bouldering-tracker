# 🧗 Bouldering Training Log

A small, local-first web app for logging bouldering sessions and tracking
finger-strength progression over time. Single user, no accounts, no backend —
all data lives in your browser's `localStorage`.

## Run it

```bash
cd climbing-app
npm install
npm run dev
```

Then open the printed URL (usually http://localhost:5173). Build a static bundle
with `npm run build` and preview it with `npm run preview`.

## Stack

- **Vite + React + TypeScript** — fast dev server, zero config to run.
- **Recharts** — trend charts.
- **localStorage** — persistence. No server, no database to set up.

## Architecture

```
src/
  types.ts               Data model (sessions, bodyweight, strength tests)
  lib/
    storage.ts           useAppData() hook — state + localStorage + actions
    calculations.ts      %BW load, "most recent bodyweight", progression rule
    format.ts            Date / number formatting helpers
  components/
    LogSession.tsx       Work-day + weekend logging form (the quick-log flow)
    History.tsx          Filterable list of past sessions (edit / delete)
    Bodyweight.tsx       Bodyweight log
    StrengthTests.tsx    Periodic strength-test log
    Charts.tsx           Hangboard load, grade volume, pull-up trend charts
    Settings.tsx         Units, editable grade list, JSON export / import
    ui.tsx               Small shared inputs (Field, NumberInput, Stepper…)
  App.tsx                Tab shell + progression banner
```

## Features covered

**Must-haves**

- Add / edit / delete work-day and weekend sessions.
- Bodyweight log; the most recent entry on or before a session's date is used
  for all %bodyweight calculations (so numbers stay comparable as weight drifts).
- History view, filterable by session type.
- Hangboard load (%BW) over time, one colour-coded, gently smoothed line per
  edge size (loads only compare within the same edge). Smoothing is visual only
  — it never affects %BW numbers or the progression flag.
- Grade volume over time as stacked bars per session.

**Also included (nice-to-haves)**

- **Progression flag** — after 3 clean main-hang sessions in a row at the same
  edge & weight, a banner suggests adding weight or reducing the edge, matching
  the training plan's rule. Shown both on the Log tab and live while logging.
- **Compressed-rest awareness** — compressed-rest sessions are skipped when
  computing the progression streak.
- **Pull-up strength trend** — sparse line chart from periodic strength tests.
- **Quick-log flow** — mobile-first layout, big steppers for grade counts,
  optional sections collapsed by default, sensible defaults (33mm, 6 sets).
- **Gyms** — attach a gym to any session; the list is managed in Settings and
  new gyms can be added inline while logging. Shown as a badge in history.
- **Skippable main hangs** — a work-day session (e.g. a compressed-rest /
  recovery day) can omit main hangs entirely; skipped sessions never appear in
  the hangboard graph or count toward the progression streak.
- **Grade colours** — assign each grade a hold colour (white/yellow/green/blue/
  red/black/purple/orange) in Settings; the grade-volume chart uses it.
- **Project boulder** — tag a session with a project, mark it sent (a "Project
  sent" note shows in history), and one-tap "Copy last" to carry a project
  forward from the most recent session that had one. Personal-only, not
  aggregated anywhere.
- **JSON export / import** in Settings for backups / moving devices.

## Roadmap / future ideas

- **Multiple hang groups per session** — log mixed edges/loads in one session
  (e.g. 2 sets on 20mm + 4 sets on 33mm). Requires turning the single
  `mainHang` into a list, and teaching the progression streak and hangboard
  chart to work per edge rather than per session.

## Notes on the maths

Every %bodyweight figure is a ratio — `(bodyweight + addedWeight) / bodyweight`
— so the unit cancels out. As long as bodyweight and added weight share the same
unit (enforced by the global unit setting), the calculations are unit-agnostic.
