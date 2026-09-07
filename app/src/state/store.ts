import { signal } from '@preact/signals';
import type { AppState } from '../domain/types';
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
    state.value = loaded;
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

// --- "today's workout" (SPEC section 3) -------------------------------
// Remembered separately from AppState, in localStorage, since it is
// day-scoped UI state rather than durable history.

export interface TodayWorkout {
  date: string; // YYYY-MM-DD, local to the device
  workoutId: string | null;
  excluded: string[]; // bumped ids; reset when the date changes
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

/** Records that `workoutId` was pulled as today's workout. */
export function setTodayWorkout(workoutId: string, now: Date = new Date()): void {
  const existing = currentTodayWorkout(now);
  const next: TodayWorkout = {
    date: todayDateString(now),
    workoutId,
    excluded: existing?.excluded ?? [],
  };
  todayWorkout.value = next;
  writeLocalStorage(next);
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
