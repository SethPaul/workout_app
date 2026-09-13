import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import { MovementEditor } from './MovementEditor';
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

function fixtureState(movement: Movement): AppState {
  return {
    movements: [movement],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
    program: { cycleStartedAt: '2024-01-01T00:00:00.000Z', dismissedFlags: [] },
  };
}

function renderEditor(id: string) {
  window.history.pushState({}, '', `/movements/${id}`);
  return render(
    <LocationProvider>
      <Router>{[<Route path="/movements/:id" component={MovementEditor} key="editor" />]}</Router>
    </LocationProvider>,
  );
}

describe('MovementEditor', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
  });

  afterEach(() => {
    cleanup();
  });

  it('saves added libraries and an explicit region override', async () => {
    state.value = fixtureState({
      id: 'squat',
      name: 'Back Squat',
      tags: ['squat'],
      equipment: ['barbell'],
      cadenceDays: 7,
      unit: 'reps',
      loadable: true,
    });
    renderEditor('squat');

    // Auto shows the tag-derived region.
    expect(screen.getByText(/Auto \(lower\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Vasa' }));

    const regionSelect = screen.getByText('Region').closest('.field')!.querySelector('select')!;
    fireEvent.change(regionSelect, { target: { value: 'full' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const m = state.value!.movements.find((x) => x.id === 'squat')!;
      expect(m.region).toBe('full');
    });

    const m = state.value!.movements.find((x) => x.id === 'squat')!;
    expect(m.libraries).toEqual(['default', 'vasa']);
  });

  it('keeps at least the Default library when every checkbox is unchecked', async () => {
    state.value = fixtureState({
      id: 'squat',
      name: 'Back Squat',
      tags: ['squat'],
      equipment: ['barbell'],
      cadenceDays: 7,
      unit: 'reps',
      loadable: true,
      libraries: ['default'],
    });
    renderEditor('squat');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Default' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(state.value!.movements[0].libraries).toEqual(['default']);
    });
  });
});
