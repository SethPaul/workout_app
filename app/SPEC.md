# Workout App — MVP Spec (Stage 1: PWA, no backend)

This is the source of truth for the rewrite. The Flutter tree at the repo root is legacy and will be
archived; nothing in it is a dependency of this app. Domain knowledge lives in `project_docs/` and
`xlsx_version/docs/` (formats, intensity, weekly structure); this spec is what we build.

## 1. Product

Single-user garage-gym daily workout picker. Replaces a spreadsheet.

- The app holds a **pool** of fully specified workouts.
- Each day the user taps **Get Today's Workout**; the app pulls one from the pool that respects
  per-movement **cadence** (e.g. deadlift no more than every 7 days) and the user's **equipment**.
- The user can **bump** (re-roll) it.
- The user **executes** it with a format-aware timer and audio/vibration cues, logging weight and
  reps per movement.
- **History** shows what was done and when each movement was last performed.
- Everything is local to the device (IndexedDB), with JSON export/import as backup.

Non-goals for Stage 1: accounts, sync, workout generation, muscle-fatigue modelling, team workouts,
notifications, theming.

## 2. Domain model (TypeScript, `app/src/domain/types.ts`)

```ts
export type Equipment =
  | 'barbell' | 'kettlebell' | 'dumbbell' | 'rack' | 'bench' | 'pullup_bar' | 'rings'
  | 'rower' | 'bike' | 'box' | 'jump_rope' | 'medball' | 'wall' | 'sandbag' | 'sled'
  | 'ghd' | 'ab_wheel' | 'trx' | 'cable' | 'landmine' | 'plyo_box' | 'none';

export type Unit = 'reps' | 'meters' | 'calories' | 'seconds';

export interface Movement {
  id: string;             // slug, e.g. "deadlift"
  name: string;           // "Deadlift"
  aliases?: string[];     // spreadsheet spellings that map here
  tags: string[];         // free tags: 'compound','squat','hinge','push','pull','cardio','core','olympic','bodyweight','accessory'
  equipment: Equipment[]; // ALL required; empty or ['none'] = no equipment
  cadenceDays: number;    // minimum days between performances. Defaults: compound lifts 7, olympic 3, bodyweight/accessory 3, cardio 1
  unit: Unit;             // default measure
  loadable: boolean;      // true if weight is logged
}

export type Format =
  | 'strength'   // sets x reps of one movement, rest between sets
  | 'emom'       // every N seconds for R rounds, do the listed work
  | 'tabata'     // 8 x (20s work / 10s rest) per movement
  | 'interval'   // R rounds of (workSec on / restSec off), e.g. "30 on 30 off"
  | 'amrap'      // as many rounds as possible in durationSec
  | 'rounds'     // R rounds for time (stopwatch, optional timeCapSec)
  | 'chipper'    // one pass through the list for time (stopwatch)
  | 'death_by';  // minute 1 = 1 rep, minute 2 = 2 reps ... until failure

export interface BlockMovement {
  movementId: string;
  reps?: number;          // per round/set (or starting reps for death_by, ladder start)
  distanceM?: number;     // for cardio
  calories?: number;
  seconds?: number;       // for holds
  loadNote?: string;      // free text, e.g. "heavy", "70% 1RM", "bodyweight"
  repScheme?: number[];   // optional explicit per-round reps, e.g. [21,15,9] or [50,40,30,20,10]
  loadPct?: number;       // structured target load, 0-100 (% of 1RM)
  rir?: number;           // reps-in-reserve target, 0-5
}

export interface Block {
  format: Format;
  title?: string;         // e.g. "Warm-up", "Main", "Finisher"
  movements: BlockMovement[];
  sets?: number;          // strength
  rounds?: number;        // emom/interval/rounds/tabata(default 8)
  intervalSec?: number;   // emom (default 60)
  workSec?: number;       // interval/tabata
  restSec?: number;       // interval/tabata/strength (rest between sets)
  durationSec?: number;   // amrap
  timeCapSec?: number;    // rounds/chipper/strength optional cap
  alternate?: boolean;    // emom: alternate movements per round instead of all each round
}

export type Intensity = 'H' | 'M' | 'L';

export interface PoolWorkout {
  id: string;
  name: string;
  intensity: Intensity;
  blocks: Block[];
  cadenceDays: number;    // minimum days between repeating this exact workout (default 14)
  enabled: boolean;
  tags?: string[];        // e.g. 'deadlift-day', 'slog', 'diversity'
  source: 'spreadsheet' | 'manual';
  notes?: string;
}

export interface SetResult { weight?: number; reps?: number; }

export interface MovementResult {
  movementId: string;
  sets?: SetResult[];     // strength: one per set; other formats: optional single entry
  weight?: number;        // load used, if loadable
  reps?: number;          // total reps or reps per round
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  poolWorkoutId: string;
  workoutSnapshot: PoolWorkout;   // copy at time of execution (pool can be edited later)
  startedAt: string;              // ISO
  finishedAt: string;             // ISO
  score?: string;                 // e.g. "7 rounds + 3", "12:34", "failed at minute 9"
  results: MovementResult[];
  notes?: string;
  rpe?: number;                   // 1-10 optional
}

export interface Settings {
  availableEquipment: Equipment[];  // default: everything
  soundOn: boolean;
  vibrateOn: boolean;
  keepScreenOn: boolean;
}

export interface AppState {
  movements: Movement[];
  pool: PoolWorkout[];
  logs: WorkoutLog[];
  settings: Settings;
  schemaVersion: 1;
}
```

