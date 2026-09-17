import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { viableWorkouts, type SelectReason } from '../../domain/select';
import { estimateWorkoutSeconds, formatDurationMin } from '../../domain/estimate';
import { weeklyNeed } from '../../domain/weekly';
import { cycleWeek, isDeloadWeek } from '../../domain/program/cycle';
import { resolveProgram, resolveSettings } from '../../domain/program/context';
import { fatigueFlags, deloadSuggested, type FatigueFlag } from '../../domain/program/fatigue';
import {
  acceptDeload,
  bumpTodayWorkout,
  currentTodayWorkout,
  dismissFlags,
  pullToday,
  resetHopper,
  setHopperMode,
  state,
  todayWorkout,
} from '../../state/store';
import { beginRunSession, clearRunSession, runSession } from '../../state/run';
import { BlockSummary } from '../components/BlockSummary';
import { INTENSITY_LABELS } from '../helpers';
import type { PoolWorkout } from '../../domain/types';

/** The hopper counts shown in the status line under the card (SPEC 3.1). */
interface Hopper {
  viable: PoolWorkout[];
  remaining: PoolWorkout[];
}

const REASON_MESSAGES: Record<SelectReason, string> = {
  'no-enabled': 'No workouts are enabled in your pool yet. Enable some in the Pool tab.',
  equipment: "Every remaining workout needs equipment you don't have available right now.",
  cadence: 'Everything eligible is still on cooldown — every movement or workout needs more rest.',
  pattern:
    'Everything eligible would repeat a heavy squat/hinge/push/pull/olympic pattern too soon — give it another day or two.',
  excluded: "You've bumped every eligible workout for today.",
  ok: '',
};

const NEEDED_MESSAGES: Record<string, string> = {
  'deadlift-press': 'Deadlift + push press day is due this week.',
};

const RUN_STATUS_LABELS: Record<string, string> = {
  idle: 'Ready to start',
  running: 'In progress',
  paused: 'Paused',
  'between-blocks': 'Between blocks',
  finished: 'Ready to log results',
};

