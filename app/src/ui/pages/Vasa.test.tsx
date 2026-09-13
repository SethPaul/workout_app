import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { Vasa } from './Vasa';
import { setStorage, state } from '../../state/store';
import { newVasaDraft, readVasaDraft, writeVasaDraft } from '../vasaDraft';
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
      {
        id: 'squat',
        name: 'Back Squat',
        tags: ['squat', 'legs', 'compound'],
        equipment: [],
        cadenceDays: 7,
        unit: 'reps',
        loadable: true,
      },
      {
        id: 'plank',
        name: 'Plank',
        tags: ['core'],
        equipment: [],
        cadenceDays: 3,
        unit: 'seconds',
        loadable: false,
      },
    ],
    pool: [],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
    program: { cycleStartedAt: new Date().toISOString(), dismissedFlags: [] },
  };
}

function renderPage() {
  return render(
    <LocationProvider>
      <Vasa />
    </LocationProvider>,
  );
}

/** The Main block's card — the first "+ Add movement" / block section on the page. */
function mainBlockCard(): HTMLElement {
  return screen.getByText('Main').closest('.card') as HTMLElement;
}

describe('Vasa ("/vasa" screen, SPEC 10.5)', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders all four block titles', () => {
    renderPage();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Accessory 1')).toBeInTheDocument();
    expect(screen.getByText('Accessory 2')).toBeInTheDocument();
    expect(screen.getByText('Finisher (2 min)')).toBeInTheDocument();
  });

  it('defaults the region chip from the weekday (Tuesday -> Lower)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-16T09:00:00')); // Tuesday
    renderPage();
    expect(screen.getByRole('button', { name: 'Lower', pressed: true })).toBeInTheDocument();
  });

  it('defaults the region chip from the weekday (Thursday -> Upper)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-18T09:00:00')); // Thursday
    renderPage();
    expect(screen.getByRole('button', { name: 'Upper', pressed: true })).toBeInTheDocument();
  });

  it('adds a movement via the picker, enters a weight, and persists the draft', () => {
    renderPage();
    const main = mainBlockCard();

    fireEvent.click(within(main).getByRole('button', { name: '+ Add movement' }));
    fireEvent.input(screen.getByPlaceholderText(/Search movements/i), {
      target: { value: 'Squat' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back Squat' }));

    fireEvent.input(screen.getByPlaceholderText('weight (lb)'), { target: { value: '185' } });
    fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '8' } });

    const stored = readVasaDraft();
    expect(stored?.blocks[0].movements[0]).toMatchObject({
      movementId: 'squat',
      sets: [{ weight: '185', reps: '8' }],
    });
  });

  it('the "Create" row adds a new vasa-library movement and adds it to the block', async () => {
    renderPage();
    const main = mainBlockCard();

    fireEvent.click(within(main).getByRole('button', { name: '+ Add movement' }));
    fireEvent.input(screen.getByPlaceholderText(/Search movements/i), {
      target: { value: 'Wall Ball' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));

    await waitFor(() =>
      expect(state.value?.movements.some((m) => m.name === 'Wall Ball')).toBe(true),
    );
    const created = state.value!.movements.find((m) => m.name === 'Wall Ball')!;
    expect(created.libraries).toEqual(['vasa']);

    await waitFor(() => expect(within(mainBlockCard()).getByText('Wall Ball')).toBeInTheDocument());
    const stored = readVasaDraft();
    expect(stored?.blocks[0].movements[0].movementId).toBe(created.id);
  });

  it("a movement created from the Finisher picker is full-body, not the day's region", async () => {
    const draft = newVasaDraft(new Date());
    draft.region = 'lower';
    draft.regionTouched = true;
    writeVasaDraft(draft);
    renderPage();
    const finisher = screen.getByText('Finisher (2 min)').closest('.card') as HTMLElement;

    fireEvent.click(within(finisher).getByRole('button', { name: '+ Add movement' }));
    fireEvent.input(screen.getByPlaceholderText(/Search movements/i), {
      target: { value: 'Dead Bug' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));

    await waitFor(() =>
      expect(state.value?.movements.some((m) => m.name === 'Dead Bug')).toBe(true),
    );
    expect(state.value!.movements.find((m) => m.name === 'Dead Bug')!.region).toBe('full');
  });

  it('"+ Set" prefills the new set from the previous one', () => {
    renderPage();
    const main = mainBlockCard();

    fireEvent.click(within(main).getByRole('button', { name: '+ Add movement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back Squat' }));

    fireEvent.input(screen.getByPlaceholderText('weight (lb)'), { target: { value: '185' } });
    fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '8' } });

    fireEvent.click(within(mainBlockCard()).getByRole('button', { name: '+ Set' }));

    const weightInputs = screen.getAllByPlaceholderText('weight (lb)') as HTMLInputElement[];
    const repInputs = screen.getAllByPlaceholderText('reps') as HTMLInputElement[];
    expect(weightInputs).toHaveLength(2);
    expect(weightInputs[1].value).toBe('185');
    expect(repInputs[1].value).toBe('8');
  });

  it('Save builds a vasa log with region/style meta and blockIndex results, routes away, and clears the draft', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-16T09:00:00')); // Tuesday -> lower
    renderPage();
    const main = mainBlockCard();

    fireEvent.click(within(main).getByRole('button', { name: '+ Add movement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back Squat' }));
    fireEvent.input(screen.getByPlaceholderText('weight (lb)'), { target: { value: '185' } });
    fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '8' } });

    fireEvent.click(screen.getByRole('button', { name: 'Build · strength' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(state.value?.logs.length).toBe(1));
    const log = state.value!.logs[0];
    expect(log.kind).toBe('vasa');
    expect(log.vasa).toEqual({ region: 'lower', style: 'build' });
    expect(log.results[0]).toMatchObject({ movementId: 'squat', blockIndex: 0 });
    expect(log.results[0].sets).toEqual([{ weight: 185, reps: 8 }]);

    expect(window.location.pathname).toBe(`/history/${log.id}`);
    expect(readVasaDraft()).toBeNull();
  });

  it('Save is disabled when no block has a movement', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('restores a previously stored draft on mount', () => {
    const draft = newVasaDraft(new Date('2024-01-17T09:00:00')); // Wednesday -> upper
    draft.regionTouched = true;
    draft.region = 'upper';
    draft.blocks[0].movements = [
      { movementId: 'squat', sets: [{ weight: '135', reps: '5' }], note: '' },
    ];
    writeVasaDraft(draft);

    renderPage();

    expect(screen.getByRole('button', { name: 'Upper', pressed: true })).toBeInTheDocument();
    expect(within(mainBlockCard()).getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('weight (lb)')).toHaveValue(135);
    expect(screen.getByPlaceholderText('reps')).toHaveValue(5);
  });
});
