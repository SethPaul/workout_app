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

## 9. Programming layer (progression, autoregulation, deloads)

Evidence: `project_docs/training_evidence.md` R27-R44. Everything here is derived from logs; nothing
changes the pool data itself. All computations are pure functions in `src/domain/program/*` and
unit-tested.

### 9.1 Types (additions)

```ts
export type Units = 'lb' | 'kg';

export interface Movement {           // additions
  progression?: 'linear' | 'double'; // default: linear for barbell lifts, double for everything else
  repRange?: [number, number];        // double progression range, default [6, 8] accessory, [3, 5] main
  increment?: number;                 // load step in settings.units; default lower-body barbell 10 lb / 5 kg,
                                      // upper-body barbell 5 lb / 2.5 kg, dumbbell/kettlebell 5 lb / 2 kg
}

export interface BlockMovement {      // addition
  targetRpe?: number;                 // default 8 for strength main lifts, 8 for accessory, 6 during deload
}

export interface MovementResult {     // addition
  rpe?: number;                       // per-movement RPE of the hardest set (optional, 1-10)
}

export interface WorkoutLog {         // additions
  kind: 'pool' | 'adhoc' | 'max-test'; // existing logs migrate to 'pool'
  poolWorkoutId?: string;             // absent for adhoc and max-test
  durationMin?: number;               // derived from startedAt/finishedAt when both exist
}

export interface Settings {           // additions
  units: Units;                       // default 'lb'
  deloadPolicy: 'fatigue' | 'calendar' | 'off'; // default 'fatigue'
  cycleWeeks: number;                 // default 4; calendar deload every cycleWeeks+1th week
  focus: 'balanced' | 'strength' | 'conditioning'; // default 'balanced'
  masters: boolean;                   // default false; true extends pattern cadence to 3 days (R44)
}

export interface ProgramState {       // stored in AppState
  cycleStartedAt: string;             // ISO date of the current cycle's first session
  deloadWeekStartedAt?: string;       // set when a deload is accepted; cleared after 7 days
  dismissedFlags: string[];           // fatigue flag ids the user dismissed this cycle
}
```

### 9.2 Estimated 1RM (R37)
`e1rm(weight, reps)` = Epley `w * (1 + reps/30)`, only for `1 <= reps <= 10`. Per movement,
`e1rmHistory(logs, movementId)` yields `{date, e1rm, source: 'estimate' | 'max-test'}` per session
using the best set that session. `currentMax(movementId)`: a `max-test` log within 56 days wins;
otherwise the max e1rm over the last 8 weeks; otherwise null.

### 9.3 Load prescription (R36, R38)
`RPE_TABLE[reps][rpe]` = fraction of 1RM (Helms/Zourdos RIR table, reps 1-10, RPE 6-10).
`suggestLoad(movement, reps, targetRpe, logs, units)` = `round(currentMax * RPE_TABLE[reps][rpe])` to
the nearest `increment/2`, or null when no max is known (UI then shows "log a set to calibrate").
`loadPct` on a BlockMovement, when present, overrides the table.

### 9.4 Progression and stalls (R30-R33)
`progressionStatus(movement, logs)` looks at the last two strength-block sessions of the movement:
- **linear**: success = every prescribed set hit target reps at `rpe <= targetRpe + 0.5` (missing
  RPE counts as success). Next target = last load + `increment`. Two consecutive non-successes = stall.
- **double**: success = every set reached `repRange[1]`. Next = load + increment, reps reset to
  `repRange[0]`; else reps target = last reps + 1. Two sessions without any rep or load gain = stall.
- **stall action**: suggest `load * 0.9` for one session, then resume; second stall in a cycle
  suggests a scheme change (5x5 → 3x5 or shift rep range) as text.
The Today card and Run screen show the suggested load per set from 9.3 adjusted by 9.4; the results
form prefills it.

### 9.5 Cycle wave (R34, R35)
`cycleWeek(programState, now)` = 1-based week index. Strength blocks of a pulled workout are
transformed at selection time (the snapshot stores the transformed block):
- week 1: sets as written, targetRpe 7
- week 2: sets as written, targetRpe 8
- week 3: sets - 1 (min 3), reps - 1 (min 2 for olympic, 3 otherwise), targetRpe 9
- week 4 (if `cycleWeeks` = 4): as week 2
- deload week (see 9.6): sets × 0.5 (round up, min 2), targetRpe 6, conditioning blocks: AMRAP/rounds
  durations × 0.6, intervals rounds × 0.6; `notes` gains "Deload week".
A new cycle starts the day after a deload week ends, or after `cycleWeeks` weeks when no deload was
taken and policy is 'off'.

### 9.6 Fatigue flags and deload (R39-R41)
`fatigueFlags(logs, now)` returns flags with ids and human text:
- `e1rm-drop:<movementId>`: e1rm ≥ 5% below its 8-week peak in each of the last 2 sessions
- `rpe-creep:<movementId>`: same load logged with rpe rising ≥ 1.5 over the last 3 sessions
- `missed-reps:<movementId>`: prescribed reps missed in the last 2 sessions
- `load-spike`: session-RPE × durationMin summed for the last 7 days ≥ 1.3 × the 28-day weekly mean
  (flag only, low confidence; never sufficient alone)
`deloadSuggested(flags, programState, settings, now)`:
- policy 'fatigue': ≥ 2 non-dismissed flags, or ≥ 1 flag plus cycle week ≥ `cycleWeeks`, or cycle
  week ≥ 6 (ceiling)
- policy 'calendar': cycle week == `cycleWeeks` + 1
- policy 'off': never
The Today screen shows a banner "Deload suggested" with the flag texts, **Start deload week** and
**Not now** (dismisses these flags for the cycle). Accepting sets `deloadWeekStartedAt`.

### 9.7 Focus and masters (R42-R44)
`focus` multiplies the selection score: strength ×1.5 for workouts whose first block is strength or
Power, conditioning ×1.5 for `day:zone2`, `day:hiit`, and conditioning-only workouts. `masters` sets
every `PATTERN_CADENCE_DAYS` entry ≥ 2 to 3 and appends a longer ramp-up note to strength blocks.

### 9.8 Ad-hoc and max-test logging
History gains **Log something else**. Form: date (default today), movements (searchable picker, add
several), per movement a list of sets (weight, reps, optional rpe), notes, and a **This was a max
test** toggle. Saves a `WorkoutLog` with `kind: 'adhoc' | 'max-test'`, no `poolWorkoutId`, and a
synthetic `workoutSnapshot` (one strength block per movement, `source: 'manual'`, id `adhoc-<logId>`).
Ad-hoc logs count for last-performed, pattern cadence, e1rm history, and fatigue flags exactly like
pool logs. Max-test logs feed `currentMax` directly (9.2).

### 9.9 UI summary
- **Today**: cycle week chip ("Week 2 of 4"), deload banner, suggested loads on the card.
- **Run**: suggested load and target RPE per set; results form prefilled; per-movement RPE field.
- **Movements → detail**: current max (estimate or tested, with date), e1rm trend (last 12 sessions,
  inline SVG sparkline), progression status and next target, PRs (best e1rm, best single).
- **History**: "Log something else"; adhoc and max-test rows marked.
- **Settings**: units, deload policy, cycle length, focus, masters; changing units converts nothing,
  it only labels and sets increments (logs store the number as entered).
