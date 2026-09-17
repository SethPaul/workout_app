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

### 3.1 The hopper (bump behaviour)

Mental model: each day the gates in step 1–2 produce a **viable list** (the hopper). **Bump** surfaces
another workout from the hopper without repeating one already bumped today. Exclusions are applied
*after* the gates, never before, so running out of hopper is reported as such rather than as a
cadence failure.

- `viableWorkouts(input): { viable: PoolWorkout[]; reason: SelectReason }` (`select.ts`, exported):
  enabled → equipment → cadence → pattern → weekly-need restriction, ignoring `exclude`.
  `reason` names the gate that emptied the list, or `'ok'`. `ignoreCadence` skips the cadence and
  pattern gates (equipment still applies).
- `selectWorkout` = `viableWorkouts` minus `exclude`, then score/slice/pick as in step 3–4. When the
  viable list is non-empty but every entry is excluded, the result is `{ workout: null, reason:
  'excluded' }`. `SelectResult` gains `hopper: { viable: PoolWorkout[]; remaining: PoolWorkout[] }`
  (`remaining` = viable minus excluded; the current pick is part of it).
- `TodayWorkout` (store, localStorage) gains `mode: 'viable' | 'all'` (absent = `'viable'`).
  `pullToday` passes `ignoreCadence: input.ignoreCadence ?? mode === 'all'`. `bumpTodayWorkout`
  keeps `mode` and `excluded`. New: `resetHopper(now)` clears `excluded` and `workoutId`, keeps
  `mode`; `setHopperMode(mode, now)` sets `mode`, keeps `excluded`, clears `workoutId`. Both are
  followed by a pull in the UI. Mode is day-scoped like the exclusions.
- Today screen:
  - With a workout showing: a muted status line under the card, "Hopper: N of M left" (N =
    `remaining.length`, M = `viable.length`), suffixed " · all workouts" in `'all'` mode.
  - `reason === 'excluded'`: banner "You've bumped through all M workouts in today's hopper."
    Buttons: **Start over** (`resetHopper` + pull), **Use all workouts** (`setHopperMode('all')` +
    pull; hidden when already in `'all'` mode), **Pick a workout** (link to `/enter`).
  - `reason === 'cadence' | 'pattern'` (nothing viable from the start): the existing message, then
    **Use all workouts** (sets the persistent `'all'` mode, so later bumps keep working) and
    **Pick a workout**. The one-shot "Ignore cadence and pick anyway" is replaced by this.
  - `reason === 'equipment' | 'no-enabled'`: existing message plus **Pick a workout**.
  - Bumping in `'all'` mode cycles through every enabled, equipment-OK workout; exhausting that is
    again `'excluded'` with **Start over** and **Pick a workout**.

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
- **Seed revisions** (`app/src/domain/seedRevision.ts`, `app/seed/expand.py`). The seed is only
  copied into storage on first run, so a later pool expansion would never reach an existing
  install without a destructive "Reset to seed data". Instead the seed carries a revision:
  - `SEED_REVISION` is the revision shipped in `app/seed/*.json`. Every workout added in revision
    N ≥ 2 carries the tag `seed:vN`; the original seed is untagged and counts as revision 1.
  - `AppState.seedRevision` (optional; absent = 1) is the revision an install has been brought up
    to. `buildSeedState` stamps it; `importState` preserves it when present.
  - `store.init` runs `catchUpSeed` after `migrate`: when the stored revision is behind, it
    appends every seed workout whose revision is newer than the stored one and whose id is not
    already present, plus any movement those workouts reference that the state lacks, stamps
    `seedRevision`, and saves. Existing entries are never modified. Workouts from a revision the
    install has already seen are never re-added, so a seed workout the user deleted stays deleted.
  - Adding content: append the workouts (tagged `seed:v<N+1>`) and any new movements, bump
    `SEED_REVISION`, run `validate.py`. `expand.py` is revision 2: 45 workouts and 8 movements
    designed against `project_docs/training_evidence.md` (strength, power, stamina, recovery), which
    is why the pool now exceeds the "30 to 60" guideline above; quality over coverage still applies.
