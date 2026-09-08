import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import { EditLog } from './EditLog';
import { setStorage, state } from '../../state/store';
import { buildAdhocLog } from '../../domain/program/adhoc';
import { currentMax, e1rm } from '../../domain/program/e1rm';
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

function poolLog(): WorkoutLog {
  return {
    id: 'p1',
    poolWorkoutId: 'w1',
    workoutSnapshot: poolWorkout(),
    startedAt: '2024-06-01T10:00:00.000Z',
    finishedAt: '2024-06-01T10:45:00.000Z',
    results: [{ movementId: 'deadlift', sets: [{ weight: 300, reps: 5 }], rpe: 8 }],
    rpe: 7,
    kind: 'pool',
  };
}

function fixtureState(logs: WorkoutLog[]): AppState {
  return {
    movements: [
      { id: 'deadlift', name: 'Deadlift', tags: ['hinge', 'compound'], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
      { id: 'squat', name: 'Back Squat', tags: ['squat', 'compound'], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
    ],
    pool: [poolWorkout()],
    logs,
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 2,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

function renderEditLog(id: string) {
  window.history.pushState({}, '', `/history/${id}/edit`);
  return render(
    <LocationProvider>
      <Router>{[<Route path="/history/:id/edit" component={EditLog} key="edit" />]}</Router>
    </LocationProvider>,
  );
}

describe('EditLog', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
  });

  afterEach(() => {
    cleanup();
  });

  it('edits a pool log: changing a set weight and the session RPE updates the store and stamps editedAt', async () => {
    state.value = fixtureState([poolLog()]);
    renderEditLog('p1');

    const weightInput = screen.getByDisplayValue('300');
    fireEvent.input(weightInput, { target: { value: '325' } });

    const sessionRpe = screen.getByLabelText('RPE (1–10)');
    fireEvent.input(sessionRpe, { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const log = state.value!.logs.find((l) => l.id === 'p1');
      expect(log?.rpe).toBe(9);
    });

    const log = state.value!.logs.find((l) => l.id === 'p1')!;
    expect(log.results[0].sets?.[0].weight).toBe(325);
    expect(log.editedAt).toBeDefined();
    // Untouched fields survive the edit.
    expect(log.id).toBe('p1');
    expect(log.poolWorkoutId).toBe('w1');
    expect(log.kind).toBe('pool');
  });

  it('edits a max-test log: changing the weight updates currentMax and preserves kind', async () => {
    const maxLog = buildAdhocLog({
      date: '2024-06-01T12:00:00.000Z',
      entries: [{ movementId: 'squat', sets: [{ weight: 400, reps: 1 }] }],
      maxTest: true,
      id: 'm1',
    });
    state.value = fixtureState([maxLog]);
    renderEditLog('m1');

    const weightInput = screen.getByPlaceholderText('weight (lb)');
    expect(weightInput).toHaveValue(400);
    fireEvent.input(weightInput, { target: { value: '425' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const log = state.value!.logs.find((l) => l.id === 'm1');
      expect(log?.results[0].sets?.[0].weight).toBe(425);
    });

    const log = state.value!.logs.find((l) => l.id === 'm1')!;
    expect(log.kind).toBe('max-test');
    expect(log.editedAt).toBeDefined();

    const now = new Date('2024-06-02T00:00:00.000Z');
    expect(currentMax(state.value!.logs, 'squat', now)).toBeCloseTo(e1rm(425, 1)!);
  });
});
