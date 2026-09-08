import { signal } from '@preact/signals';
import { migrate } from '../domain/migrate';
import { applyWave, cycleWeek, isDeloadWeek } from '../domain/program/cycle';
import { resolveProgram } from '../domain/program/context';
import { selectWorkout, type SelectInput, type SelectResult } from '../domain/select';
import type { AppState, PoolWorkout, ProgramState, WorkoutLog } from '../domain/types';
import type { Storage } from '../storage/storage';
import { IdbStorage } from '../storage/idb';
import { buildSeedState } from '../storage/seed';

/** The whole application state, or null before init() resolves. */
export const state = signal<AppState | null>(null);

let storage: Storage = new IdbStorage();

/** Swap the backing Storage (tests, or a future remote backend). */
export function setStorage(next: Storage): void {
  storage = next;
}

/** Loads AppState from storage, seeding it on first run. */
export async function init(): Promise<void> {
  const loaded = await storage.load();
  if (loaded) {
    state.value = migrate(loaded);
    return;
  }
  const seeded = await buildSeedState();
  state.value = seeded;
  await storage.save(seeded);
}

/** Applies `fn` to the current state and writes the result through to storage. */
export async function update(fn: (current: AppState) => AppState): Promise<void> {
  if (!state.value) throw new Error('store.update called before init()');
  const next = fn(state.value);
  state.value = next;
  await storage.save(next);
}

// --- Programming layer (SPEC 9.9) --------------------------------------

/** Appends an ad-hoc or max-test WorkoutLog (SPEC 9.8) built by `program/adhoc.ts`. */
export async function logAdhoc(log: WorkoutLog): Promise<void> {
  await update((s) => ({ ...s, logs: [...s.logs, log] }));
}

/**
 * Merges `patch` into the WorkoutLog with `id` and persists it, stamping
 * `editedAt` so History can show an "edited" hint. Used by the EditLog page
 * to save changes to a saved log's results, score, RPE, notes, or timing.
 */
export async function updateLog(id: string, patch: Partial<WorkoutLog>, now: Date = new Date()): Promise<void> {
  await update((s) => ({
    ...s,
    logs: s.logs.map((log) => (log.id === id ? { ...log, ...patch, editedAt: now.toISOString() } : log)),
  }));
}

/** Permanently removes the WorkoutLog with `id`. */
export async function deleteLog(id: string): Promise<void> {
  await update((s) => ({ ...s, logs: s.logs.filter((log) => log.id !== id) }));
}

/** Starts a deload week now: sets `program.deloadWeekStartedAt` (SPEC 9.6). */
export async function acceptDeload(now: Date = new Date()): Promise<void> {
  await update((s) => {
    const program = resolveProgram(s.program, s.logs, now);
    return { ...s, program: { ...program, deloadWeekStartedAt: now.toISOString() } };
  });
}

/** Dismisses fatigue flags for the rest of the cycle (SPEC 9.6 "Not now"). */
export async function dismissFlags(ids: string[]): Promise<void> {
  await update((s) => {
    const program = resolveProgram(s.program, s.logs, new Date());
    const dismissed = new Set([...program.dismissedFlags, ...ids]);
    return { ...s, program: { ...program, dismissedFlags: [...dismissed] } };
  });
}

/** Starts a fresh cycle: resets `cycleStartedAt`, clears the deload and dismissed flags (SPEC 9.5). */
export async function startNewCycle(now: Date = new Date()): Promise<void> {
  const fresh: ProgramState = { cycleStartedAt: now.toISOString(), dismissedFlags: [] };
  await update((s) => ({ ...s, program: fresh }));
}

// --- "today's workout" (SPEC section 3) -------------------------------
// Remembered separately from AppState, in localStorage, since it is
// day-scoped UI state rather than durable history.

export interface TodayWorkout {
  date: string; // YYYY-MM-DD, local to the device
  workoutId: string | null;
  excluded: string[]; // bumped ids; reset when the date changes
  /**
   * The cycle-wave-transformed copy of today's pulled workout (SPEC 9.5),
   * set by `pullToday`. This is what should be run and logged, so the
   * prescribed sets/reps/RPE reflect the current cycle week/deload rather
   * than the raw pool entry.
   */
  snapshot?: PoolWorkout;
}

const TODAY_KEY = 'todayWorkout';

function todayDateString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readLocalStorage(): TodayWorkout | null {
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TodayWorkout;
  } catch {
    return null; // localStorage unavailable (SSR/tests/private mode), or corrupt JSON
  }
}

function writeLocalStorage(value: TodayWorkout | null): void {
  try {
    if (value) localStorage.setItem(TODAY_KEY, JSON.stringify(value));
    else localStorage.removeItem(TODAY_KEY);
  } catch {
    // ignore: nothing we can do if storage is unavailable
  }
}

export const todayWorkout = signal<TodayWorkout | null>(readLocalStorage());

/**
 * Returns today's remembered workout, or null if none has been pulled yet
 * or the stored entry is from a previous day (exclusions reset daily).
 */
export function currentTodayWorkout(now: Date = new Date()): TodayWorkout | null {
  const current = todayWorkout.value;
  if (!current || current.date !== todayDateString(now)) return null;
  return current;
}

/** Records that `workoutId` was pulled as today's workout, optionally with its wave-transformed snapshot. */
export function setTodayWorkout(workoutId: string, now: Date = new Date(), snapshot?: PoolWorkout): void {
  const existing = currentTodayWorkout(now);
  const next: TodayWorkout = {
    date: todayDateString(now),
    workoutId,
    excluded: existing?.excluded ?? [],
    snapshot,
  };
  todayWorkout.value = next;
  writeLocalStorage(next);
}

export interface PullTodayInput extends Omit<SelectInput, 'exclude'> {
  now: Date;
  /** Current AppState.program; defaulted (SPEC 9.1) via `resolveProgram` when absent. */
  program?: ProgramState;
}

/**
 * Pulls today's workout (SPEC section 3) and, when one is found, computes
 * the cycle-wave-transformed snapshot for the current week/deload state
 * (SPEC 9.5) and remembers it via `setTodayWorkout` so the run/log flow
 * uses the transformed prescription rather than the raw pool entry.
 */
export function pullToday(input: PullTodayInput): SelectResult {
  const existing = currentTodayWorkout(input.now);
  const result = selectWorkout({ ...input, exclude: existing?.excluded ?? [] });
  if (result.workout) {
    const programState = resolveProgram(input.program, input.logs, input.now);
    const week = cycleWeek(programState, input.now);
    const deload = isDeloadWeek(programState, input.now);
    const snapshot = applyWave(result.workout, week, deload, input.settings, input.movements);
    setTodayWorkout(result.workout.id, input.now, snapshot);
  }
  return result;
}

/** Bumps the current workout: adds it to the excluded list and clears the pick. */
export function bumpTodayWorkout(now: Date = new Date()): void {
  const existing = currentTodayWorkout(now);
  const excluded = existing?.workoutId
    ? [...existing.excluded, existing.workoutId]
    : (existing?.excluded ?? []);
  const next: TodayWorkout = { date: todayDateString(now), workoutId: null, excluded };
  todayWorkout.value = next;
  writeLocalStorage(next);
}

/** Clears today's remembered workout entirely (e.g. after it's completed). */
export function clearTodayWorkout(): void {
  todayWorkout.value = null;
  writeLocalStorage(null);
}
