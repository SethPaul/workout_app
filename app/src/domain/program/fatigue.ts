import { daysSince } from '../cadence';
import type { ProgramState, Settings, WorkoutLog } from '../types';
import { cycleWeek } from './cycle';
import { earliestLogDate, logKind, resolveSettings } from './context';
import { e1rmHistory } from './e1rm';
import { strengthSessionsForMovement } from './progression';

export interface FatigueFlag {
  id: string;
  text: string;
}

const E1RM_PEAK_WINDOW_DAYS = 56; // 8 weeks
const E1RM_DROP_THRESHOLD = 0.95; // >=5% below peak
const RPE_CREEP_THRESHOLD = 1.5;
const LOAD_SPIKE_RATIO = 1.3;

function distinctMovementIds(logs: WorkoutLog[]): string[] {
  const ids = new Set<string>();
  for (const log of logs) {
    for (const result of log.results) ids.add(result.movementId);
  }
  return [...ids];
}

/**
 * Pool-only logs. Progression/stall/fatigue signals that depend on
 * prescribed reps or sets (e1rm-drop, rpe-creep, missed-reps, and — via
 * `strengthSessionsForMovement` — progression status) must never look at
 * adhoc or max-test logs: their synthetic single-block snapshots carry no
 * prescribed reps/sets to compare against. `load-spike` is exempt (it's a
 * duration x RPE signal with no prescription involved), so it deliberately
 * keeps using the unfiltered log list.
 */
function poolLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.filter((log) => logKind(log) === 'pool');
}

/** e1rm-drop:<movementId> — SPEC 9.6: e1rm >=5% below its 8-week peak in each of the last 2 sessions. */
function e1rmDropFlags(logs: WorkoutLog[], now: string | Date): FatigueFlag[] {
  const pool = poolLogs(logs);
  const flags: FatigueFlag[] = [];
  for (const movementId of distinctMovementIds(pool)) {
    const history = e1rmHistory(pool, movementId);
    if (history.length < 2) continue;
    const peak = Math.max(...history.filter((p) => daysSince(p.date, now) <= E1RM_PEAK_WINDOW_DAYS).map((p) => p.e1rm));
    if (!Number.isFinite(peak) || peak <= 0) continue;
    const lastTwo = history.slice(-2);
    const bothDown = lastTwo.every((p) => p.e1rm <= peak * E1RM_DROP_THRESHOLD);
    if (bothDown) {
      flags.push({
        id: `e1rm-drop:${movementId}`,
        text: `${movementId}: estimated 1RM has dropped ${Math.round((1 - E1RM_DROP_THRESHOLD) * 100)}%+ below its 8-week peak for 2 sessions running.`,
      });
    }
  }
  return flags;
}

/** rpe-creep:<movementId> — SPEC 9.6: same load logged with rpe rising >=1.5 over the last 3 sessions. */
function rpeCreepFlags(logs: WorkoutLog[]): FatigueFlag[] {
  const flags: FatigueFlag[] = [];
  for (const movementId of distinctMovementIds(logs)) {
    const sessions = strengthSessionsForMovement(movementId, logs).slice(0, 3); // most recent first
    if (sessions.length < 3) continue;
    const points = sessions
      .map((s) => {
        const result = s.log.results.find((r) => r.movementId === movementId);
        const weight = result?.sets?.[0]?.weight ?? result?.weight;
        return { weight, rpe: result?.rpe };
      })
      .reverse(); // oldest -> newest
    if (points.some((p) => p.weight === undefined || p.rpe === undefined)) continue;
    const sameLoad = points.every((p) => p.weight === points[0].weight);
    const rising = points[points.length - 1].rpe! - points[0].rpe! >= RPE_CREEP_THRESHOLD;
    if (sameLoad && rising) {
      flags.push({
        id: `rpe-creep:${movementId}`,
        text: `${movementId}: RPE has been creeping up at the same load over the last 3 sessions.`,
      });
    }
  }
  return flags;
}

/** missed-reps:<movementId> — SPEC 9.6: prescribed reps missed in the last 2 sessions. */
function missedRepsFlags(logs: WorkoutLog[]): FatigueFlag[] {
  const flags: FatigueFlag[] = [];
  for (const movementId of distinctMovementIds(logs)) {
    const sessions = strengthSessionsForMovement(movementId, logs).slice(0, 2);
    if (sessions.length < 2) continue;
    const bothMissed = sessions.every((s) => {
      const result = s.log.results.find((r) => r.movementId === movementId);
      const sets = result?.sets ?? [];
      const target = s.bm.reps;
      if (target === undefined || sets.length === 0) return false;
      return !sets.every((set) => set.reps !== undefined && set.reps >= target);
    });
    if (bothMissed) {
      flags.push({
        id: `missed-reps:${movementId}`,
        text: `${movementId}: missed prescribed reps in the last 2 sessions.`,
      });
    }
  }
  return flags;
}

function durationMinutesOf(log: WorkoutLog): number {
  if (log.durationMin !== undefined) return log.durationMin;
  const start = new Date(log.startedAt).getTime();
  const end = new Date(log.finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 60000;
}

/**
 * load-spike — SPEC 9.6: session-RPE x duration summed over 7 days >= 1.3x
 * the 28-day weekly mean. That mean divides by a fixed 4 weeks regardless of
 * how much history exists, so with under 28 days of logs it overstates how
 * "normal" the recent load is and flags brand-new users on their second
 * session. Require at least 28 local days between the earliest log and
 * `now` before this signal fires at all.
 */
function loadSpikeFlag(logs: WorkoutLog[], now: string | Date): FatigueFlag[] {
  const earliest = earliestLogDate(logs);
  if (earliest === null || daysSince(earliest, now) < 28) return [];

  let last7 = 0;
  let last28 = 0;
  for (const log of logs) {
    if (log.rpe === undefined) continue;
    const load = log.rpe * durationMinutesOf(log);
    const age = daysSince(log.finishedAt, now);
    if (age < 7) last7 += load;
    if (age < 28) last28 += load;
  }
  const weeklyMean28 = last28 / 4;
  if (weeklyMean28 > 0 && last7 >= LOAD_SPIKE_RATIO * weeklyMean28) {
    return [
      {
        id: 'load-spike',
        text: 'Training load (session RPE x duration) over the last 7 days is well above your recent average.',
      },
    ];
  }
  return [];
}

/** All fatigue flags currently raised by the log history (SPEC 9.6, R39). */
export function fatigueFlags(logs: WorkoutLog[], now: string | Date): FatigueFlag[] {
  return [...e1rmDropFlags(logs, now), ...rpeCreepFlags(logs), ...missedRepsFlags(logs), ...loadSpikeFlag(logs, now)];
}

/** Whether a deload should be suggested right now (SPEC 9.6). */
export function deloadSuggested(
  flags: FatigueFlag[],
  program: ProgramState,
  settings: Settings,
  now: string | Date,
): boolean {
  const resolved = resolveSettings(settings);
  const week = cycleWeek(program, now);

  if (resolved.deloadPolicy === 'off') return false;
  if (resolved.deloadPolicy === 'calendar') return week === resolved.cycleWeeks + 1;

  // 'fatigue'
  const active = flags.filter((f) => !program.dismissedFlags.includes(f.id));
  if (active.length >= 2) return true;
  if (active.length >= 1 && week >= resolved.cycleWeeks) return true;
  if (week >= 6) return true; // ceiling, regardless of flags
  return false;
}