Derived (not stored): `lastPerformed(movementId)` = max `finishedAt` over logs whose snapshot contains
that movement; `lastPerformed(poolWorkoutId)` likewise.

## 3. Selection algorithm (`app/src/domain/select.ts`, pure, unit-tested)

Inputs: `pool`, `movements`, `logs`, `settings`, `now`, `exclude: string[]` (bumped ids), `rng`.

1. **Gate**: keep pool workouts where all of:
   - `enabled`
   - id not in `exclude`
   - every required equipment of every movement is in `settings.availableEquipment`
   - `daysSince(lastPerformed(workout)) >= workout.cadenceDays` (never performed passes)
   - for every movement in the workout: `daysSince(lastPerformed(movement)) >= movement.cadenceDays`
   - **pattern-level cadence gate** (`app/src/domain/patterns.ts`, AUDIT.md C1): only HEAVY loading
     counts — a movement appearing in a `strength` block, in a block titled `'Power'`, or any
     olympic-tagged barbell movement in any block. For every pattern (`Pattern`: squat/hinge/push/
     pull/olympic/core/cardio/plyo, via `movementPatterns(movement)`) of every HEAVY movement in the
     candidate, `daysSince(last HEAVY performance of that pattern, scanned across all logs'
     `workoutSnapshot`s) >= PATTERN_CADENCE_DAYS[pattern]` (squat/hinge/push/pull/olympic = 2, plyo =
     1, core/cardio = 0, i.e. never gated). This is what stops e.g. a `front_squat` strength day the
     day after a `back_squat` strength day, which per-movement cadence alone allows.
   - `ignoreCadence` bypasses both the per-movement/per-workout cadence gate and the pattern gate.
2. **Weekly mandatory-day gate** (`app/src/domain/weekly.ts`, AUDIT.md C2): compute
   `weeklyNeed(logs, now)` — the first day type in `REQUIRED_WEEKLY` (currently just
   `'deadlift-press'`) with no log in the last 7 local days whose `workoutSnapshot` carries the
   matching `day:*` tag. If a day type is owed and at least one gate-1 survivor has that `day:*` tag,
   restrict the candidate pool to those; otherwise (nothing owed, or no survivor has it) fall through
   to the full gate-1 survivor set unchanged — this step never empties the pool on its own. The
   result exposes `needed: string | null` so the UI can say e.g. "Deadlift + push press day is due
   this week."
3. **Score** each survivor:
   - `+2 * daysSince(workout)` (cap 60), or `+100` if never performed
   - `+ mean over movements of min(daysSince(movement), 30)` (never = 30)
   - `+ rng() * 5`
4. Sort descending, take top `max(3, ceil(25% of survivors))`, pick one uniformly with `rng`.
5. If step 1 yields nothing: return `{ workout: null, reason }` where reason explains which gate
   emptied the list (equipment / cadence / pattern / all bumped), so the UI can offer "ignore
   cadence" or "show all".

**Bump** = call again with the current id appended to `exclude`. Exclusions reset daily.

**Today** is remembered: once a workout is pulled it stays "today's workout" (stored in
`localStorage` as `{date, workoutId}`) until completed, bumped, or the date changes.

## 4. Timer engine (`app/src/domain/timer.ts`, pure state machine, unit-tested)

The engine is a reducer: `(state, event) => state`, driven by a 100ms tick, with `now` passed in.
Events: `start`, `pause`, `resume`, `tick(now)`, `next` (user advances), `roundDone`, `fail`, `finish`.

Per-format phases and cues (cue = `{type:'beep'|'bell'|'countdown', at}`):

