export type Equipment =
  | 'barbell'
  | 'kettlebell'
  | 'dumbbell'
  | 'rack'
  | 'bench'
  | 'pullup_bar'
  | 'rings'
  | 'rower'
  | 'bike'
  | 'box'
  | 'jump_rope'
  | 'medball'
  | 'wall'
  | 'sandbag'
  | 'sled'
  | 'ghd'
  | 'ab_wheel'
  | 'trx'
  | 'cable'
  | 'landmine'
  | 'plyo_box'
  | 'none';

export type Unit = 'reps' | 'meters' | 'calories' | 'seconds';

/** SPEC 9.1: display/increment units. Logs always store the number as entered. */
export type Units = 'lb' | 'kg';

export interface Movement {
  id: string; // slug, e.g. "deadlift"
  name: string; // "Deadlift"
  aliases?: string[]; // spreadsheet spellings that map here
  tags: string[]; // free tags: 'compound','squat','hinge','push','pull','cardio','core','olympic','bodyweight','accessory'
  equipment: Equipment[]; // ALL required; empty or ['none'] = no equipment
  cadenceDays: number; // minimum days between performances. Defaults: compound lifts 7, olympic 3, bodyweight/accessory 3, cardio 1
  unit: Unit; // default measure
  loadable: boolean; // true if weight is logged
  // --- SPEC 9.1 additions (programming layer) ---
  // Optional so state constructed before the programming layer existed (and
  // UI code/tests this workstream does not own) keeps typechecking; program/*
  // consumers resolve a default via program/context.ts's `resolveMode` etc.
  progression?: 'linear' | 'double'; // default: linear for barbell lifts, double for everything else
  repRange?: [number, number]; // double progression range, default [6, 8] accessory, [3, 5] main
  increment?: number; // load step in settings.units; default by equipment/pattern, see program/rpe.ts
}

export type Format =
  | 'strength' // sets x reps of one movement, rest between sets
  | 'emom' // every N seconds for R rounds, do the listed work
  | 'tabata' // 8 x (20s work / 10s rest) per movement
  | 'interval' // R rounds of (workSec on / restSec off), e.g. "30 on 30 off"
  | 'amrap' // as many rounds as possible in durationSec
  | 'rounds' // R rounds for time (stopwatch, optional timeCapSec)
  | 'chipper' // one pass through the list for time (stopwatch)
  | 'death_by'; // minute 1 = 1 rep, minute 2 = 2 reps ... until failure

export interface BlockMovement {
  movementId: string;
  reps?: number; // per round/set (or starting reps for death_by, ladder start)
  distanceM?: number; // for cardio
  calories?: number;
  seconds?: number; // for holds
  loadNote?: string; // free text, e.g. "heavy", "70% 1RM", "bodyweight"
  repScheme?: number[]; // optional explicit per-round reps, e.g. [21,15,9] or [50,40,30,20,10]
  loadPct?: number; // structured target load, 0-100 (% of 1RM)
  rir?: number; // reps in reserve target, 0-5
  targetRpe?: number; // SPEC 9.1: default 8 for strength main/accessory lifts, 6 during deload
}

export interface Block {
  format: Format;
  title?: string; // e.g. "Warm-up", "Main", "Finisher"
  movements: BlockMovement[];
  sets?: number; // strength
  rounds?: number; // emom/interval/rounds/tabata(default 8)
  intervalSec?: number; // emom (default 60)
  workSec?: number; // interval/tabata
  restSec?: number; // interval/tabata/strength (rest between sets)
  durationSec?: number; // amrap
  timeCapSec?: number; // rounds/chipper/strength optional cap
  alternate?: boolean; // emom: alternate movements per round instead of all each round
}

export type Intensity = 'H' | 'M' | 'L';

export interface PoolWorkout {
  id: string;
  name: string;
  intensity: Intensity;
  blocks: Block[];
  cadenceDays: number; // minimum days between repeating this exact workout (default 14)
  enabled: boolean;
  tags?: string[]; // e.g. 'deadlift-day', 'slog', 'diversity'
  source: 'spreadsheet' | 'manual';
  notes?: string;
}

export interface SetResult {
  weight?: number;
  reps?: number;
}

export interface MovementResult {
  movementId: string;
  sets?: SetResult[]; // strength: one per set; other formats: optional single entry
  weight?: number; // load used, if loadable
  reps?: number; // total reps or reps per round
  notes?: string;
  rpe?: number; // SPEC 9.1: per-movement RPE of the hardest set, 1-10
}

export interface WorkoutLog {
  id: string;
  // Was required; SPEC 9.1 makes it optional (adhoc/max-test logs have none).
  poolWorkoutId?: string;
  workoutSnapshot: PoolWorkout; // copy at time of execution (pool can be edited later)
  startedAt: string; // ISO
  finishedAt: string; // ISO
  score?: string; // e.g. "7 rounds + 3", "12:34", "failed at minute 9"
  results: MovementResult[];
  notes?: string;
  rpe?: number; // 1-10 optional
  // --- SPEC 9.1 additions ---
  // Optional (rather than the spec's bare `kind`) so pre-programming-layer
  // WorkoutLog literals elsewhere in the app (this workstream does not own
  // src/ui/) keep typechecking; treat an absent kind as 'pool' (see
  // `program/context.ts`'s `logKind`). migrate() stamps it explicitly on
  // stored state.
  kind?: 'pool' | 'adhoc' | 'max-test';
  durationMin?: number; // derived from startedAt/finishedAt when both exist
}

export interface Settings {
  availableEquipment: Equipment[]; // default: everything
  soundOn: boolean;
  vibrateOn: boolean;
  keepScreenOn: boolean;
  // --- SPEC 9.1 additions (programming layer) ---
  // Optional (rather than the spec's bare fields) so Settings literals in
  // code/tests outside this workstream's ownership (src/ui/) keep
  // typechecking without edits; program/context.ts's `resolveSettings`
  // fills every default in one place for internal consumers.
  units?: Units; // default 'lb'
  deloadPolicy?: 'fatigue' | 'calendar' | 'off'; // default 'fatigue'
  cycleWeeks?: number; // default 4; calendar deload every cycleWeeks+1th week
  focus?: 'balanced' | 'strength' | 'conditioning'; // default 'balanced'
  masters?: boolean; // default false; true extends pattern cadence to 3 days (R44)
}

/** SPEC 9.1: stored program/cycle state. */
export interface ProgramState {
  cycleStartedAt: string; // ISO date of the current cycle's first session
  deloadWeekStartedAt?: string; // set when a deload is accepted; cleared after 7 days
  dismissedFlags: string[]; // fatigue flag ids the user dismissed this cycle
}

export interface AppState {
  movements: Movement[];
  pool: PoolWorkout[];
  logs: WorkoutLog[];
  settings: Settings;
  schemaVersion: 1 | 2;
  // Optional so pre-programming-layer AppState literals (src/ui/ tests this
  // workstream does not own) keep typechecking; migrate() always populates
  // it for stored state, and program/context.ts's `resolveProgram` gives
  // internal consumers a default when it's absent.
  program?: ProgramState;
}
