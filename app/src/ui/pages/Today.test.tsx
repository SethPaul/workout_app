import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Today } from './Today';
import { clearTodayWorkout, setStorage, state } from '../../state/store';
import type { AppState, PoolWorkout, WorkoutLog } from '../../domain/types';
import type { Storage } from '../../storage/storage';

class MemoryStorage implements Storage {
  saved: AppState | null = null;
  async load(): Promise<AppState | null> {
    return this.saved;
  }
  async save(next: AppState): Promise<void> {
    this.saved = next;
  }
}

function fixtureState(): AppState {
  return {
    movements: [
      { id: 'squat', name: 'Back Squat', tags: [], equipment: [], cadenceDays: 7, unit: 'reps', loadable: true },
      { id: 'row', name: 'Row', tags: [], equipment: [], cadenceDays: 1, unit: 'meters', loadable: false },
    ],
    pool: [
      {
        id: 'w1',
        name: 'Squat Day',
        intensity: 'M',
        blocks: [
          {
            format: 'strength',
            title: 'Strength',
            movements: [{ movementId: 'squat', reps: 5 }],
            sets: 5,
            restSec: 90,
          },
          {
            format: 'amrap',
            title: 'Conditioning',
            movements: [{ movementId: 'row', distanceM: 500 }],
            durationSec: 600,
          },
        ],
        cadenceDays: 14,
        enabled: true,
        tags: [],
        source: 'manual',
      },
    ],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 1,
  };
}

/** A strength-block workout for `movementId`, target `reps` reps (SPEC 9.6 fatigue-flag fixtures). */
function strengthSnapshot(movementId: string, reps: number): PoolWorkout {
  return {
    id: `w-${movementId}`,
    name: `w-${movementId}`,
    intensity: 'M',
    blocks: [{ format: 'strength', sets: 3, movements: [{ movementId, reps }] }],
    cadenceDays: 7,
    enabled: true,
    source: 'manual',
  };
}

function strengthLog(id: string, finishedAt: string, movementId: string, reps: number, weight: number, actualReps: number): WorkoutLog {
  return {
    id,
    poolWorkoutId: `w-${movementId}`,
    workoutSnapshot: strengthSnapshot(movementId, reps),
    startedAt: finishedAt,
    finishedAt,
    results: [{ movementId, sets: [{ weight, reps: actualReps }] }],
    kind: 'pool',
  };
}

function renderToday() {
  return render(
    <LocationProvider>
      <Today />
    </LocationProvider>,
  );
}

describe('Today page', () => {
  beforeEach(() => {
    clearTodayWorkout();
    state.value = fixtureState();
  });

  afterEach(() => {
    cleanup();
    clearTodayWorkout();
  });

  it('shows the pull prompt when no workout has been pulled yet', () => {
    renderToday();
    expect(screen.getByRole('button', { name: /Get Today.s Workout/i })).toBeInTheDocument();
  });

  it('pulls and displays a workout with its blocks after clicking the pull button', () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));

    expect(screen.getByText('Squat Day')).toBeInTheDocument();
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bump' })).toBeInTheDocument();
  });

  it('shows an estimated duration for the pulled workout', () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    // 5 sets * 30s work + 4 * 90s rest = 510s, + 600s amrap = 1110s -> 19 min
    expect(screen.getByText(/Est\. 19 min/)).toBeInTheDocument();
  });
});

describe('Today page — cycle week chip (SPEC 9.5/9.9)', () => {
  beforeEach(() => {
    clearTodayWorkout();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    clearTodayWorkout();
    vi.useRealTimers();
  });

  it('shows "Week N of cycleWeeks" for the current cycle week', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    state.value = {
      ...fixtureState(),
      schemaVersion: 2,
      program: { cycleStartedAt: '2024-01-08T00:00:00.000Z', dismissedFlags: [] }, // 7 days in -> week 2
    };
    renderToday();
    expect(screen.getByText('Week 2 of 4')).toBeInTheDocument();
  });

  it('shows "Deload week" when an accepted deload is active', () => {
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    state.value = {
      ...fixtureState(),
      schemaVersion: 2,
      program: {
        cycleStartedAt: '2024-01-01T00:00:00.000Z',
        deloadWeekStartedAt: '2024-01-14T00:00:00.000Z', // 1 day ago: still active
        dismissedFlags: [],
      },
    };
    renderToday();
    expect(screen.getByText('Deload week')).toBeInTheDocument();
  });
});

describe('Today page — deload banner (SPEC 9.6/9.9)', () => {
  beforeEach(() => {
    clearTodayWorkout();
    setStorage(new MemoryStorage());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    clearTodayWorkout();
    vi.useRealTimers();
  });

  function isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function stateWithTwoFlags(): AppState {
    // Peak session, then two sessions in a row that both miss the
    // prescribed 5 reps *and* land >=5% below the 8-week-peak e1rm --
    // raises both `e1rm-drop:squat` and `missed-reps:squat` (SPEC 9.6).
    const logs: WorkoutLog[] = [
      strengthLog('s1', isoDaysAgo(40), 'squat', 5, 220, 5),
      strengthLog('s2', isoDaysAgo(20), 'squat', 5, 180, 3),
      strengthLog('s3', isoDaysAgo(5), 'squat', 5, 175, 3),
    ];
    return {
      ...fixtureState(),
      logs,
      schemaVersion: 2,
      // Cycle just started, so only the two flags (not the week-based
      // rules) drive `deloadSuggested` here.
      program: { cycleStartedAt: isoDaysAgo(0), dismissedFlags: [] },
    };
  }

  it('shows the flag texts and Start/Not-now buttons when >=2 fatigue flags are active', () => {
    state.value = stateWithTwoFlags();
    renderToday();
    expect(screen.getByText('Deload suggested')).toBeInTheDocument();
    expect(screen.getByText(/squat: estimated 1RM has dropped/)).toBeInTheDocument();
    expect(screen.getByText(/squat: missed prescribed reps/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start deload week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });

  it('"Not now" dismisses the flags for the cycle and hides the banner', async () => {
    state.value = stateWithTwoFlags();
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Deload suggested')).not.toBeInTheDocument());
    expect(state.value?.program?.dismissedFlags).toEqual(
      expect.arrayContaining(['e1rm-drop:squat', 'missed-reps:squat']),
    );
  });

  it('"Start deload week" accepts the deload and switches the cycle chip', async () => {
    state.value = stateWithTwoFlags();
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Start deload week' }));
    await waitFor(() => expect(screen.getByText('Deload week')).toBeInTheDocument());
    expect(state.value?.program?.deloadWeekStartedAt).toBe(new Date().toISOString());
  });
});
