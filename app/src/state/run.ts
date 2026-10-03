import { signal } from '@preact/signals';
import {
  createTimer,
  timerReducer,
  type Cue,
  type TimerEvent,
  type TimerState,
} from '../domain/timer';
import type { AppState, Block, BodyRegion, PoolWorkout } from '../domain/types';
import {
  buildEnteredWorkout,
  defaultWorkoutName,
  workoutRegion,
  workoutStyle,
} from '../domain/vasa/pool';
import { regionForDate } from '../domain/vasa/region';
import {
  createWarmup,
  restoreWarmup,
  warmupReducer,
  type WarmupEvent,
  type WarmupState,
} from '../domain/warmup';
import {
  applyBlockOutcomes,
  blockMovementDrafts,
  buildResultsDraft,
  withSetCount,
  type ResultsDraft,
} from '../ui/resultsDraft';

export interface RunSession {
  poolWorkoutId: string;
  workoutSnapshot: PoolWorkout;
  startedAt: string; // ISO
  timer: TimerState;
  // The in-progress results draft, editable from mid-workout as well as the
  // finished screen (SPEC: enter weights/reps/RPE during the workout).
  draft: ResultsDraft;
  /**
   * Set when this session was rehydrated from localStorage (a reload or app
   * restart interrupted the run). Lets the UI tell the user their timer was
   * paused rather than silently losing time. Cleared on `resume`.
   */
  restoredAt?: string; // ISO
  /**
   * The pre-start warm-up stopwatch (`domain/warmup.ts`), shown while the
   * timer is idle. Optional so sessions persisted before it existed restore.
   */
  warmup?: WarmupState;
  /**
   * A live workout: blocks are picked as the class goes (`appendLiveBlock`)
   * and the finished workout is added to the pool when the log is saved.
   */
  live?: boolean;
}

// --- Persistence (mirrors store.ts's TODAY_KEY handling) -----------------
// The in-progress run is day-scoped, ephemeral UI state (like today's pick),
// so it's kept in localStorage rather than the durable AppState/IdbStorage.

const RUN_KEY = 'workout_app.runSession';

/** How often a `tick` event is allowed to persist (ms); avoids a localStorage
 * write on every 100ms tick while the timer is running. */
const TICK_PERSIST_INTERVAL_MS = 2000;

let lastPersistedAt = 0;

function isPlausibleRunSession(value: unknown): value is RunSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.timer === 'object' &&
    v.timer !== null &&
    typeof v.workoutSnapshot === 'object' &&
    v.workoutSnapshot !== null &&
    typeof v.draft === 'object' &&
    v.draft !== null
  );
}

/**
 * Reads the persisted run session, if any, restoring it to a safe state:
 * a session that was `running` when the page unloaded comes back `paused`
 * (we can't know how long the browser was closed, so we never resume the
 * clock silently), and any stale pending cues are dropped so nothing beeps
 * on load. Returns null when nothing is stored, or the stored value is
 * missing/corrupt/unusable.
 */
function readPersistedRun(): RunSession | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlausibleRunSession(parsed)) return null;
    const session = parsed;
    const timer: TimerState = { ...session.timer, pendingCues: [] };
    if (timer.status === 'running') {
      timer.status = 'paused';
      delete timer._lastTickAt;
    }
    const warmup = session.warmup ? restoreWarmup(session.warmup) : undefined;
    return { ...session, timer, warmup, restoredAt: new Date().toISOString() };
  } catch {
    return null; // localStorage unavailable (SSR/tests/private mode), or corrupt JSON
  }
}

function writePersistedRun(session: RunSession | null): void {
  try {
    if (session) localStorage.setItem(RUN_KEY, JSON.stringify(session));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // ignore: nothing we can do if storage is unavailable
  }
}

/** The in-progress workout run, if any. Null when nothing is running. */
export const runSession = signal<RunSession | null>(readPersistedRun());

/** Starts a fresh run session for `workout` (does not itself dispatch 'start'). */
export function beginRunSession(
  appState: AppState,
  workout: PoolWorkout,
  now: Date = new Date(),
): void {
  const session: RunSession = {
    poolWorkoutId: workout.id,
    workoutSnapshot: workout,
    startedAt: now.toISOString(),
    timer: createTimer(workout.blocks, now.getTime()),
    draft: buildResultsDraft(appState, workout),
    warmup: createWarmup(),
  };
  runSession.value = session;
  lastPersistedAt = now.getTime();
  writePersistedRun(session);
}

function isoDateOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Starts a live run session: no blocks yet — the Run screen asks for each
 * block's movements as the workout goes (`appendLiveBlock`). The snapshot is
 * an entered (Vasa) workout so it joins the pool like one when saved.
 */
export function beginLiveSession(appState: AppState, now: Date = new Date()): void {
  const workout = buildEnteredWorkout({
    date: isoDateOf(now),
    region: regionForDate(now),
    blocks: [],
  });
  const session: RunSession = {
    poolWorkoutId: workout.id,
    workoutSnapshot: workout,
    startedAt: now.toISOString(),
    timer: createTimer([], now.getTime(), { live: true }),
    draft: buildResultsDraft(appState, workout),
    warmup: createWarmup(),
    live: true,
  };
  runSession.value = session;
  lastPersistedAt = now.getTime();
  writePersistedRun(session);
}

