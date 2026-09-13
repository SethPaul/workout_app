/**
 * Pure data-shaping for the Program overview page (`src/ui/pages/Program.tsx`).
 * Kept separate from rendering so it is unit-testable without a DOM: every
 * function here takes `AppState` (+ `now`) and returns a plain object.
 *
 * These are thin views over `src/domain/program/*` (cycle.ts, fatigue.ts,
 * progression.ts, e1rm.ts, context.ts) — this module does not duplicate any
 * of that logic, it just reshapes the results for display.
 */
import { daysSince } from '../domain/cadence';
import { cycleWeek, isDeloadWeek, weekKind } from '../domain/program/cycle';
import { resolveProgram, resolveSettings } from '../domain/program/context';
import { deloadSuggested, fatigueFlags, type FatigueFlag } from '../domain/program/fatigue';
import { currentMax, e1rmHistory } from '../domain/program/e1rm';
import {
  progressionStatus,
  strengthSessionsForMovement,
  type ProgressionStatusValue,
} from '../domain/program/progression';
import type { AppState, WorkoutLog } from '../domain/types';

// --- Cycle ---------------------------------------------------------------

export interface CycleSummary {
  week: number;
  cycleWeeks: number;
  onDeload: boolean;
  deloadDaysRemaining: number | null; // only meaningful when onDeload
  cycleStartedAt: string;
  kind: 1 | 2 | 3;
  kindLabel: string;
  kindDescription: string;
}

const WEEK_KIND_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Base',
  2: 'Build',
  3: 'Peak',
};

const WEEK_KIND_DESCRIPTIONS: Record<1 | 2 | 3, string> = {
  1: 'Lighter opener — targetRpe 7, full sets as written.',
  2: 'Standard working week — targetRpe 8, full sets as written.',
  3: 'Peak week — one fewer set and rep, targetRpe 9.',
};

/** Cycle-week summary (SPEC 9.5): week index, kind (base/build/peak), and any active deload. */
export function cycleSummary(state: AppState, now: Date): CycleSummary {
  const program = resolveProgram(state.program, state.logs, now);
  const settings = resolveSettings(state.settings);
  const week = cycleWeek(program, now, settings);
  const onDeload = isDeloadWeek(program, now);
  const kind = weekKind(week, settings.cycleWeeks);
  const deloadDaysRemaining =
    onDeload && program.deloadWeekStartedAt
      ? Math.max(0, 7 - daysSince(program.deloadWeekStartedAt, now))
      : null;

  return {
    week,
    cycleWeeks: settings.cycleWeeks,
    onDeload,
    deloadDaysRemaining,
    cycleStartedAt: program.cycleStartedAt,
    kind,
    kindLabel: WEEK_KIND_LABELS[kind],
    kindDescription: WEEK_KIND_DESCRIPTIONS[kind],
  };
}

// --- Deload / fatigue ------------------------------------------------------

export interface FlagView extends FatigueFlag {
  dismissed: boolean;
  /** Movement id this flag is scoped to, parsed off `id` (`kind:movementId`), or null for a session-wide flag like `load-spike`. */
  movementId: string | null;
}

export interface LastWorkoutSummary {
  logId: string;
  name: string;
  date: string; // finishedAt
  rpe: number | null;
  /** Ids of currently-active flags whose evidence plausibly involves this log — a movement-scoped flag (e.g. `e1rm-drop:squat`) counts when the last workout logged that movement. `FatigueFlag` carries no direct log reference, so this is inference from the flag id, not a stored link. */
  relatedFlagIds: string[];
}

export interface DeloadOverview {
  suggested: boolean;
  activeFlags: FlagView[];
  dismissedFlags: FlagView[];
  lastWorkout: LastWorkoutSummary | null;
}

function parseFlagMovementId(flagId: string): string | null {
  const idx = flagId.indexOf(':');
  return idx === -1 ? null : flagId.slice(idx + 1);
}

function mostRecentLog(logs: WorkoutLog[]): WorkoutLog | null {
  let latest: WorkoutLog | null = null;
  for (const log of logs) {
    if (!latest || log.finishedAt > latest.finishedAt) latest = log;
  }
  return latest;
}