export function Today() {
  const s = state.value!;
  const location = useLocation();
  // Reading the signal directly keeps this component subscribed to changes
  // made by setTodayWorkout/bumpTodayWorkout elsewhere.
  void todayWorkout.value;
  const inProgress = runSession.value;
  const today = currentTodayWorkout();
  const [failReason, setFailReason] = useState<SelectReason | null>(null);
  const [hopper, setHopper] = useState<Hopper | null>(null);
  const now = new Date();
  const mode = today?.mode ?? 'viable';

  // SPEC 9.5/9.9: the card renders today's wave-transformed snapshot, not
  // the raw pool entry — that's what carries the current week's targetRpe,
  // set counts, and (during a deload) scaled-down prescription.
  const workout: PoolWorkout | null =
    today?.snapshot ??
    (today?.workoutId ? (s.pool.find((w) => w.id === today.workoutId) ?? null) : null);
  const needed = weeklyNeed(s.logs, now);

  const program = resolveProgram(s.program, s.logs, now);
  const settings = resolveSettings(s.settings);
  const week = cycleWeek(program, now);
  const onDeload = isDeloadWeek(program, now);
  const cycleChipLabel = onDeload ? 'Deload week' : `Week ${week} of ${settings.cycleWeeks}`;

  const allFlags = fatigueFlags(s.logs, now);
  const activeFlags: FatigueFlag[] = allFlags.filter((f) => !program.dismissedFlags.includes(f.id));
  const showDeloadBanner = !onDeload && deloadSuggested(allFlags, program, s.settings, now);

  // SPEC 3.1: on a reload, a workout is remembered (today.workoutId) but no
  // SelectResult is in component state, so the status line would be blank.
  // Recompute the hopper counts from the remembered mode/exclusions once.
  useEffect(() => {
    if (hopper !== null || !today?.workoutId) return;
    const { viable } = viableWorkouts({
      pool: s.pool,
      movements: s.movements,
      logs: s.logs,
      settings: s.settings,
      now,
      ignoreCadence: mode === 'all',
    });
    const remaining = viable.filter((w) => !today.excluded.includes(w.id));
    setHopper({ viable, remaining });
    // Intentionally runs once on mount: this reconstructs the counts for a
    // workout the store already remembered, it doesn't react to later pulls
    // (those flow through runSelection instead).
    // (No react-hooks/exhaustive-deps configured in this project's eslint.)
  }, []);

  /** Pulls today's workout; the hopper mode (persisted on `today`) decides `ignoreCadence` (SPEC 3.1). */
  function runSelection() {
    const result = pullToday({
      pool: s.pool,
      movements: s.movements,
      logs: s.logs,
      settings: s.settings,
      now,
      program: s.program,
    });
    setHopper(result.hopper);
    setFailReason(result.workout ? null : result.reason);
  }

  function bump() {
    bumpTodayWorkout();
    runSelection();
  }

  /** SPEC 3.1 "Start over": clears today's bumped exclusions and pulls again. */
  function startOver() {
    resetHopper(now);
    runSelection();
  }

  /** SPEC 3.1 "Use all workouts": switches to the persistent 'all' hopper mode and pulls again. */
  function useAllWorkouts() {
    setHopperMode('all', now);
    runSelection();
  }

  function start() {
    if (!workout) return;
    if (
      runSession.value &&
      !confirm('A workout is already in progress. Discard it and start this one instead?')
    ) {
      return;
    }
    beginRunSession(s, workout);
    location.route('/run');
  }

  function resumeRun() {
    location.route('/run');
  }

  function discardRun() {
    if (!confirm('Discard the in-progress workout? This cannot be undone.')) return;
    clearRunSession();
  }

  function startDeload() {
    void acceptDeload(now);
  }

  function notNow() {
    void dismissFlags(activeFlags.map((f) => f.id));
  }

  return (
    <div>
      <h1 class="page-title">Today</h1>

      {inProgress && (
        <div class="card run-in-progress-card" style="margin-bottom:1rem">
          <div class="list-row-title">Workout in progress: {inProgress.workoutSnapshot.name}</div>
          <div class="muted">
            {RUN_STATUS_LABELS[inProgress.timer.status] ?? inProgress.timer.status}
          </div>
          <div class="btn-row" style="margin-top:0.6rem">
            <button class="btn" onClick={discardRun}>
              Discard
            </button>
            <button class="btn btn-primary btn-big" onClick={resumeRun}>
              Resume
            </button>
          </div>
        </div>
      )}

      <a
        href="/program"
        class={`cycle-chip${onDeload ? ' deload' : ''}`}
        style="margin-bottom:0.75rem;text-decoration:none"
      >
        {cycleChipLabel}
      </a>

      {showDeloadBanner && (
        <div class="banner banner-deload" style="margin-bottom:1rem">
          <strong>Deload suggested</strong>
          <ul>
            {activeFlags.map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
          <div class="btn-row">
            <button class="btn" onClick={notNow}>
              Not now
            </button>
            <button class="btn btn-primary" onClick={startDeload}>
              Start deload week
            </button>
          </div>
        </div>
      )}

      {needed && (
        <div class="banner banner-info">
          {NEEDED_MESSAGES[needed] ?? `${needed} day is due this week.`}
        </div>
      )}

      {workout ? (
        <div class="stack">
          <div class="card stack">
            <div class="row-between">
              <div class="list-row-title" style="font-size:1.2rem">
                {workout.name}
              </div>
              <span class={`chip chip-${workout.intensity}`}>
                {INTENSITY_LABELS[workout.intensity]}
              </span>
            </div>
            <div class="muted">
              Est. {formatDurationMin(estimateWorkoutSeconds(workout.blocks))}
            </div>
            {workout.notes && <div class="muted">{workout.notes}</div>}
            <div class="stack">
              {workout.blocks.map((block, i) => (
                <BlockSummary key={i} state={s} block={block} index={i} suggestLoads />
              ))}
            </div>
          </div>
          {hopper && (
            <div class="muted">
              Hopper: {hopper.remaining.length} of {hopper.viable.length} left
              {mode === 'all' && ' · all workouts'}
            </div>
          )}
          <div class="btn-row">
            <button class="btn" onClick={bump}>
              Bump
            </button>
            <button class="btn btn-primary btn-big" onClick={start}>
              Start
            </button>
          </div>
        </div>
      ) : failReason === 'excluded' ? (
        <div class="stack">
          <div class="banner banner-warn">
            You&rsquo;ve bumped through all {hopper?.viable.length ?? 0} workouts in today&rsquo;s
            hopper.
          </div>
          <div class="stack">
            <button class="btn btn-block" onClick={startOver}>
              Start over
            </button>
            {mode !== 'all' && (
              <button class="btn btn-block" onClick={useAllWorkouts}>
                Use all workouts
              </button>
            )}
            <a class="btn btn-block" href="/enter">
              Pick a workout
            </a>
          </div>
        </div>
      ) : failReason === 'cadence' || failReason === 'pattern' ? (
        <div class="stack">
          <div class="banner banner-warn">{REASON_MESSAGES[failReason]}</div>
          <div class="stack">
            <button class="btn btn-block" onClick={useAllWorkouts}>
              Use all workouts
            </button>
            <a class="btn btn-block" href="/enter">
              Pick a workout
            </a>
          </div>
        </div>
      ) : failReason ? (
        <div class="stack">
          <div class="banner banner-warn">{REASON_MESSAGES[failReason]}</div>
          <a class="btn btn-block" href="/enter">
            Pick a workout
          </a>
        </div>
      ) : (
        <div class="empty-state">
          <p>No workout pulled yet today.</p>
          <button class="btn btn-primary btn-big btn-block" onClick={runSelection}>
            Get Today&rsquo;s Workout
          </button>
        </div>
      )}

      <a class="btn btn-block" href="/enter" style="margin-top:1rem">
        Enter a workout
      </a>
    </div>
  );
}
