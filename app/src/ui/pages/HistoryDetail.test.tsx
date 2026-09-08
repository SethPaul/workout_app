import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import { HistoryDetail } from './HistoryDetail';
import { setStorage, state } from '../../state/store';
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

function poolWorkout(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Deadlift Day',
    intensity: 'H',
    blocks: [{ format: 'strength', title: 'Main', movements: [{ movementId: 'deadlift', reps: 5 }], sets: 1 }],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

function poolLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'p1',
    poolWorkoutId: 'w1',
    workoutSnapshot: poolWorkout(),
    startedAt: '2024-06-01T10:00:00.000Z',
    finishedAt: '2024-06-01T10:45:00.000Z',
    results: [{ movementId: 'deadlift', sets: [{ weight: 300, reps: 5 }], rpe: 8 }],
    kind: 'pool',
    ...overrides,
  };
}

function fixtureState(logs: WorkoutLog[]): AppState {
  return {
    movements: [
      { id: 'deadlift', name: 'Deadlift', tags: [], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
    ],
    pool: [poolWorkout()],
    logs,
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 2,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

function renderDetail(id: string) {
  window.history.pushState({}, '', `/history/${id}`);
  return render(
    <LocationProvider>
      <Router>{[<Route path="/history/:id" component={HistoryDetail} key="detail" />]}</Router>
    </LocationProvider>,
  );
}

describe('HistoryDetail', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('deletes the log after confirmation and navigates back to History', async () => {
    state.value = fixtureState([poolLog()]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDetail('p1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(state.value?.logs.find((l) => l.id === 'p1')).toBeUndefined();
    });
  });

  it('does nothing when the confirmation is dismissed', () => {
    state.value = fixtureState([poolLog()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDetail('p1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(state.value?.logs.find((l) => l.id === 'p1')).toBeDefined();
  });

  it('shows an "edited" hint when editedAt is set', () => {
    state.value = fixtureState([poolLog({ editedAt: '2024-06-02T00:00:00.000Z' })]);
    renderDetail('p1');

    expect(screen.getByText(/Edited/i)).toBeInTheDocument();
  });

  it('has no "edited" hint when the log was never edited', () => {
    state.value = fixtureState([poolLog()]);
    renderDetail('p1');

    expect(screen.queryByText(/Edited/i)).not.toBeInTheDocument();
  });
});
