import { migrate } from './migrate';
import type { AppState, Block, Format, Movement, PoolWorkout, Settings, WorkoutLog } from './types';

/** Serializes AppState to a JSON string for backup/export. */
export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

function fail(message: string): never {
  throw new Error(`Invalid workout data: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(`expected "${path}" to be an array`);
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') fail(`expected "${path}" to be a string`);
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) fail(`expected "${path}" to be a number`);
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(`expected "${path}" to be a boolean`);
}

const FORMATS = new Set<string>([
  'strength',
  'emom',
  'tabata',
  'interval',
  'amrap',
  'rounds',
  'chipper',
  'death_by',
]);

function assertFormat(value: unknown, path: string): asserts value is Format {
  assertString(value, path);
  if (!FORMATS.has(value)) {
    fail(`expected "${path}" to be one of ${[...FORMATS].join(', ')}, got "${value}"`);
  }
}

/** A non-negative, finite cadence in days. */
function assertCadenceDays(value: unknown, path: string): asserts value is number {
  assertNumber(value, path);
  if (!Number.isFinite(value) || value < 0) {
    fail(`expected "${path}" to be a non-negative finite number`);
  }
}

function assertNoDuplicateIds(ids: string[], kind: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

function validateMovement(value: unknown, index: number): Movement {
  const path = `movements[${index}]`;
  if (!isPlainObject(value)) fail(`${path} must be an object`);
  assertString(value.id, `${path}.id`);
  assertString(value.name, `${path}.name`);
  assertArray(value.tags, `${path}.tags`);
  assertArray(value.equipment, `${path}.equipment`);
  assertCadenceDays(value.cadenceDays, `${path}.cadenceDays`);
  assertString(value.unit, `${path}.unit`);
  assertBoolean(value.loadable, `${path}.loadable`);
  if (value.aliases !== undefined) assertArray(value.aliases, `${path}.aliases`);
  // SPEC 9.1 additions: all optional, validated only when present.
  if (value.progression !== undefined) {
    if (value.progression !== 'linear' && value.progression !== 'double') {
      fail(`expected "${path}.progression" to be "linear" or "double"`);
    }
  }
  if (value.repRange !== undefined) {
    assertArray(value.repRange, `${path}.repRange`);
    if (value.repRange.length !== 2) fail(`expected "${path}.repRange" to have exactly 2 entries`);
    value.repRange.forEach((r, i) => assertNumber(r, `${path}.repRange[${i}]`));
  }
  if (value.increment !== undefined) assertNumber(value.increment, `${path}.increment`);
  return value as unknown as Movement;
}

function validateBlock(value: unknown, poolIndex: number, blockIndex: number): Block {
  const path = `pool[${poolIndex}].blocks[${blockIndex}]`;
  if (!isPlainObject(value)) fail(`${path} must be an object`);
  assertFormat(value.format, `${path}.format`);
  assertArray(value.movements, `${path}.movements`);
  value.movements.forEach((m, i) => {
    const mPath = `${path}.movements[${i}]`;
    if (!isPlainObject(m)) fail(`${mPath} must be an object`);
    assertString(m.movementId, `${mPath}.movementId`);
    if (m.loadPct !== undefined) {
      assertNumber(m.loadPct, `${mPath}.loadPct`);
      if (m.loadPct < 0 || m.loadPct > 100) fail(`expected "${mPath}.loadPct" to be between 0 and 100`);
    }
    if (m.rir !== undefined) {
      assertNumber(m.rir, `${mPath}.rir`);
      if (m.rir < 0 || m.rir > 5) fail(`expected "${mPath}.rir" to be between 0 and 5`);
    }
    if (m.targetRpe !== undefined) assertNumber(m.targetRpe, `${mPath}.targetRpe`);
  });
  return value as unknown as Block;
}

function validatePoolWorkout(value: unknown, index: number): PoolWorkout {
  const path = `pool[${index}]`;
  if (!isPlainObject(value)) fail(`${path} must be an object`);
  assertString(value.id, `${path}.id`);
  assertString(value.name, `${path}.name`);
  assertString(value.intensity, `${path}.intensity`);
  assertArray(value.blocks, `${path}.blocks`);
  value.blocks.forEach((b, i) => validateBlock(b, index, i));
  assertCadenceDays(value.cadenceDays, `${path}.cadenceDays`);
  assertBoolean(value.enabled, `${path}.enabled`);
  assertString(value.source, `${path}.source`);
  return value as unknown as PoolWorkout;
}

const LOG_KINDS = new Set(['pool', 'adhoc', 'max-test']);

function validateWorkoutLog(value: unknown, index: number): WorkoutLog {
  const path = `logs[${index}]`;
  if (!isPlainObject(value)) fail(`${path} must be an object`);
  assertString(value.id, `${path}.id`);
  // SPEC 9.1: poolWorkoutId is optional (absent for adhoc/max-test logs).
  if (value.poolWorkoutId !== undefined) assertString(value.poolWorkoutId, `${path}.poolWorkoutId`);
  if (!isPlainObject(value.workoutSnapshot)) fail(`${path}.workoutSnapshot must be an object`);
  validatePoolWorkout(value.workoutSnapshot, index);
  assertString(value.startedAt, `${path}.startedAt`);
  assertString(value.finishedAt, `${path}.finishedAt`);
  assertArray(value.results, `${path}.results`);
  if (value.kind !== undefined) {
    assertString(value.kind, `${path}.kind`);
    if (!LOG_KINDS.has(value.kind)) fail(`expected "${path}.kind" to be one of pool, adhoc, max-test`);
  }
  if (value.durationMin !== undefined) assertNumber(value.durationMin, `${path}.durationMin`);
  return value as unknown as WorkoutLog;
}

const DEFAULT_SETTINGS_BOOLEANS = { soundOn: true, vibrateOn: true, keepScreenOn: true } as const;

function validateSettings(value: unknown): Settings {
  if (!isPlainObject(value)) fail('"settings" must be an object');
  // availableEquipment has no sensible default: an import missing it is an error.
  assertArray(value.availableEquipment, 'settings.availableEquipment');

  // The three boolean fields may be filled in with defaults when absent, but
  // if present they must be actual booleans.
  const soundOn = value.soundOn === undefined ? DEFAULT_SETTINGS_BOOLEANS.soundOn : value.soundOn;
  const vibrateOn =
    value.vibrateOn === undefined ? DEFAULT_SETTINGS_BOOLEANS.vibrateOn : value.vibrateOn;
  const keepScreenOn =
    value.keepScreenOn === undefined ? DEFAULT_SETTINGS_BOOLEANS.keepScreenOn : value.keepScreenOn;
  assertBoolean(soundOn, 'settings.soundOn');
  assertBoolean(vibrateOn, 'settings.vibrateOn');
  assertBoolean(keepScreenOn, 'settings.keepScreenOn');

  // SPEC 9.1 additions: optional; migrate() fills defaults for anything
  // absent (a v1 export never has these), but a present value must be valid.
  if (value.units !== undefined) {
    assertString(value.units, 'settings.units');
    if (value.units !== 'lb' && value.units !== 'kg') fail('expected "settings.units" to be "lb" or "kg"');
  }
  if (value.deloadPolicy !== undefined) {
    assertString(value.deloadPolicy, 'settings.deloadPolicy');
    if (!['fatigue', 'calendar', 'off'].includes(value.deloadPolicy)) {
      fail('expected "settings.deloadPolicy" to be one of fatigue, calendar, off');
    }
  }
  if (value.cycleWeeks !== undefined) assertNumber(value.cycleWeeks, 'settings.cycleWeeks');
  if (value.focus !== undefined) {
    assertString(value.focus, 'settings.focus');
    if (!['balanced', 'strength', 'conditioning'].includes(value.focus)) {
      fail('expected "settings.focus" to be one of balanced, strength, conditioning');
    }
  }
  if (value.masters !== undefined) assertBoolean(value.masters, 'settings.masters');

  return {
    ...value,
    availableEquipment: value.availableEquipment,
    soundOn,
    vibrateOn,
    keepScreenOn,
  } as unknown as Settings;
}

function validateProgram(value: unknown): AppState['program'] {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('"program" must be an object');
  assertString(value.cycleStartedAt, 'program.cycleStartedAt');
  if (value.deloadWeekStartedAt !== undefined) {
    assertString(value.deloadWeekStartedAt, 'program.deloadWeekStartedAt');
  }
  assertArray(value.dismissedFlags, 'program.dismissedFlags');
  value.dismissedFlags.forEach((f, i) => assertString(f, `program.dismissedFlags[${i}]`));
  return value as unknown as AppState['program'];
}

/**
 * Parses and validates a JSON export back into an AppState. Throws a
 * readable Error describing the first problem found.
 */
export function importState(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    fail(`could not parse JSON (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!isPlainObject(parsed)) fail('root value must be an object');
  if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
    fail(`unsupported schemaVersion "${String(parsed.schemaVersion)}" (expected 1 or 2)`);
  }

  assertArray(parsed.movements, 'movements');
  const movements = parsed.movements.map((m, i) => validateMovement(m, i));
  assertNoDuplicateIds(
    movements.map((m) => m.id),
    'movement',
  );

  assertArray(parsed.pool, 'pool');
  const pool = parsed.pool.map((w, i) => validatePoolWorkout(w, i));
  assertNoDuplicateIds(
    pool.map((w) => w.id),
    'pool workout',
  );

  assertArray(parsed.logs, 'logs');
  const logs = parsed.logs.map((l, i) => validateWorkoutLog(l, i));

  const settings = validateSettings(parsed.settings);

  const movementIds = new Set(movements.map((m) => m.id));
  for (const workout of pool) {
    for (const block of workout.blocks) {
      for (const m of block.movements) {
        if (!movementIds.has(m.movementId)) {
          fail(
            `pool workout "${workout.id}" references unknown movementId "${m.movementId}" ` +
              `(not present in movements)`,
          );
        }
      }
    }
  }

  const program = validateProgram(parsed.program);

  const raw: AppState = {
    movements,
    pool,
    logs,
    settings,
    schemaVersion: parsed.schemaVersion,
    program,
  };
  // Upgrades a v1 import to v2 (SPEC 9.1) and is a no-op on an already-full v2 import.
  return migrate(raw);
}