/** Live sessions: adds the next block (and its draft entries) and starts it. */
export function appendLiveBlock(
  appState: AppState,
  block: Block,
  now: number = Date.now(),
): TimerState | null {
  const session = runSession.value;
  if (!session?.live) return null;
  const blockIndex = session.workoutSnapshot.blocks.length;
  runSession.value = {
    ...session,
    workoutSnapshot: {
      ...session.workoutSnapshot,
      blocks: [...session.workoutSnapshot.blocks, block],
    },
    draft: {
      ...session.draft,
      movements: [...session.draft.movements, ...blockMovementDrafts(appState, block, blockIndex)],
    },
  };
  return dispatchRun({ type: 'appendBlock', block, now });
}

/** Live sessions: changes the workout's body region (and its default name, unless renamed). */
export function setLiveRegion(region: BodyRegion): void {
  const session = runSession.value;
  if (!session?.live) return;
  const w = session.workoutSnapshot;
  const date = isoDateOf(new Date(session.startedAt));
  const style = workoutStyle(w) ?? undefined;
  const oldRegion = workoutRegion(w);
  const renamed = !oldRegion || w.name !== defaultWorkoutName(oldRegion, style, date);
  const next: RunSession = {
    ...session,
    workoutSnapshot: {
      ...w,
      name: renamed ? w.name : defaultWorkoutName(region, style, date),
      tags: [...(w.tags ?? []).filter((t) => !t.startsWith('region:')), `region:${region}`],
    },
  };
  runSession.value = next;
  writePersistedRun(next);
}

/**
 * Keeps an open-sets block's snapshot and draft in step with the timer: one
 * draft set per set started, and once the block ends, a plain strength block
 * with `sets` = the sets actually done (so the saved workout repeats as an
 * ordinary pool workout).
 */
function syncOpenSets(
  snapshot: PoolWorkout,
  draft: ResultsDraft,
  prev: TimerState,
  timer: TimerState,
): { snapshot: PoolWorkout; draft: ResultsDraft } {
  let blocks = snapshot.blocks;
  for (const outcome of timer.blockOutcomes.slice(prev.blockOutcomes.length)) {
    if (outcome.setsDone === undefined) continue;
    const ended = blocks[outcome.blockIndex];
    if (!ended?.openSets) continue;
    const normalized: Block = { ...ended, sets: outcome.setsDone };
    delete normalized.openSets;
    blocks = blocks.map((b, i) => (i === outcome.blockIndex ? normalized : b));
    draft = withSetCount(draft, outcome.blockIndex, outcome.setsDone!);
  }
  const current = blocks[timer.blockIndex];
  const setIndex = timer.phase.setIndex;
  if (current?.openSets && setIndex !== undefined) {
    draft = withSetCount(draft, timer.blockIndex, setIndex);
  }
  return { snapshot: blocks === snapshot.blocks ? snapshot : { ...snapshot, blocks }, draft };
}

/** Dispatches a timer event against the current run session's timer, returning the cues it fired. */
export function dispatchRun(event: TimerEvent): TimerState | null {
  const session = runSession.value;
  if (!session) return null;
  const timer = timerReducer(session.timer, event);
  const { snapshot, draft: synced } =
    event.type === 'tick'
      ? { snapshot: session.workoutSnapshot, draft: session.draft }
      : syncOpenSets(session.workoutSnapshot, session.draft, session.timer, timer);
  const draft =
    timer.blockOutcomes.length !== session.timer.blockOutcomes.length
      ? applyBlockOutcomes(synced, timer.blockOutcomes, snapshot)
      : synced;
  const next: RunSession = {
    ...session,
    workoutSnapshot: snapshot,
    timer,
    draft,
    // Resuming means the reload note no longer applies.
    restoredAt: event.type === 'resume' ? undefined : session.restoredAt,
  };
  runSession.value = next;

  // Ticks fire every 100ms; only persist them at most every
  // TICK_PERSIST_INTERVAL_MS. Every other event persists immediately.
  if (event.type === 'tick') {
    if (event.now - lastPersistedAt >= TICK_PERSIST_INTERVAL_MS) {
      lastPersistedAt = event.now;
      writePersistedRun(next);
    }
  } else {
    lastPersistedAt = event.now;
    writePersistedRun(next);
  }
  return timer;
}

/**
 * Dispatches a warm-up stopwatch event against the current run session,
 * returning the cues it fired (a bell when the target is reached). Ticks are
 * throttled to storage exactly like timer ticks; everything else persists
 * immediately. A session without a warm-up (persisted before the feature)
 * gets one on the first event.
 */
export function dispatchWarmup(event: WarmupEvent): Cue[] {
  const session = runSession.value;
  if (!session) return [];
  const { warmup, cues } = warmupReducer(session.warmup ?? createWarmup(), event);
  if (warmup === session.warmup) return cues;
  const next: RunSession = { ...session, warmup };
  runSession.value = next;

  if (event.type === 'tick') {
    if (event.now - lastPersistedAt >= TICK_PERSIST_INTERVAL_MS) {
      lastPersistedAt = event.now;
      writePersistedRun(next);
    }
  } else {
    if ('now' in event) lastPersistedAt = event.now;
    writePersistedRun(next);
  }
  return cues;
}

/** Clears the run session (after saving/discarding a run). */
export function clearRunSession(): void {
  runSession.value = null;
  writePersistedRun(null);
}

/** Updates the current run session's results draft (mid-workout entry, or the finished screen's form). */
export function updateRunDraft(fn: (draft: ResultsDraft) => ResultsDraft): void {
  const session = runSession.value;
  if (!session) return;
  const next: RunSession = { ...session, draft: fn(session.draft) };
  runSession.value = next;
  writePersistedRun(next);
}
