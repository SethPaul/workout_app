import type { ProgramState, Settings, Units, WorkoutLog } from '../types';

/**
 * SPEC 9.1 gave the programming-layer `Settings`/`WorkoutLog`/`AppState`
 * fields as required, but they were made optional on the stored types (see
 * types.ts) so pre-existing state literals elsewhere in the app (notably
 * src/ui/, owned by a different workstream) keep typechecking without being
 * touched. This module is the single place that resolves those defaults for
 * every program/* consumer, so "optional in storage, defaulted in logic" is
 * applied consistently.
 */

export type DeloadPolicy = NonNullable<Settings['deloadPolicy']>;
export type Focus = NonNullable<Settings['focus']>;

export interface ResolvedSettings extends Settings {
  units: Units;
  deloadPolicy: DeloadPolicy;
  cycleWeeks: number;
  focus: Focus;
  masters: boolean;
}

export const DEFAULT_UNITS: Units = 'lb';
export const DEFAULT_DELOAD_POLICY: DeloadPolicy = 'fatigue';
export const DEFAULT_CYCLE_WEEKS = 4;
export const DEFAULT_FOCUS: Focus = 'balanced';
export const DEFAULT_MASTERS = false;

/** Fills every SPEC 9.1 Settings default. Safe to call on already-resolved settings. */
export function resolveSettings(settings: Settings): ResolvedSettings {
  return {
    ...settings,
    units: settings.units ?? DEFAULT_UNITS,
    deloadPolicy: settings.deloadPolicy ?? DEFAULT_DELOAD_POLICY,
    cycleWeeks: settings.cycleWeeks ?? DEFAULT_CYCLE_WEEKS,
    focus: settings.focus ?? DEFAULT_FOCUS,
    masters: settings.masters ?? DEFAULT_MASTERS,
  };
}

/** A log's programming-layer kind, treating a missing (pre-migration) value as 'pool'. */
export function logKind(log: WorkoutLog): NonNullable<WorkoutLog['kind']> {
  return log.kind ?? 'pool';
}

/** Earliest `finishedAt` across all logs, or null if there are none. */
export function earliestLogDate(logs: WorkoutLog[]): string | null {
  let earliest: string | null = null;
  for (const log of logs) {
    if (earliest === null || log.finishedAt < earliest) earliest = log.finishedAt;
  }
  return earliest;
}

/**
 * Resolves a ProgramState, defaulting to a fresh cycle starting at the
 * earliest logged session (or `now` if there is no history) when absent.
 * Mirrors the migration rule in `domain/migrate.ts`.
 */
export function resolveProgram(
  program: ProgramState | undefined,
  logs: WorkoutLog[],
  now: string | Date,
): ProgramState {
  if (program) return program;
  const nowIso = typeof now === 'string' ? now : now.toISOString();
  return {
    cycleStartedAt: earliestLogDate(logs) ?? nowIso,
    dismissedFlags: [],
  };
}
