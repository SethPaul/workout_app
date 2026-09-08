import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { AdhocLog } from './AdhocLog';
import { setStorage, state } from '../../state/store';
import { currentMax, e1rm } from '../../domain/program/e1rm';
import type { AppState } from '../../domain/types';
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
      { id: 'deadlift', name: 'Deadlift', tags: ['hinge', 'compound'], equipment: ['barbell'], cadenceDays: 7, unit: 'reps', loadable: true },
      { id: 'row', name: 'Row', tags: [], equipment: [], cadenceDays: 1, unit: 'meters', loadable: false },
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 2,
    program: { cycleStartedAt: new Date().toISOString(), dismissedFlags: [] },
  };
}

function renderPage() {
  return render(
    <LocationProvider>
      <AdhocLog />
    </LocationProvider>,
  );
}

describe('AdhocLog ("Log something else", SPEC 9.8)', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
  });

  afterEach(() => {
    cleanup();
  });

  it('is disabled until a set has a weight or reps entered', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('fills the form, saves a max-test log, and currentMax reflects it', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add movement/i }));
    fireEvent.input(screen.getByPlaceholderText(/Search movements/i), { target: { value: 'Deadlift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }));

    fireEvent.input(screen.getByPlaceholderText('weight (lb)'), { target: { value: '405' } });
    fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '1' } });

    fireEvent.click(screen.getByLabelText(/This was a max test/i));

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(state.value?.logs.length).toBe(1));
    const log = state.value!.logs[0];
    expect(log.kind).toBe('max-test');
    expect(log.poolWorkoutId).toBeUndefined();
    expect(log.results[0]).toMatchObject({ movementId: 'deadlift' });

    const now = new Date();
    expect(currentMax(state.value!.logs, 'deadlift', now)).toBeCloseTo(e1rm(405, 1)!);
  });

  it('saves a plain (non-max-test) log with entered sets, notes, and per-set RPE', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add movement/i }));
    fireEvent.input(screen.getByPlaceholderText(/Search movements/i), { target: { value: 'Deadlift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }));

    fireEvent.input(screen.getByPlaceholderText('weight (lb)'), { target: { value: '315' } });
    fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '5' } });
    fireEvent.input(screen.getByPlaceholderText('RPE'), { target: { value: '8' } });
    fireEvent.input(screen.getByLabelText('Notes'), { target: { value: 'Felt good' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(state.value?.logs.length).toBe(1));
    const log = state.value!.logs[0];
    expect(log.kind).toBe('adhoc');
    expect(log.notes).toBe('Felt good');
    expect(log.results[0]).toMatchObject({ movementId: 'deadlift', rpe: 8 });
    expect(log.results[0].sets?.[0]).toMatchObject({ weight: 315, reps: 5 });
  });
});