/** Deload suggestion, fatigue flags (active vs. dismissed), and last-workout attribution (SPEC 9.6). */
export function deloadOverview(state: AppState, now: Date): DeloadOverview {
  const program = resolveProgram(state.program, state.logs, now);
  const allFlags = fatigueFlags(state.logs, now);
  const suggested = deloadSuggested(allFlags, program, state.settings, now);

  const views: FlagView[] = allFlags.map((f) => ({
    ...f,
    dismissed: program.dismissedFlags.includes(f.id),
    movementId: parseFlagMovementId(f.id),
  }));
  const activeFlags = views.filter((f) => !f.dismissed);
  const dismissedFlags = views.filter((f) => f.dismissed);

  const last = mostRecentLog(state.logs);
  let lastWorkout: LastWorkoutSummary | null = null;
  if (last) {
    const movementIds = new Set(last.results.map((r) => r.movementId));
    const relatedFlagIds = activeFlags
      .filter((f) => f.movementId !== null && movementIds.has(f.movementId))
      .map((f) => f.id);
    lastWorkout = {
      logId: last.id,
      name: last.workoutSnapshot.name,
      date: last.finishedAt,
      rpe: last.rpe ?? null,
      relatedFlagIds,
    };
  }

  return { suggested, activeFlags, dismissedFlags, lastWorkout };
}

// --- Progression by movement ------------------------------------------------

export interface ProgressionRow {
  movementId: string;
  name: string;
  status: ProgressionStatusValue;
  currentMax: number | null;
  nextLoad: number | null;
  lastSessionDate: string | null;
  sparkValues: number[]; // e1rm history, oldest first, capped to the last 12 sessions
}

const STATUS_ORDER: Record<ProgressionStatusValue, number> = {
  stall: 0,
  hold: 1,
  progress: 2,
  unknown: 3,
};

/**
 * One row per loadable movement with at least one strength-block session in
 * the logs, sorted stalls first, then holds, then progress (unknown last).
 * `progressionStatus` is the only per-movement call the page needs — the
 * caller (Program.tsx) should memoize this on `state`/`now`.
 */
export function progressionRows(state: AppState, now: Date): ProgressionRow[] {
  const rows: ProgressionRow[] = [];
  for (const movement of state.movements) {
    if (!movement.loadable) continue;
    const sessions = strengthSessionsForMovement(movement.id, state.logs);
    if (sessions.length === 0) continue;

    const prog = progressionStatus(movement, state.logs, state.settings);
    const history = e1rmHistory(state.logs, movement.id);
    rows.push({
      movementId: movement.id,
      name: movement.name,
      status: prog.status,
      currentMax: currentMax(state.logs, movement.id, now),
      nextLoad: prog.nextLoad,
      lastSessionDate: sessions[0]?.log.finishedAt ?? null,
      sparkValues: history.slice(-12).map((p) => p.e1rm),
    });
  }

  return rows.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.name.localeCompare(b.name);
  });
}

// --- Recent trend (last 4 weeks) --------------------------------------------

export interface WeekBucket {
  /** 0 = the most recent 7-day window ending at `now`, 3 = the oldest of the four. */
  weeksAgo: number;
  start: string; // ISO
  end: string; // ISO, exclusive
  sessionCount: number;
  strengthSessionCount: number;
  avgRpe: number | null;
}

/** Sessions/RPE/strength-session counts for each of the last 4 weeks, most recent first. */
export function recentTrend(state: AppState, now: Date): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let weeksAgo = 0; weeksAgo < 4; weeksAgo++) {
    const end = new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const logsInWeek = state.logs.filter((log) => {
      const t = new Date(log.finishedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    const rpes = logsInWeek.map((l) => l.rpe).filter((r): r is number => r !== undefined);
    const strengthCount = logsInWeek.filter((l) =>
      l.workoutSnapshot.blocks.some((b) => b.format === 'strength'),
    ).length;

    buckets.push({
      weeksAgo,
      start: start.toISOString(),
      end: end.toISOString(),
      sessionCount: logsInWeek.length,
      strengthSessionCount: strengthCount,
      avgRpe: rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    });
  }
  return buckets;
}

/** Whether the page's log-derived sections have nothing to show. */
export function hasNoLogs(state: AppState): boolean {
  return state.logs.length === 0;
}
