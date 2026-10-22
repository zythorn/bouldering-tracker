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
  types.ts               Data model (sessions, boulders, projects, bodyweight…)
  lib/
    storage.ts           useAppData() hook — state + localStorage + actions,
                         and migrate() for older saved/exported data
    calculations.ts      %BW load, "most recent bodyweight", progression rule
    boulders.ts          Boulder vocabulary (tags, feel, RPE) + derived
                         project stats/status
    pain.ts              Pain-check areas, scale, "last pain check" lookup
    strength.ts          Core/hip prescription + weekly (Mon–Sun) count
    format.ts            Date / number formatting + calendar arithmetic
  components/
    LogSession.tsx       Work-day + weekend logging form (the quick-log flow)
    StrengthForm.tsx     Core/hip session form (physio checklist)
    PainField.tsx        0–5 pain check (elbow / wrist / lower back)
    BoulderingBlock.tsx  Grade counters + detailed boulders (shared by both forms)
    BoulderSheet.tsx     Bottom sheet for logging one boulder in detail
    History.tsx          Sessions list (filterable) / Projects toggle
    Projects.tsx         Tracked projects: progress, edit, retire, delete
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
- **Detailed boulders** — tap a grade label ("V5 ＋") to log a single boulder:
  outcome (flash / send / not sent), attempts, grade feel (soft / fair / hard)
  and tags (slab / vertical / overhang; power / technical / dyno /
  coordination), plus an optional note. Entirely optional — plain counters
  still work as before. Counters remain the total of sends: a detailed send
  adds 1 to its grade, and a counter can't drop below its detailed sends.
  Unsent boulders never appear in the charts.
- **Tracked projects** — mark a "not sent" boulder as a project with "Track as
  project" (nothing is added automatically). Later sessions pick it from a list
  (projects at the session's gym first) and attempts add up across sessions:
  "Took 31 attempts over 4 sessions". Progress is derived from the logs, never
  stored, so editing or deleting sessions keeps it correct. Projects not worked
  in 6 weeks drop out of the picker; projects can also be retired. Browse them
  under History → Projects.
- **Session RPE** — one effort rating per session, 0 light · 1 easy ·
  2 moderate · 3 hard · 4 very hard · 5 limit.
- **Pain check** — optional 0–5 for elbow, wrist and lower back on every
  session type; empty means "not recorded", distinct from 0. Sessions with a
  2+ are highlighted in history, a Trends chart shows each area with the stop
  threshold as a dashed line, and the Log screen shows a banner when the last
  session *that recorded a pain check* had a 2+. The app only records scores
  and points back to the plan's stop rules; it never interprets them.
- **Core/hip sessions** — a third session type with the physio's checklist
  (breathing/core control, banded deadlift under 20 kg, single-leg glute
  bridge, side plank), prefilled at the prescribed dose. "Completed as
  prescribed" is derived from what was logged. The Log screen shows
  "Core/hip this week: n/3 (min 2)" for the current Monday–Sunday week.
- **Compressed rest from dates** — a work-day session is compressed-rest when
  the previous work-day session was at most 2 calendar days earlier (weekend
  and core/hip sessions don't count). It can be overridden per session. The
  manual `sessionType` tag older versions stored is kept but no longer read.
- **Bodyweight trend & reminders** — a chart on the Weight tab, a
  "no weigh-in for 7+ days" reminder, and a warning on the hang section when
  bodyweight moved more than 2 kg (4.4 lb) since the last hang session.
- **Gym filter** on the grade-volume chart, to compare progress within one gym.
- **JSON export / import** in Settings for backups / moving devices.

## Data migrations

`migrate()` in `lib/storage.ts` runs on load and on JSON import, so old data
upgrades itself:

- The old per-session `project: {name, sent}` field becomes tracked projects
  (grouped by name), each session getting a linked boulder entry. The old field
  never stored a grade or attempts, so those start empty.
- Activation-hang data (feature removed) is dropped.

Whenever `migrate()` changes stored data on load, the untouched original is
kept in localStorage (one copy per day) and offered for download under
Settings → Data → Pre-upgrade backups.

## Roadmap / future ideas

- **v2 brief, phase 2** — optional endurance block on work-day sessions
  (rounds, minutes per round, rest, target effort, completed as planned, with
  total continuous-climbing minutes over time), session duration, and a
  "V5+ sends per session" chart with an adjustable threshold and gym filter.
- **v2 brief, later** — hang additions once hangs resume: seconds held per
  set, and a second edge for occasional tests (fold into "multiple hang groups"
  below).
- **Accessory / pull-ups rework** — the section is unchanged for now.
- **Boulder analytics** — e.g. attempts-to-send by grade, or which tags cost
  the most attempts.
- **Multiple hang groups per session** — log mixed edges/loads in one session
  (e.g. 2 sets on 20mm + 4 sets on 33mm). Requires turning the single
  `mainHang` into a list, and teaching the progression streak and hangboard
  chart to work per edge rather than per session.

## Notes on the maths

Every %bodyweight figure is a ratio — `(bodyweight + addedWeight) / bodyweight`
— so the unit cancels out. As long as bodyweight and added weight share the same
unit (enforced by the global unit setting), the calculations are unit-agnostic.
