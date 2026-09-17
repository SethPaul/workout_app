import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Today } from './Today';
import { clearTodayWorkout, setStorage, state, todayWorkout } from '../../state/store';
import { beginRunSession, clearRunSession, runSession } from '../../state/run';
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
      {
        id: 'squat',
        name: 'Back Squat',
        tags: [],
        equipment: [],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
      {
        id: 'row',
        name: 'Row',
        tags: [],
        equipment: [],
        cadenceDays: 1,
        unit: 'meters',
        loadable: false,
      },
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

function strengthLog(
  id: string,
  finishedAt: string,
  movementId: string,
  reps: number,
  weight: number,
  actualReps: number,
): WorkoutLog {
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

// Applies to every test in this file: the in-progress run session is kept in
// module-level state (persisted to localStorage), so it must not leak
// between tests regardless of which describe block sets it.
beforeEach(() => {
  clearRunSession();
});

afterEach(() => {
  clearRunSession();
});

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

describe('Today page — in-progress run card', () => {
  beforeEach(() => {
    clearTodayWorkout();
    state.value = fixtureState();
  });

  afterEach(() => {
    cleanup();
    clearTodayWorkout();
  });

  function beginSession() {
    beginRunSession(state.value!, state.value!.pool[0], new Date('2024-01-01T00:00:00.000Z'));
  }

  it('shows nothing extra when no run is in progress', () => {
    renderToday();
    expect(screen.queryByText(/Workout in progress/)).not.toBeInTheDocument();
  });

  it('shows a card with the workout name and status when a run is in progress', () => {
    beginSession();
    renderToday();
    expect(screen.getByText('Workout in progress: Squat Day')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('Resume routes to /run', () => {
    beginSession();
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(window.location.pathname).toBe('/run');
  });

  it('Discard confirms, then clears the session and removes the card', () => {
    beginSession();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(runSession.value).toBeNull();
    expect(screen.queryByText(/Workout in progress/)).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('Discard does nothing when the confirmation is declined', () => {
    beginSession();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(runSession.value).not.toBeNull();
    confirmSpy.mockRestore();
  });

  it('starting a new workout confirms before replacing an in-progress session', () => {
    beginSession();
    state.value = { ...state.value!, pool: [...state.value!.pool] };
    renderToday();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    // The pulled-workout "Start" button only appears once a workout has been
    // pulled for today; pull one so the confirm path can be exercised.
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(confirmSpy).toHaveBeenCalled();
    // Declined: the original in-progress session is untouched.
    expect(runSession.value?.poolWorkoutId).toBe('w1');
    confirmSpy.mockRestore();
  });
});

/** A minimal enabled, equipment-free, never-performed pool workout. */
function hopperWorkout(id: string): PoolWorkout {
  return {
    id,
    name: id,
    intensity: 'M',
    blocks: [{ format: 'strength', movements: [{ movementId: 'row' }] }],
    cadenceDays: 0,
    enabled: true,
    source: 'manual',
  };
}

function stateWithHopper(count: number): AppState {
  return {
    ...fixtureState(),
    pool: Array.from({ length: count }, (_, i) => hopperWorkout(`h${i}`)),
  };
}

describe('Today page — hopper (SPEC 3.1)', () => {
  beforeEach(() => {
    clearTodayWorkout();
  });

  afterEach(() => {
    cleanup();
    clearTodayWorkout();
  });

  it('shows "Hopper: 1 of 1 left" for the fixture pool', () => {
    state.value = fixtureState();
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    expect(screen.getByText('Hopper: 1 of 1 left')).toBeInTheDocument();
  });

  it('bumping through every viable workout shows the excluded banner', () => {
    state.value = stateWithHopper(2);
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    expect(screen.getByText('Hopper: 2 of 2 left')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    expect(screen.getByText('Hopper: 1 of 2 left')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    expect(
      screen.getByText(/bumped through all 2 workouts in today.s hopper/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use all workouts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pick a workout' })).toBeInTheDocument();
  });

  it('Start over clears the exclusions and yields a workout again', () => {
    state.value = stateWithHopper(2);
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    expect(screen.getByText(/bumped through all/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('button', { name: 'Bump' })).toBeInTheDocument();
    expect(screen.getByText('Hopper: 2 of 2 left')).toBeInTheDocument();
  });

  function stateBlockedByCadence(): AppState {
    // A single workout whose own cadence (14 days) hasn't elapsed since it
    // was last logged yesterday -- viableWorkouts is empty from the start.
    const pool: PoolWorkout[] = [{ ...hopperWorkout('w1'), cadenceDays: 14 }];
    const logs: WorkoutLog[] = [
      {
        id: 'log-1',
        poolWorkoutId: 'w1',
        workoutSnapshot: pool[0],
        startedAt: '2024-01-14T00:00:00.000Z',
        finishedAt: '2024-01-14T00:00:00.000Z',
        results: [],
      },
    ];
    return { ...fixtureState(), pool, logs };
  }

  it('Use all workouts switches to persistent all-mode and yields a workout when cadence blocked everything', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T00:00:00.000Z')); // 1 day after the log
    state.value = stateBlockedByCadence();
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: /Get Today.s Workout/i }));
    expect(screen.getByText(/still on cooldown/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use all workouts' }));
    expect(todayWorkout.value?.mode).toBe('all');
    expect(screen.getByText('w1')).toBeInTheDocument();
    expect(screen.getByText(/all workouts/)).toBeInTheDocument();

    // A following Bump either yields a workout again or the excluded
    // banner -- never a cadence failure, since mode 'all' persists.
    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    expect(screen.queryByText(/still on cooldown/i)).not.toBeInTheDocument();
    const gotWorkout = screen.queryByText('w1') !== null;
    const excludedBanner = screen.queryByText(/bumped through all/i) !== null;
    expect(gotWorkout || excludedBanner).toBe(true);

    vi.useRealTimers();
  });
});
