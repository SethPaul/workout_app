import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { SelectReason } from '../../domain/select';
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
  state,
  todayWorkout,
} from '../../state/store';
import { beginRunSession } from '../../state/run';
import { BlockSummary } from '../components/BlockSummary';
import { INTENSITY_LABELS } from '../helpers';
import type { PoolWorkout } from '../../domain/types';

const REASON_MESSAGES: Record<SelectReason, string> = {
  'no-enabled': "No workouts are enabled in your pool yet. Enable some in the Pool tab.",
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

export function Today() {
  const s = state.value!;
  const location = useLocation();
  // Reading the signal directly keeps this component subscribed to changes
  // made by setTodayWorkout/bumpTodayWorkout elsewhere.
  void todayWorkout.value;
  const today = currentTodayWorkout();
  const [failReason, setFailReason] = useState<SelectReason | null>(null);
  const now = new Date();

  // SPEC 9.5/9.9: the card renders today's wave-transformed snapshot, not
  // the raw pool entry — that's what carries the current week's targetRpe,
  // set counts, and (during a deload) scaled-down prescription.
  const workout: PoolWorkout | null = today?.snapshot ?? (today?.workoutId ? (s.pool.find((w) => w.id === today.workoutId) ?? null) : null);
  const needed = weeklyNeed(s.logs, now);

  const program = resolveProgram(s.program, s.logs, now);
  const settings = resolveSettings(s.settings);
  const week = cycleWeek(program, now);
  const onDeload = isDeloadWeek(program, now);
  const cycleChipLabel = onDeload ? 'Deload week' : `Week ${week} of ${settings.cycleWeeks}`;

  const allFlags = fatigueFlags(s.logs, now);
  const activeFlags: FatigueFlag[] = allFlags.filter((f) => !program.dismissedFlags.includes(f.id));
  const showDeloadBanner = !onDeload && deloadSuggested(allFlags, program, s.settings, now);

  function runSelection(ignoreCadence: boolean) {
    const result = pullToday({
      pool: s.pool,
      movements: s.movements,
      logs: s.logs,
      settings: s.settings,
      now,
      program: s.program,
      ignoreCadence,
    });
    if (result.workout) {
      setFailReason(null);
    } else {
      setFailReason(result.reason);
    }
  }

  function bump() {
    bumpTodayWorkout();
    runSelection(false);
  }

  function start() {
    if (!workout) return;
    beginRunSession(workout);
    location.route('/run');
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

      <div class={`cycle-chip${onDeload ? ' deload' : ''}`} style="margin-bottom:0.75rem">
        {cycleChipLabel}
      </div>

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

      {needed && <div class="banner banner-info">{NEEDED_MESSAGES[needed] ?? `${needed} day is due this week.`}</div>}

      {workout ? (
        <div class="stack">
          <div class="card stack">
            <div class="row-between">
              <div class="list-row-title" style="font-size:1.2rem">
                {workout.name}
              </div>
              <span class={`chip chip-${workout.intensity}`}>{INTENSITY_LABELS[workout.intensity]}</span>
            </div>
            <div class="muted">Est. {formatDurationMin(estimateWorkoutSeconds(workout.blocks))}</div>
            {workout.notes && <div class="muted">{workout.notes}</div>}
            <div class="stack">
              {workout.blocks.map((block, i) => (
                <BlockSummary key={i} state={s} block={block} index={i} suggestLoads />
              ))}
            </div>
          </div>
          <div class="btn-row">
            <button class="btn" onClick={bump}>
              Bump
            </button>
            <button class="btn btn-primary btn-big" onClick={start}>
              Start
            </button>
          </div>
        </div>
      ) : failReason ? (
        <div class="stack">
          <div class="banner banner-warn">{REASON_MESSAGES[failReason]}</div>
          <div class="stack">
            {(failReason === 'cadence' || failReason === 'pattern') && (
              <button class="btn btn-block" onClick={() => runSelection(true)}>
                Ignore cadence and pick anyway
              </button>
            )}
            <a class="btn btn-block" href="/pool">
              Pick manually from Pool
            </a>
          </div>
        </div>
      ) : (
        <div class="empty-state">
          <p>No workout pulled yet today.</p>
          <button class="btn btn-primary btn-big btn-block" onClick={() => runSelection(false)}>
            Get Today&rsquo;s Workout
          </button>
        </div>
      )}
    </div>
  );
}
