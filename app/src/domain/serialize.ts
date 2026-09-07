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

function validateWorkoutLog(value: unknown, index: number): WorkoutLog {
  const path = `logs[${index}]`;
  if (!isPlainObject(value)) fail(`${path} must be an object`);
  assertString(value.id, `${path}.id`);
  assertString(value.poolWorkoutId, `${path}.poolWorkoutId`);
  if (!isPlainObject(value.workoutSnapshot)) fail(`${path}.workoutSnapshot must be an object`);
  validatePoolWorkout(value.workoutSnapshot, index);
  assertString(value.startedAt, `${path}.startedAt`);
  assertString(value.finishedAt, `${path}.finishedAt`);
  assertArray(value.results, `${path}.results`);
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

  return {
    availableEquipment: value.availableEquipment,
    soundOn,
    vibrateOn,
    keepScreenOn,
  } as unknown as Settings;
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
  if (parsed.schemaVersion !== 1) {
    fail(`unsupported schemaVersion "${String(parsed.schemaVersion)}" (expected 1)`);
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

  return { movements, pool, logs, settings, schemaVersion: 1 };
}
