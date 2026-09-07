import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Today } from './Today';
import { clearTodayWorkout, state } from '../../state/store';
import type { AppState } from '../../domain/types';

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
