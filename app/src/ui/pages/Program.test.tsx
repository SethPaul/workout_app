import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Program } from './Program';
import { setStorage, state } from '../../state/store';
import type { AppState, PoolWorkout, ProgramState, WorkoutLog } from '../../domain/types';
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

function strengthSnapshot(movementId: string, reps: number): PoolWorkout {
  return {
    id: `w-${movementId}`,
    name: `${movementId} day`,
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

function emptyState(): AppState {
  return {
    movements: [
      {
        id: 'squat',
        name: 'Back Squat',
        tags: [],
        equipment: ['barbell'],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
    ],
    pool: [],
    logs: [],
    settings: {
      availableEquipment: [],
      soundOn: true,
      vibrateOn: true,
      keepScreenOn: true,
      units: 'lb',
      cycleWeeks: 4,
    },
    schemaVersion: 1,
  };
}

function stateWithLogs(): AppState {
  const program: ProgramState = { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] };
  return {
    ...emptyState(),
    program,
    logs: [
      strengthLog('s1', '2024-01-03T00:00:00.000Z', 'squat', 5, 200, 3),
      strengthLog('s2', '2024-01-05T00:00:00.000Z', 'squat', 5, 200, 3),
    ],
  };
}

function renderProgram() {
  return render(
    <LocationProvider>
      <Program />
    </LocationProvider>,
  );
}

describe('Program page', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows empty states with no logs', () => {
    state.value = emptyState();
    renderProgram();

    expect(screen.getByText('Program')).toBeInTheDocument();
    expect(screen.getByText('No strength sessions logged yet.')).toBeInTheDocument();
    expect(screen.getByText('No workouts logged yet.')).toBeInTheDocument();
    expect(screen.getByText('No active fatigue flags.')).toBeInTheDocument();
  });

  it('shows the cycle chip, week type and a Start new cycle button', () => {
    state.value = emptyState();
    renderProgram();

    expect(screen.getByText(/Week \d+ of 4/)).toBeInTheDocument();
    expect(screen.getByText('Cycle started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start new cycle' })).toBeInTheDocument();
  });

  it('shows a stall/hold/progress row per movement with a logged strength session, with status badge and last workout attribution', () => {
    state.value = stateWithLogs();
    renderProgram();

    const link = screen.getByRole('link', { name: /Back Squat/ });
    expect(link).toHaveAttribute('href', '/movements/squat');
    expect(screen.getByText('Stall')).toBeInTheDocument(); // both sessions missed the prescribed 5 reps (only 3)

    expect(screen.getByText('squat day')).toBeInTheDocument(); // last workout name
    expect(screen.getByText(/^Contributed to: .+/)).toBeInTheDocument();
    expect(screen.queryByText(/missed-reps:squat/)).not.toBeInTheDocument();
  });

  it('calls startNewCycle after confirming the confirm() dialog', async () => {
    state.value = emptyState();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderProgram();

    fireEvent.click(screen.getByRole('button', { name: 'Start new cycle' }));

    await vi.waitFor(() => {
      expect(state.value?.program?.cycleStartedAt).toBeDefined();
    });
  });

  it('does not start a new cycle when confirm() is declined', () => {
    const before = emptyState();
    state.value = before;
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderProgram();

    fireEvent.click(screen.getByRole('button', { name: 'Start new cycle' }));

    expect(state.value?.program).toBeUndefined();
  });
});
