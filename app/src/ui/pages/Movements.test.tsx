import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Movements } from './Movements';
import { setStorage, state } from '../../state/store';
import type { AppState, Movement } from '../../domain/types';
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

function movement(overrides: Partial<Movement> & { id: string; name: string }): Movement {
  return {
    tags: [],
    equipment: ['none'],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

function fixtureState(): AppState {
  return {
    movements: [
      movement({ id: 'squat', name: 'Back Squat', tags: ['squat'] }), // default library, derived lower
      movement({ id: 'bench', name: 'Bench Press', tags: ['push'] }), // default library, derived upper
      movement({ id: 'plank', name: 'Plank', libraries: ['vasa'] }), // vasa-only, derived full (no tags)
      movement({
        id: 'band_row',
        name: 'Band Row',
        tags: ['pull'],
        libraries: ['default', 'vasa'],
      }), // both, derived upper
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

function renderMovements() {
  window.history.pushState({}, '', '/movements');
  return render(
    <LocationProvider>
      <Movements />
    </LocationProvider>,
  );
}

describe('Movements', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows every movement under the default "All" / "Any" filters', () => {
    renderMovements();
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Band Row')).toBeInTheDocument();
  });

  it('tags Vasa-library rows with a chip', () => {
    renderMovements();
    const plankRow = screen.getByText('Plank').closest('a')!;
    expect(plankRow.querySelector('.chip-kind')).toHaveTextContent('Vasa');
    const squatRow = screen.getByText('Back Squat').closest('a')!;
    expect(squatRow.querySelector('.chip-kind')).toBeNull();
  });

  it('filters to the Vasa library', () => {
    renderMovements();
    fireEvent.click(screen.getByRole('button', { name: 'Vasa' }));

    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Band Row')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
  });

  it('filters to the Lower region, keeping full-body movements visible', () => {
    renderMovements();
    fireEvent.click(screen.getByRole('button', { name: 'Lower' }));

    expect(screen.getByText('Back Squat')).toBeInTheDocument(); // derived lower
    expect(screen.getByText('Plank')).toBeInTheDocument(); // derived full -> always shown
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument(); // derived upper
    expect(screen.queryByText('Band Row')).not.toBeInTheDocument(); // derived upper
  });
});
