# Project Brief: Bouldering Training Log App

## Context
I'm an intermediate boulderer (V3 flash / V4 majority send / V5 projecting) following a structured training plan. I want a small personal app to replace my current spreadsheet for logging sessions and tracking finger-strength progression over time. This is a personal tool, single user, no auth needed — simplicity over polish.

## Goals
1. Make logging a session faster than opening a spreadsheet.
2. Automatically compute %bodyweight for hangboard loads so numbers stay comparable even as bodyweight fluctuates.
3. Show trend lines over time (hangboard progression, grade volume, pull-up strength) so plateaus/improvements are easy to spot at a glance.
4. Lightly flag when I might be ready to progress (e.g. same edge/weight held cleanly for several sessions in a row).

## Suggested Tech Stack
Simple local-first web app — something like a single-page app with local storage/SQLite, no backend service required. Open to your recommendation on framework, but it should be easy to run locally (e.g. `npm run dev`) without needing external hosting or accounts.

## Data to Track

### Bodyweight (tracked periodically, not every session)
- Date
- Bodyweight (kg or lb)

### Work-Day Session Log (2x/week)
- Date
- Session type: `normal` / `compressed-rest` (i.e. only 1 day since previous work-day session)
- **Activation hangs:** sets, seconds/hang, effort % (just for reference, not deeply tracked)
- **Main hangs:**
  - Edge size (mm)
  - Added/removed weight (kg or lb — signed, so -5kg is allowed)
  - Sets completed cleanly (out of intended sets)
  - Auto-calculated: load as %bodyweight (using most recent bodyweight entry)
- **Main bouldering block:**
  - Boulders completed per grade (e.g. V3: 4, V4: 2, V5: 0) — simple counter per grade, editable list of grades
  - Optional free-text notes (what felt good/bad, specific problems, etc.)
- **Accessory/pull-up work (when done):**
  - Type (bodyweight / weighted)
  - Reps, added weight if any
  - Auto-calculated: %bodyweight if weighted

### Weekend Session Log (optional, lightweight)
- Date
- Optional notes (just for personal record, no structured metrics — this session is intentionally unstructured)

### Periodic Strength Tests (logged occasionally, not every session)
- Date
- Max bodyweight pull-ups (reps)
- Weighted pull-up 1RM (%bodyweight, auto-calculated from added weight + bodyweight)
- Weighted pull-up 2RM (%bodyweight)
- Max hang test (edge size + weight/added weight + duration)

## Features

### Must-have
- Add/edit/delete session entries (work-day and weekend)
- Bodyweight log, with the most recent entry used for %BW calculations elsewhere
- A history/list view of past sessions, filterable by session type
- A simple chart: hangboard load (%BW) over time, ideally with edge size shown (e.g. color-coded or annotated points, since load comparisons only make sense within the same edge size)
- A simple chart: grade volume over time (e.g. stacked or grouped bars per session showing counts per grade)

### Nice-to-have
- Progression flag: if the last N (e.g. 3) main-hang entries at the *same edge and weight* were all marked "sets completed cleanly = all sets", show a note like "Consider progressing: add weight or reduce edge size" — matching the training plan's progression rule.
- Compressed-rest awareness: if a session is marked `compressed-rest`, don't count it toward the "ready to progress" streak (per the training plan's rule of not progressing after a short-rest session).
- Pull-up strength trend chart (periodic tests, so likely a sparser line chart).
- Quick "log today's session" flow optimized for minimal taps, since I'll often be logging this at the gym on my phone.

### Explicitly out of scope for now
- Multi-user / accounts / cloud sync
- Integration with any external fitness platforms
- Detailed movement/technique tracking beyond grade counts and notes

## Reference: My Current Training Plan (for context on why these fields exist)
- 3 sessions/week: 2 structured work-day sessions (hangboard + focused bouldering) + 1 unstructured social weekend session.
- Hangboard: activation hangs (3-6 sets, 5-10s, ~40-60% effort, feet down) then main hangs (currently 6 sets x 10s at bodyweight on 33mm edge, half-crimp), progressing by adding weight or reducing edge size once the current load feels solid across all sets.
- Compressed-rest rule: if only 1 day of rest since the last work-day session, reduce main hangs to 3-4 sets and don't attempt a progression step that session.
- Pulling strength (15 BW pull-ups, 142%BW weighted 1RM) is already ahead of what's needed, so it's maintenance-only: ~1x/week, low volume, moderate intensity.

## Ask
Please propose a simple architecture/file structure, pick a reasonable lightweight stack, and build a first working version covering the "must-have" features above. I'm happy to iterate from there once I can see it running.
