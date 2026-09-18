import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Run } from './Run';
import { setStorage, state } from '../../state/store';
import {
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
