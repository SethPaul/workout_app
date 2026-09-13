import { earliestLogDate } from './program/context';
import type { AppState, Movement, ProgramState, Settings, WorkoutLog } from './types';
import { VASA_SEED_MOVEMENTS } from './vasa/seedMovements';

/**
 * Upgrades a stored AppState to schemaVersion 2 (SPEC 9.1):
 *  - every log gets `kind` (existing logs migrate to 'pool')
 *  - settings gain the new programming-layer defaults
 *  - a ProgramState is created, with `cycleStartedAt` set to the earliest
 *    logged session (or `now` when there is no history)
 *
 * Idempotent: calling this on an already-migrated (schemaVersion >= 2,
 * program present) state returns it unchanged, so repeated loads don't keep
 * recomputing `cycleStartedAt` against a moving `now`, and so a v3 state
 * passes through untouched on its way to `migrateToV3`.
 */
function migrateToV2(state: AppState, now: string | Date): AppState {
  if (state.schemaVersion >= 2 && state.program) return state;

  const logs: WorkoutLog[] = state.logs.map((log) =>
    log.kind ? log : { ...log, kind: 'pool' as const },
  );

  const settings: Settings = {
    ...state.settings,
    units: state.settings.units ?? 'lb',
    deloadPolicy: state.settings.deloadPolicy ?? 'fatigue',
    cycleWeeks: state.settings.cycleWeeks ?? 4,
    focus: state.settings.focus ?? 'balanced',
    masters: state.settings.masters ?? false,
  };

  const nowIso = typeof now === 'string' ? now : now.toISOString();
  const program: ProgramState = state.program ?? {
    cycleStartedAt: earliestLogDate(logs) ?? nowIso,
    dismissedFlags: [],
  };

  return { ...state, logs, settings, program, schemaVersion: 2 };
}

/**
 * Upgrades a schemaVersion-2-or-later state to 3 (SPEC 10.2):
 *  - appends 'band' to `settings.availableEquipment` when absent
 *  - appends every `VASA_SEED_MOVEMENTS` entry whose id isn't already
 *    present (existing movements, including their `libraries`, are left
 *    untouched)
 *
 * Idempotent: a state already at schemaVersion 3 with 'band' available and
 * every seed movement present is returned unchanged (by identity).
 */
function migrateToV3(state: AppState): AppState {
  const hasBand = state.settings.availableEquipment.includes('band');
  const existingIds = new Set(state.movements.map((m) => m.id));
  const missingSeedMovements = VASA_SEED_MOVEMENTS.filter((m) => !existingIds.has(m.id));

  if (state.schemaVersion === 3 && hasBand && missingSeedMovements.length === 0) return state;

  const settings: Settings = hasBand
    ? state.settings
    : { ...state.settings, availableEquipment: [...state.settings.availableEquipment, 'band'] };
  const movements: Movement[] =
    missingSeedMovements.length === 0
      ? state.movements
      : [...state.movements, ...missingSeedMovements];

  return { ...state, movements, settings, schemaVersion: 3 };
}

export function migrate(state: AppState, now: string | Date = new Date()): AppState {
  return migrateToV3(migrateToV2(state, now));
}
