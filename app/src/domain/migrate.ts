import { earliestLogDate } from './program/context';
import type { AppState, ProgramState, Settings, WorkoutLog } from './types';

/**
 * Upgrades a stored AppState to schemaVersion 2 (SPEC 9.1):
 *  - every log gets `kind` (existing logs migrate to 'pool')
 *  - settings gain the new programming-layer defaults
 *  - a ProgramState is created, with `cycleStartedAt` set to the earliest
 *    logged session (or `now` when there is no history)
 *
 * Idempotent: calling this on an already-migrated (schemaVersion 2, program
 * present) state returns it unchanged, so repeated loads don't keep
 * recomputing `cycleStartedAt` against a moving `now`.
 */
export function migrate(state: AppState, now: string | Date = new Date()): AppState {
  if (state.schemaVersion === 2 && state.program) return state;

  const logs: WorkoutLog[] = state.logs.map((log) => (log.kind ? log : { ...log, kind: 'pool' as const }));

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
