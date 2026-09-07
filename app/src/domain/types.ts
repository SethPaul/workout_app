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

export interface Movement {
  id: string; // slug, e.g. "deadlift"
  name: string; // "Deadlift"
  aliases?: string[]; // spreadsheet spellings that map here
  tags: string[]; // free tags: 'compound','squat','hinge','push','pull','cardio','core','olympic','bodyweight','accessory'
  equipment: Equipment[]; // ALL required; empty or ['none'] = no equipment
  cadenceDays: number; // minimum days between performances. Defaults: compound lifts 7, olympic 3, bodyweight/accessory 3, cardio 1
  unit: Unit; // default measure
  loadable: boolean; // true if weight is logged
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
}

export interface WorkoutLog {
  id: string;
  poolWorkoutId: string;
  workoutSnapshot: PoolWorkout; // copy at time of execution (pool can be edited later)
  startedAt: string; // ISO
  finishedAt: string; // ISO
  score?: string; // e.g. "7 rounds + 3", "12:34", "failed at minute 9"
  results: MovementResult[];
  notes?: string;
  rpe?: number; // 1-10 optional
}

export interface Settings {
  availableEquipment: Equipment[]; // default: everything
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
