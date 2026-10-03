import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Run } from './Run';
import { setStorage, state } from '../../state/store';
import {
  beginLiveSession,
  beginRunSession,
  clearRunSession,
  dispatchRun,
  dispatchWarmup,
  runSession,
} from '../../state/run';
import type { AppState, PoolWorkout } from '../../domain/types';
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
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 2,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

function strengthWorkout(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Squat Day',
    intensity: 'M',
    blocks: [
      {
        format: 'strength',
        title: 'Strength',
        movements: [{ movementId: 'squat', reps: 5, targetRpe: 8 }],
        sets: 3,
        restSec: 30,
      },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

function renderRun() {
  return render(
    <LocationProvider>
      <Run />
    </LocationProvider>,
  );
}

describe('Run: warm-up stopwatch on the Ready screen', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
    beginRunSession(
      state.value,
      { ...strengthWorkout(), notes: 'Warm-up: 5 min easy bike first.' },
      new Date(0),
    );
  });

  afterEach(() => {
    cleanup();
    clearRunSession();
  });

  it('shows the workout notes, a 0:00 stopwatch and the 5 min default target before starting', () => {
    renderRun();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Warm-up: 5 min easy bike first.')).toBeInTheDocument();
    expect(screen.getByTestId('warmup-clock')).toHaveTextContent('0:00');
    expect(screen.getByText('Bell at 5:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Start warm-up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument();
  });

  it('runs, shows elapsed time, rings at the chosen target, pauses and resets', () => {
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: '3 min' }));
    expect(screen.getByText('Bell at 3:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start warm-up' }));
    expect(runSession.value?.warmup?.running).toBe(true);
    // Drive the clock deterministically instead of waiting on the 100 ms interval.
    const startedAt = runSession.value!.warmup!._lastTickAt!;
    act(() => {
      dispatchWarmup({ type: 'tick', now: startedAt + 65_000 });
    });
    expect(screen.getByTestId('warmup-clock')).toHaveTextContent('1:05');
    expect(screen.getByRole('button', { name: 'Pause warm-up' })).toBeInTheDocument();

    act(() => {
      dispatchWarmup({ type: 'tick', now: startedAt + 181_000 });
    });
    expect(screen.getByText('Target reached (3:00) · bell rung')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause warm-up' }));
    expect(runSession.value?.warmup?.running).toBe(false);
    expect(screen.getByRole('button', { name: 'Resume warm-up' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('warmup-clock')).toHaveTextContent('0:00');
    expect(screen.getByRole('button', { name: 'Start warm-up' })).toBeInTheDocument();
  });

  it('Start workout stops a running warm-up and starts the timer', () => {
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: 'Start warm-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    expect(runSession.value?.timer.status).toBe('running');
    expect(runSession.value?.warmup?.running).toBe(false);
    expect(screen.getByText('Set 1 of 3')).toBeInTheDocument();
  });
});

describe('Run: mid-workout set entry', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
    beginRunSession(state.value, strengthWorkout(), new Date(0));
    dispatchRun({ type: 'start', now: 0 });
  });

  afterEach(() => {
    cleanup();
    clearRunSession();
  });

  it('shows an inline weight/reps/RPE entry for the current set during the work phase', () => {
    renderRun();

    expect(screen.getByText('Set 1 of 3')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('weight')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('reps')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('target 8')).toBeInTheDocument();
  });

  it('carries the set-in-progress heading into the following rest phase ("after set N of M")', () => {
    renderRun();

    fireEvent.input(screen.getByPlaceholderText('weight'), { target: { value: '225' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Done' }));

    expect(screen.getByText('Rest · after set 1 of 3')).toBeInTheDocument();
    // The value entered for set 1 stays editable during the rest that follows it.
    expect(screen.getByPlaceholderText('weight')).toHaveValue(225);
  });
});

describe('Run: live workout (blocks entered on the fly)', () => {
  function liveFixture(): AppState {
    const s = fixtureState();
    s.movements.push({
      id: 'pushup',
      name: 'Push-up',
      tags: ['bodyweight', 'push'],
      equipment: ['none'],
      cadenceDays: 3,
      unit: 'reps',
      loadable: false,
    });
    return s;
  }

  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = liveFixture();
    beginLiveSession(state.value, new Date('2026-09-29T09:00:00'));
  });

  afterEach(() => {
    cleanup();
    clearRunSession();
  });

  function pick(name: string) {
    fireEvent.input(screen.getByPlaceholderText('Search movements…'), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
  }

  it('picks a superset, runs open sets with a rest clock, then saves the workout to the pool', async () => {
    renderRun();
    expect(screen.getByText(/pick each block/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));

    expect(screen.getByText('Next: Block 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin block' })).toBeDisabled();
    pick('Back Squat');
    pick('Push-up');
    expect(screen.getByText('Movements (2/3)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Begin block' }));

    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip Block' })).toBeNull();
    fireEvent.input(screen.getByPlaceholderText('weight'), { target: { value: '135' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Done' }));

    expect(screen.getByText('Rest · after set 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start set 2' }));
    expect(screen.getByText('Set 2')).toBeInTheDocument();
    // Set 2's row starts from set 1's weight.
    expect(screen.getByPlaceholderText('weight')).toHaveValue(135);
    fireEvent.click(screen.getByRole('button', { name: 'Set Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'End Block' }));

    expect(screen.getByText('Next: Block 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByText('Log results')).toBeInTheDocument();

    const snapshot = runSession.value!.workoutSnapshot;
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(state.value!.logs).toHaveLength(1));

    const saved = state.value!.pool.find((w) => w.id === snapshot.id)!;
    expect(saved.blocks).toEqual([
      {
        format: 'strength',
        title: 'Block 1',
        movements: [{ movementId: 'squat' }, { movementId: 'pushup' }],
        sets: 2,
      },
    ]);
    const log = state.value!.logs[0];
    expect(log.poolWorkoutId).toBe(snapshot.id);
    expect(log.results[0].sets?.map((set) => set.weight)).toEqual([135, 135]);
    expect(runSession.value).toBeNull();
  });

  it('offers recently used movements for the region as one-tap picks', () => {
    state.value = {
      ...state.value!,
      logs: [
        {
          id: 'l1',
          poolWorkoutId: 'old',
          workoutSnapshot: {
            id: 'old',
            name: 'Lower · Sep 22',
            intensity: 'M',
            blocks: [{ format: 'strength', movements: [{ movementId: 'pushup' }], sets: 3 }],
            cadenceDays: 14,
            enabled: true,
            source: 'manual',
            tags: ['vasa', 'region:lower'],
          },
          startedAt: '2026-09-22T09:00:00.000Z',
          finishedAt: '2026-09-22T10:00:00.000Z',
          results: [],
        },
      ],
    };
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    const recent = screen.getByRole('group', { name: 'Recent movements' });
    fireEvent.click(recent.querySelector('button')!);
    expect(screen.getByText('Movements (1/3)')).toBeInTheDocument();
  });

  it('finishing before any block discards the session without logging', () => {
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(runSession.value).toBeNull();
    expect(state.value!.pool).toHaveLength(0);
  });
});