| format   | phases                                                             | cues                                          |
|----------|--------------------------------------------------------------------|-----------------------------------------------|
| strength | set 1 … set N, each followed by rest countdown (`restSec`)         | 3-2-1 countdown at end of rest, bell on last  |
| emom     | R rounds of `intervalSec`; show reps due this round                | beep at each round start, 3-2-1 before it     |
| tabata   | per movement: 8 x (20 work / 10 rest); movements sequential        | beep on work start, bell on rest start        |
| interval | R x (workSec / restSec)                                            | same as tabata                                |
| amrap    | single countdown of `durationSec`; `roundDone` increments rounds   | beep at half, 3-2-1 at end, bell on finish    |
| rounds   | stopwatch; `roundDone` increments; auto-finish at `rounds`         | bell at time cap if set                       |
| chipper  | stopwatch; `next` advances movement; finish after last             | bell at time cap if set                       |
| death_by | minute intervals; reps due = minute index; `fail` ends             | beep each minute, 3-2-1 before               |

Every block emits a `10s remaining` cue where a countdown exists. The workout runs blocks in order
with a short "next block" screen between them. Elapsed time and per-block results are collected
into a draft `WorkoutLog`.

Audio: Web Audio API oscillator tones (no asset files). Vibration: `navigator.vibrate` when
available. Screen: `navigator.wakeLock` when available, gracefully ignored otherwise.

## 5. Screens (Preact, mobile-first, one column, large tap targets)

1. **Today** (`/`): today's workout card (name, intensity chip, est. duration, blocks with movement
   names and reps) with **Start** and **Bump**. If none pulled yet: **Get Today's Workout**. If gate
   empties: explain and offer "ignore cadence".
2. **Execute** (`/run/:logDraftId`): big timer, current movement + reps, round counter, phase label,
   pause/next/round-done/fail/finish controls. On finish: results form (weight + reps per loadable
   movement, sets for strength; score; RPE; notes) then Save → History.
3. **Pool** (`/pool`): list with enable toggles, filter by tag/intensity, tap → edit. **Add** opens
   the same editor. Editor: name, intensity, cadence, blocks (format-specific fields), movement
   picker (searchable, can create a new movement inline).
4. **Movements** (`/movements`): list with cadence, last performed, "due in N days"; edit cadence
   and equipment.
5. **History** (`/history`): reverse-chronological logs; tap → detail (snapshot + results).
6. **Settings** (`/settings`): equipment toggles, sound/vibrate/wake-lock, **Export JSON** (download),
   **Import JSON** (file picker, replaces state after confirm), **Reset to seed**.

## 6. Tech

- Vite + Preact + TypeScript, `preact-iso` router, plain CSS (CSS variables, dark mode via
  `prefers-color-scheme`). No component library.
- Storage: `idb-keyval` over IndexedDB. Single `AppState` document; write-through on every change.
  A `Storage` interface (`load(): Promise<AppState|null>`, `save(state)`) so a remote backend can be
  swapped in later.
- PWA: `vite-plugin-pwa` with `registerType: 'autoUpdate'`, manifest with standalone display,
  icons generated as simple SVG-derived PNGs.
- Tests: `vitest` for `domain/*` (select, timer, cadence math, import/export validation).
- Lint/format: `eslint` + `prettier` defaults; `npm run check` = typecheck + lint + test.
- Deploy: GitHub Pages via Actions on push to `main`, building `app/` with `--base=/workout_app/`.
  Replaces the Flutter `deploy.yml`.

## 7. File layout

```
app/
  SPEC.md
  package.json  vite.config.ts  tsconfig.json  index.html
  public/           manifest icons
  seed/
    movements.json  # Movement[]   (curated; aliases cover spreadsheet spellings)
    pool.json       # PoolWorkout[] (curated from xlsx_version/workouts.xlsx)
    README.md       # how the seed was derived, unresolved rows
  src/
    domain/   types.ts  select.ts  timer.ts  cadence.ts  serialize.ts (+ *.test.ts)
    storage/  storage.ts (interface)  idb.ts  seed.ts (first-run load from ../seed)
    state/    store.ts (preact signals or a tiny context)
    ui/       pages/*.tsx  components/*.tsx  audio.ts  wakelock.ts
    main.tsx  app.css
```

## 8. Seed data rules (for `app/seed/`)

- Source: `xlsx_version/workouts_data.json` (already parsed) and `xlsx_version/workouts.xlsx`.
  Sheet4 and Sheet2 are the daily log (Day, date, main movement, accessories, intensity H/M/L,
  format string like "30 on 30 off" / "AMRAP" / "N rounds", second accessory list).
- Each distinct logged workout (main movement + accessory list + format) becomes one `PoolWorkout`.
  De-duplicate exact repeats. Keep rough spreadsheet phrasing in `name`.
- Movement names are normalised into `movements.json` with `aliases` preserving the original
  spelling. Assign `equipment`, `tags`, `cadenceDays`, `loadable` by judgment using
  `project_docs/movements.md` as reference.
- Unparseable rows are listed in `seed/README.md` rather than guessed. Aim for correctness over
  coverage; 30 to 60 good pool entries is plenty.
- Every `movementId` referenced in `pool.json` must exist in `movements.json` (a test enforces it).