- `day:*` tags name a workout's role in the week: `day:deadlift-press` (mandatory, gated weekly),
  `day:squat-strength`, `day:hinge-strength`, `day:press-strength`, `day:pull-strength`,
  `day:oly-power`, `day:conditioning` (the 4-day split's conditioning-priority day), `day:zone2`,
  `day:hiit`, `day:recovery` (active recovery, deload and stability sessions). Only the first
  `day:*` tag is read by `dayType`; `day:zone2`/`day:hiit` also feed the conditioning focus
  multiplier (9.7).

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

export interface SetResult {          // addition
  rpe?: number;                       // per-set RPE entered by the user (optional, 1-10)
}

export interface MovementResult {     // addition
  rpe?: number;                       // per-movement RPE of the hardest set (optional, 1-10)
}
```
`SetResult.rpe` is the per-set RPE entered by the user; `MovementResult.rpe` is derived as the
max over sets on save (it stays stored for the programming layer).
```ts

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

## 10. Vasa studio mode (quick logging of coached LFT classes)

Context: the user attends Vasa's studio LFT (lifting) classes, typically Tuesday and Thursday. The
coach supplies the workout one block at a time, so nothing is selected or timed by the app; the app
only needs to make *logging* fast enough to do during a rest interval. Every input is optional: a
log with a single deadlift weight is valid.

### 10.1 Class structure (what the log models)

- **Main** block: 1 or 2 complex movements (e.g. back squat, pull-up), sets × reps, loaded.
- **Accessory 1** and **Accessory 2**: supersets of 2 or 3 movements (e.g. band tricep extension
  paired with incline fly).
- **Finisher**: always 2 minutes of something; core movements (dead bugs, planks) show up here.
- Weekly focus: Mon/Tue **lower** body, Wed/Thu **upper** body, Fri/Sat/Sun **full** body. The day
  of week sets the *default* region filter for movement selection; the user can override it.
- Four training styles a class may be labelled with: **Build** (strength), **Pump** (hypertrophy),
  **Power**, **Brawn** (advanced strength). Optional per log.
- Studio equipment: squat rack, kettlebells, barbells, bumper plates, dumbbells, bands, landmine,
  adjustable bench, plyo box. `'band'` is a new `Equipment` value.

### 10.2 Types (additions to `src/domain/types.ts`)

```ts
export type Equipment = /* existing */ | 'band';
export type MovementLibrary = 'default' | 'vasa';   // "my default list" vs "Vasa movements"
export type BodyRegion = 'lower' | 'upper' | 'full';
export type VasaStyle = 'build' | 'pump' | 'power' | 'brawn';

export interface Movement {              // additions
  libraries?: MovementLibrary[];         // absent = ['default']; a movement can be in both
  region?: BodyRegion;                   // explicit override; otherwise derived from tags (10.3)
}
export interface VasaMeta { region: BodyRegion; style?: VasaStyle; }
export interface WorkoutLog {            // additions
  kind?: 'pool' | 'adhoc' | 'max-test' | 'vasa';
  vasa?: VasaMeta;                       // present iff kind === 'vasa'
}
export interface AppState { schemaVersion: 1 | 2 | 3; }
```

Migration to schemaVersion 3 (`src/domain/migrate.ts`, idempotent): appends `'band'` to
`settings.availableEquipment` when absent, and appends every movement from
`src/domain/vasa/seedMovements.ts` whose id is not already present. `buildSeedState` includes the
same seed movements on first run. Existing movements are left untouched (absent `libraries` reads
as `['default']`). `serialize.ts` accepts `kind: 'vasa'`, `vasa`, `libraries`, `region`, `'band'`.

### 10.3 Domain (`src/domain/vasa/*`, pure, unit-tested)

- `region.ts`
  - `regionForDate(date: Date): BodyRegion` — Mon/Tue lower, Wed/Thu upper, else full (local day).
  - `movementRegion(m: Movement): BodyRegion` — `m.region` if set; else lower when any tag in
    `squat, legs, hinge, unilateral`, upper when any tag in `push, pull, gymnastics`; both → full;
    neither (core, cardio, carry, plyo only) → full.
  - `matchesRegion(m, region)` — `region === 'full'` accepts all; otherwise accepts movements whose
    region equals it **or is `full`** (so core/finisher movements always surface).
  - `REGION_LABELS: Record<BodyRegion, string>` — Lower, Upper, Full body.
- `library.ts`
  - `movementLibraries(m): MovementLibrary[]` (absent → `['default']`), `inLibrary(m, lib)`,
    `withLibrary(m, lib): Movement` (adds without duplicating).
  - `VASA_EQUIPMENT: Equipment[]` = rack, pullup_bar (the rack carries one), barbell, kettlebell,
    dumbbell, band, landmine, bench, plyo_box, box, none. `availableAtVasa(m)`: every required equipment is in that list (empty or
    `['none']` → true).
  - `VASA_STYLES`, `VASA_STYLE_LABELS` (Build · strength, Pump · hypertrophy, Power, Brawn · advanced
    strength).
  - `newVasaMovement(input: { name; region: BodyRegion; existingIds: string[]; loadable?; equipment? })
    : Movement` — id = `slugify(name)` made unique against `existingIds` with a `_2`, `_3` suffix;
    `libraries: ['vasa']`, `region`, `tags: []`, `equipment` (default `['none']`), `cadenceDays: 3`,
    `unit: 'reps'`, `loadable` default true.
- `search.ts`
  - `searchMovements(movements, query, opts: { region: BodyRegion; logs: WorkoutLog[]; now: Date;
    limit?: number }): Movement[]` — case-insensitive match on name and aliases when `query` is
    non-empty (no match → excluded); ranked by score, ties by name: exact name +100, any word of the
    name/alias starts with the query +50, substring +20; in the `vasa` library +10; passes
    `matchesRegion` +8 and exact region +4 (only when `region !== 'full'`); performed in the last 30
    days +3; not `availableAtVasa` −15 (ranked down, never hidden). Default limit 8.
  - `hasExactName(movements, query): boolean` — case/whitespace-insensitive equality on name or
    alias; the UI shows a "Create “…”" row only when false.
- `build.ts`
  - ```ts
    export interface VasaSetInput { weight?: number; reps?: number; }
    export interface VasaMovementInput { movementId: string; sets: VasaSetInput[]; notes?: string; }
    export interface VasaBlockInput { role: 'main' | 'accessory' | 'finisher'; title: string; movements: VasaMovementInput[]; }
    export interface BuildVasaLogInput { date: string | Date; region: BodyRegion; style?: VasaStyle;
      blocks: VasaBlockInput[]; notes?: string; rpe?: number; id?: string; }
    export function buildVasaLog(input: BuildVasaLogInput): WorkoutLog;
    ```
    Blocks with no movements are dropped. `main`/`accessory` blocks → `format: 'strength'`,
    `sets` = the largest set count among their movements (min 1), `title` as given.
    `finisher` → `format: 'amrap'`, `durationSec: 120`. Snapshot: id `vasa-<logId>`, name
    `Vasa LFT · <Region label>` plus ` · <Style label>` when a style is set, `intensity: 'M'`,
    `cadenceDays: 0`, `enabled: false`, `source: 'manual'`, `tags: ['vasa', 'region:<r>', 'style:<s>'?]`.
    Results: one `MovementResult` per movement per block with `blockIndex`, `sets` holding only
    sets that have a weight or reps (may be empty), `notes`. `startedAt = finishedAt =` the given
    instant (a date-only string means local noon), `kind: 'vasa'`, `vasa: { region, style }`.
    Because these are strength blocks, Vasa logs feed last-performed, the pattern cadence gate, e1rm
    history, progression and fatigue flags exactly like pool logs (a Vasa squat day correctly delays a
    garage squat day).
  - `lastVasaSets(logs, movementId): { date: string; sets: SetResult[] } | null` — the most recent
    log of any kind containing the movement, for a "last time" hint.
- `src/domain/program/context.ts`: `logKind` unchanged (returns the union including `'vasa'`).

### 10.4 Store (`src/state/store.ts`)

`logVasa(log: WorkoutLog)`: appends the log **and** marks every movement it references as being in
the `vasa` library (`withLibrary`), so the Vasa library grows from use. New movements created inline
are added via the existing `update`.

### 10.5 Screen: `/vasa` (Preact, `src/ui/pages/Vasa.tsx`)

Optimised for one-thumb entry between sets. Draft persisted to `localStorage` key
`workout_app.vasaDraft` on every change (same pattern as `state/run.ts`) and restored on open, so a
reload mid-class loses nothing; cleared on Save or Discard.

1. Top bar: back, title "Vasa LFT". Row: date input (default today). Region chips Lower / Upper /
   Full body, default `regionForDate(date)` (re-defaults when the date changes unless the user has
   tapped a chip). Style chips Build / Pump / Power / Brawn, optional, tap again to clear.
2. Four block cards, always present, titled Main, Accessory 1, Accessory 2, Finisher (2 min).
   Each shows its movements and an **+ Add movement** button that opens an inline picker: a search
   input (autofocused), the top `searchMovements` results for the current region, and, when the
   query has no exact name match, a final row **Create “<query>”** that calls `newVasaMovement`
   (region = current chip, saved to state immediately) and adds it. Picking a movement adds it with
   one blank set (main/accessory) or one blank entry (finisher).
3. Movement row (main/accessory): name, a muted "last: 185×8, 185×8 · 3 Sep" line from
   `lastVasaSets` when available, then one line per set with weight and reps inputs (both optional,
   `inputMode` decimal/numeric), a remove-set button, and **+ Set** which prefills the new set from
   the previous one (the common case is "same again"). Finisher rows: name plus a single free-text
   note input (e.g. "3 rounds", "20 each side"). A remove-movement control on every row.
4. Notes textarea and RPE input (both optional). **Save** is enabled once any block has a movement;
   it calls `buildVasaLog` → `logVasa` → routes to `/history/<id>`. **Discard** clears the draft after
   confirmation.

Entry points: a **Log a Vasa class** button on Today (below the workout card / get button) and a
link on History next to "Log something else". History and HistoryDetail label these logs
"Vasa"; HistoryDetail shows region and style. EditLog must open Vasa logs without error (the generic
results editor is acceptable).

### 10.6 Movements library UI

- Movements page: filter chips All / Default / Vasa (via `inLibrary`), a small "Vasa" chip on rows in
  that library, and a region filter Lower / Upper / Full (via `matchesRegion`).
- Movement editor: library checkboxes (Default, Vasa) and a region select (Auto / Lower / Upper /
  Full body, where Auto clears the override and shows the derived value).
- `EQUIPMENT_LABELS` gains `band: 'Bands'`; `ALL_EQUIPMENT` (seed.ts) and `seed/validate.py` gain
  `'band'`.

### 10.7 Catalog search and on-the-fly movement creation (logging page)

Goal: while logging a class, be confident in a few taps that a movement is or is not already in
the catalog, and if not, add it properly (not with blind defaults) without leaving the page.

**Search (`src/domain/vasa/search.ts`, replaces the 10.3 matching rules; scoring boosts unchanged)**

- `normalizeText(s)`: lowercase, replace every non-alphanumeric run with a space, collapse and trim.
  So "Pull-up" ≡ "pull up" ≡ "pullup"? No: hyphen and space both become a space, so "pull up"
  matches "Pull-up"; "pullup" matches via substring of the space-stripped form (see below).
- `singular(token)`: `ies` → `y`, else strip one trailing `s` unless the token ends in `ss` or is
  3 characters or shorter. Applied to every token of both the query and the candidate.
- `expandAbbreviation(token)`: `db` → `dumbbell`, `kb` → `kettlebell`, `bb` → `barbell`,
  `rdl` → `romanian deadlift`, `ohp` → `overhead press`, `bss` → `bulgarian split squat`,
  `sl` → `single leg`, `sa` → `single arm`. Applied to query tokens only.
- Match tiers for a query against each candidate string (name and every alias), best wins:
  - exact: normalized+singularized strings equal → 100
  - ordered word prefixes: every query token prefix-matches a distinct candidate word, in order
    ("inc db fly" → "Incline Dumbbell Fly") → 60
  - unordered word prefixes: every query token prefix-matches a distinct candidate word → 50
  - substring: the space-stripped query is a substring of the space-stripped candidate
    ("pullup" → "pull up") → 20
  - otherwise 0 (excluded when the query is non-empty)
- `hasExactName` uses the same normalized+singularized equality ("dead bugs" ≡ "Dead Bug").
- `similarMovements(movements, query, limit = 3)`: the top-scoring matches by the tiers above
  (ignoring library/region/recency boosts), for the "did you mean" row.
- Default `limit` stays 8 for an empty query; the UI passes 20 when a query is present so nothing
  that matches is hidden.

**`newVasaMovement` (`library.ts`)** gains optional `unit?: Unit` (default `'reps'`) and
`tags?: string[]` (default `[]`).

**UI (`src/ui/pages/Vasa.tsx` + new `src/ui/components/NewMovementSheet.tsx`)**

1. Picker results show a subtitle line: region label · equipment labels (or "No equipment"), so
   near-duplicates are distinguishable at a glance.
2. When the query is non-empty and `hasExactName` is false, the picker shows a
   **Create “<query>”…** row: first in the list when there are no matches, last otherwise.
3. Tapping it swaps the picker for the **New movement** sheet, still inside the block card:
   - Name (text input, prefilled with the query, editable).
   - "Already have: " chips for `similarMovements` when any exist; tapping one adds that existing
     movement to the block instead of creating.
   - Region chips Lower / Upper / Full body; default `full` for the Finisher block, otherwise the
     draft's current region.
   - Equipment chips from `VASA_EQUIPMENT` minus `'none'` (labels from `EQUIPMENT_LABELS`),
     multi-select; nothing selected saves as `['none']`.
   - "Log weight" toggle (`loadable`), default on; "Measure" chips Reps / Seconds (`unit`).
   - Primary button **Add to <block title>**, secondary **Back** (returns to the picker with the
     query intact). Add creates the movement (`libraries: ['vasa']`), persists it via `update`,
     adds it to the block, and closes the sheet. The name must be non-empty; if it now exactly
     matches an existing movement, that movement is used instead of creating a duplicate.
4. A created movement's row on the logging page keeps a small link to `/movements/<id>` ("edit")
   so cadence, tags or aliases can be fixed later without hunting for it.

### 10.8 Entered workouts join the pool; pool workouts are startable (supersedes 10.3 `build.ts`, 10.4, 10.5)

Reframing: a class the coach gives us is just a workout we didn't have yet. So the entry screen
becomes **Enter a workout** (`/enter`), general in wording, whose product is a **`PoolWorkout`** —
not a separate log kind. Results are logged by the existing Run screen (which already supports
logging during the workout), so there is one way to run and one way to log.

Two flows, both ending on `/run`:
1. **Search the pool → pick a workout → Start.**
2. **Search the pool → not found → enter a new workout → it is saved to the pool → Start.**

**Removed**: `WorkoutLog.kind: 'vasa'`, `VasaMeta`, `WorkoutLog.vasa`, `buildVasaLog`,
`lastVasaSets`, `store.logVasa`, and every "Vasa" label in History/HistoryDetail/EditLog. Logs from
these workouts are ordinary `kind: 'pool'` logs with a `poolWorkoutId`. Kept: `Movement.libraries`
(the Vasa library facet), `Movement.region`, `BodyRegion`, `VasaStyle`, `'band'`, search, the
New movement sheet, schemaVersion 3.

**Pool workout shape** (`src/domain/vasa/pool.ts`):
```ts
export interface EnteredMovement { movementId: string; sets?: number; reps?: number; seconds?: number; }
export interface EnteredBlock { role: 'main' | 'accessory' | 'finisher'; title: string; movements: EnteredMovement[]; }
export interface BuildEnteredWorkoutInput {
  name?: string;               // default: defaultWorkoutName(...)
  date: string;                // YYYY-MM-DD (for the default name)
  region: BodyRegion; style?: VasaStyle;
  blocks: EnteredBlock[]; notes?: string; id?: string;
}
export function defaultWorkoutName(region, style, date): string;   // "Lower · Build · Sep 15" (no style: "Lower · Sep 15")
export function buildEnteredWorkout(input): PoolWorkout;
export function workoutRegion(w: PoolWorkout): BodyRegion | null;  // from a `region:<r>` tag
export function workoutStyle(w: PoolWorkout): VasaStyle | null;    // from a `style:<s>` tag
export function isEnteredWorkout(w: PoolWorkout): boolean;         // tags include 'vasa'
export function searchPool(pool: PoolWorkout[], movements: Movement[], query: string,
  opts: { region: BodyRegion; logs: WorkoutLog[]; now: Date; limit?: number }): PoolWorkout[];
```
- `buildEnteredWorkout`: empty blocks dropped. main/accessory → `format: 'strength'`, `sets` =
  the largest `sets` among its movements, default 3; each movement carries `reps`/`seconds` when
  given. finisher → `format: 'amrap'`, `durationSec: 120`. `id` = `entered-<generated>` unless
  given, `intensity: 'M'`, `cadenceDays: 14`, `enabled: true`, `source: 'manual'`,
  `tags: ['vasa', 'region:<r>', 'style:<s>'?]`, `notes`.
- `searchPool`: `search.ts` exports `textMatchScore(query, candidates: string[]): number` (the 10.7
  tiers over arbitrary strings). A workout's candidates are its name, its tags, and the names of
  its movements. Non-empty query: score 0 excludes. Boosts: `workoutRegion` equals `opts.region`
  +8 (only when region !== 'full'); entered workout +4; last performed within 30 days +3 (recently
  entered class workouts float up); disabled −5 (still shown). Ties by name. Default limit 8; the UI
  passes 20 with a query.

**Store** (`src/state/store.ts`):
- `addPoolWorkout(w: PoolWorkout)`: appends to `pool` and adds every referenced movement to the
  `vasa` library (`withLibrary`) when `isEnteredWorkout(w)`.
- `chooseTodayWorkout(id: string, now = new Date()): PoolWorkout | null`: sets today's workout to
  the pool entry with that id. The snapshot is `applyWave(...)` (SPEC 9.5) for ordinary pool
  workouts, but the untouched workout for entered ones (the coach's prescription is not waved).
  Returns the snapshot. Clears any bumped exclusions for that id.

**Screen `/enter`** (`src/ui/pages/EnterWorkout.tsx`, replaces `Vasa.tsx`; draft module renamed
`src/ui/enterDraft.ts` with the same persistence key semantics under `workout_app.enterDraft`):
1. Top bar "Enter a workout". A search input "Search the pool…" (autofocus). Results from
   `searchPool` with the day's region (`regionForDate(today)`, no chips needed here): name, a
   one-line block summary (`blockMetaLine`/movement names, first 3 movements + "…"), last done or
   "never". Tapping a row expands it in place: the full `BlockSummary` list and two buttons,
   **Start** (primary: `chooseTodayWorkout` then `beginRunSession(state, snapshot)` then
   `route('/run')`, with the same "already in progress" confirm as Today) and **Make it today's**
   (`chooseTodayWorkout` then `route('/')`).
2. Under the results, always: **Enter a new workout** button (wording "Not here? Enter a new
   workout" when a query has no results). It opens the composer below the search (search collapses
   to a single line "← Back to search").
3. Composer: name input (placeholder shows `defaultWorkoutName`), date, region chips (default by
   weekday, re-defaults on date change unless touched), style chips (optional), the four block
   cards (Main, Accessory 1, Accessory 2, Finisher (2 min)) with the 10.7 picker and New movement
   sheet unchanged. A main/accessory movement row is one line: name · `sets` input · "×" · `reps`
   input (both optional, numeric) · remove. A finisher row: name · `seconds` input (optional,
   placeholder "seconds") · remove. Notes textarea. Draft persisted on every change.
4. Buttons: **Save & start** (primary; enabled once any block has a movement): `buildEnteredWorkout`
   → `addPoolWorkout` → `chooseTodayWorkout(id)` → `beginRunSession` → `/run`, clearing the draft.
   **Save to pool** (secondary): same without starting; routes to `/pool/<id>`. **Discard** (ghost).
5. Entry points: Today's button becomes **Enter a workout** (href `/enter`); History's second
   button is removed (History keeps "Log something else"). Pool page rows keep linking to the
   editor; the editor gains a **Make it today's** button (`chooseTodayWorkout` → `/`).
