import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { selectWorkout, type SelectReason } from '../../domain/select';
import { estimateWorkoutSeconds, formatDurationMin } from '../../domain/estimate';
import { weeklyNeed } from '../../domain/weekly';
import { bumpTodayWorkout, currentTodayWorkout, setTodayWorkout, state, todayWorkout } from '../../state/store';
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

  const workout: PoolWorkout | null = today?.workoutId
    ? (s.pool.find((w) => w.id === today.workoutId) ?? null)
    : null;
  const needed = weeklyNeed(s.logs, new Date());

  function runSelection(ignoreCadence: boolean) {
    const t = currentTodayWorkout();
    const result = selectWorkout({
      pool: s.pool,
      movements: s.movements,
      logs: s.logs,
      settings: s.settings,
      now: new Date(),
      exclude: t?.excluded ?? [],
      ignoreCadence,
    });
    if (result.workout) {
      setTodayWorkout(result.workout.id);
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

  return (
    <div>
      <h1 class="page-title">Today</h1>

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
                <BlockSummary key={i} state={s} block={block} index={i} />
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
