import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { LocationProvider } from 'preact-iso';
import { EnterWorkout } from './EnterWorkout';
import { clearTodayWorkout, setStorage, state, todayWorkout } from '../../state/store';
import { clearRunSession, runSession } from '../../state/run';
import { newEnterDraft, readEnterDraft, writeEnterDraft } from '../enterDraft';
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

function poolWorkoutFixture(): PoolWorkout {
  return {
    id: 'w1',
    name: 'Lower Body Blast',
    intensity: 'M',
    blocks: [
      {
        format: 'strength',
        title: 'Main',
        movements: [{ movementId: 'squat', reps: 5 }],
        sets: 5,
      },
    ],
    cadenceDays: 14,
    enabled: true,
    tags: ['vasa', 'region:lower'],
    source: 'manual',
    notes: '',
  };
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
    pool: [poolWorkoutFixture()],
    logs: [],
    settings: { availableEquipment: [], soundOn: true, vibrateOn: true, keepScreenOn: true },
    schemaVersion: 3,
    program: { cycleStartedAt: new Date().toISOString(), dismissedFlags: [] },
  };
}

function renderPage() {
  return render(
    <LocationProvider>
      <EnterWorkout />
    </LocationProvider>,
  );
}

/** The Main block's card in compose mode — the first "+ Add movement" / block section. */
function mainBlockCard(): HTMLElement {
  return screen.getByText('Main').closest('.card') as HTMLElement;
}

/** Opens the Main block's picker and types `query` into the search box. */
function searchMain(query: string) {
  const main = mainBlockCard();
  fireEvent.click(within(main).getByRole('button', { name: '+ Add movement' }));
  fireEvent.input(screen.getByPlaceholderText(/Search movements/i), { target: { value: query } });
}

/** Opens the New movement sheet from the Main block by searching for `query` and tapping Create. */
function openCreateSheet(query: string) {
  searchMain(query);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Create.*${query}`) }));
}

function openComposer() {
  fireEvent.click(screen.getByRole('button', { name: /Enter a new workout/ }));
}

describe('EnterWorkout ("/enter" screen, SPEC 10.8)', () => {
  beforeEach(() => {
    setStorage(new MemoryStorage());
    state.value = fixtureState();
    localStorage.clear();
    clearRunSession();
    clearTodayWorkout();
  });

  afterEach(() => {
    cleanup();
    clearRunSession();
    clearTodayWorkout();
    vi.useRealTimers();
  });

  describe('search mode', () => {
    it('lists a pool workout and expanding it shows Start', () => {
      renderPage();
      expect(screen.getByText('Lower Body Blast')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Lower Body Blast'));

      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Make it today/ })).toBeInTheDocument();
    });

    it('Start sets today’s workout and a run session, and routes to /run', () => {
      renderPage();
      fireEvent.click(screen.getByText('Lower Body Blast'));
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));

      expect(todayWorkout.value?.workoutId).toBe('w1');
      expect(runSession.value?.poolWorkoutId).toBe('w1');
      expect(window.location.pathname).toBe('/run');
    });

    it('"Make it today’s" sets today without starting a run session', () => {
      renderPage();
      fireEvent.click(screen.getByText('Lower Body Blast'));
      fireEvent.click(screen.getByRole('button', { name: /Make it today/ }));

      expect(todayWorkout.value?.workoutId).toBe('w1');
      expect(runSession.value).toBeNull();
      expect(window.location.pathname).toBe('/');
    });

    it('the "Enter a new workout" button switches to compose mode', () => {
      renderPage();
      openComposer();
      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Back to search/ })).toBeInTheDocument();
    });

    it('offers "Not here? Enter a new workout" when a query has no results', () => {
      renderPage();
      fireEvent.input(screen.getByPlaceholderText(/Search the pool/i), {
        target: { value: 'Zzzznomatch' },
      });
      expect(
        screen.getByRole('button', { name: /Not here\? Enter a new workout/ }),
      ).toBeInTheDocument();
    });
  });

  describe('compose mode', () => {
    it('renders all four block titles', () => {
      renderPage();
      openComposer();
      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByText('Accessory 1')).toBeInTheDocument();
      expect(screen.getByText('Accessory 2')).toBeInTheDocument();
      expect(screen.getByText('Finisher (2 min)')).toBeInTheDocument();
    });

    it('defaults the region chip from the weekday (Tuesday -> Lower)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-16T09:00:00')); // Tuesday
      renderPage();
      openComposer();
      expect(screen.getByRole('button', { name: 'Lower', pressed: true })).toBeInTheDocument();
    });

    it('adds a movement via the picker, enters sets/reps, and persists the draft', () => {
      renderPage();
      openComposer();
      searchMain('Squat');
      fireEvent.click(screen.getByRole('button', { name: /Back Squat/ }));

      fireEvent.input(screen.getByPlaceholderText('sets'), { target: { value: '5' } });
      fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '5' } });

      const stored = readEnterDraft();
      expect(stored?.blocks[0].movements[0]).toMatchObject({
        movementId: 'squat',
        sets: '5',
        reps: '5',
      });
    });

    it('the Create row opens the New movement sheet, which adds a new vasa-library movement to the block', async () => {
      renderPage();
      openComposer();
      openCreateSheet('Wall Ball');

      expect(screen.getByDisplayValue('Wall Ball')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

      await waitFor(() =>
        expect(state.value?.movements.some((m) => m.name === 'Wall Ball')).toBe(true),
      );
      const created = state.value!.movements.find((m) => m.name === 'Wall Ball')!;
      expect(created.libraries).toEqual(['vasa']);
      await waitFor(() =>
        expect(within(mainBlockCard()).getByText('Wall Ball')).toBeInTheDocument(),
      );
    });

    it('selecting equipment chips in the sheet carries through to the created movement', async () => {
      renderPage();
      openComposer();
      openCreateSheet('Band Pull Apart');

      fireEvent.click(screen.getByRole('button', { name: 'Bands' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

      await waitFor(() =>
        expect(state.value?.movements.some((m) => m.name === 'Band Pull Apart')).toBe(true),
      );
      expect(state.value!.movements.find((m) => m.name === 'Band Pull Apart')!.equipment).toEqual([
        'band',
      ]);
    });

    it('turning "Log weight" off makes the created movement non-loadable', async () => {
      renderPage();
      openComposer();
      openCreateSheet('Hollow Hold');

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

      await waitFor(() =>
        expect(state.value?.movements.some((m) => m.name === 'Hollow Hold')).toBe(true),
      );
      expect(state.value!.movements.find((m) => m.name === 'Hollow Hold')!.loadable).toBe(false);
    });

    it("choosing the Seconds measure sets the created movement's unit", async () => {
      renderPage();
      openComposer();
      openCreateSheet('Side Plank');

      fireEvent.click(screen.getByRole('button', { name: 'Seconds' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

      await waitFor(() =>
        expect(state.value?.movements.some((m) => m.name === 'Side Plank')).toBe(true),
      );
      expect(state.value!.movements.find((m) => m.name === 'Side Plank')!.unit).toBe('seconds');
    });

    it('Back on the sheet returns to search with the query intact', () => {
      renderPage();
      openComposer();
      openCreateSheet('Wall Ball');
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByPlaceholderText(/Search movements/i)).toHaveValue('Wall Ball');
    });

    it('tapping an "Already have" chip adds the existing movement instead of creating one', async () => {
      renderPage();
      openComposer();
      openCreateSheet('Back Sq');

      fireEvent.click(screen.getByRole('button', { name: 'Back Squat' }));

      await waitFor(() =>
        expect(within(mainBlockCard()).getByText('Back Squat')).toBeInTheDocument(),
      );
      expect(state.value!.movements).toHaveLength(2); // nothing new created
    });

    it('editing the sheet name to an exact existing name uses that movement on Add (no duplicate)', async () => {
      renderPage();
      openComposer();
      openCreateSheet('Wall Ball');

      fireEvent.input(screen.getByDisplayValue('Wall Ball'), { target: { value: 'Back Squat' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

      await waitFor(() =>
        expect(within(mainBlockCard()).getByText('Back Squat')).toBeInTheDocument(),
      );
      expect(state.value!.movements).toHaveLength(2); // reused "squat", nothing created
    });

    it("a movement created from the Finisher sheet defaults to Full body, not the day's region", async () => {
      renderPage();
      openComposer();
      const finisher = screen.getByText('Finisher (2 min)').closest('.card') as HTMLElement;

      fireEvent.click(within(finisher).getByRole('button', { name: '+ Add movement' }));
      fireEvent.input(screen.getByPlaceholderText(/Search movements/i), {
        target: { value: 'Dead Bug' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Create/ }));

      expect(
        within(finisher).getByRole('button', { name: 'Full body', pressed: true }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add to Finisher (2 min)' }));

      await waitFor(() =>
        expect(state.value?.movements.some((m) => m.name === 'Dead Bug')).toBe(true),
      );
      expect(state.value!.movements.find((m) => m.name === 'Dead Bug')!.region).toBe('full');
    });

    it('a movement row has a small "edit" link to /movements/<id>', () => {
      const draft = newEnterDraft(new Date());
      draft.blocks[0].movements = [{ movementId: 'squat', sets: '', reps: '', seconds: '' }];
      writeEnterDraft(draft);
      renderPage();

      const link = within(mainBlockCard()).getByRole('link', { name: 'edit' });
      expect(link).toHaveAttribute('href', '/movements/squat');
    });

    it('Save & start is disabled and Save to pool is disabled when no block has a movement', () => {
      renderPage();
      openComposer();
      expect(screen.getByRole('button', { name: 'Save & start' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save to pool' })).toBeDisabled();
    });

    it('Save to pool appends a PoolWorkout tagged "vasa" with strength blocks carrying sets/reps and an amrap finisher, and clears the draft', async () => {
      renderPage();
      openComposer();

      searchMain('Squat');
      fireEvent.click(screen.getByRole('button', { name: /Back Squat/ }));
      fireEvent.input(screen.getByPlaceholderText('sets'), { target: { value: '5' } });
      fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '5' } });

      const finisher = screen.getByText('Finisher (2 min)').closest('.card') as HTMLElement;
      fireEvent.click(within(finisher).getByRole('button', { name: '+ Add movement' }));
      fireEvent.input(screen.getByPlaceholderText(/Search movements/i), {
        target: { value: 'Plank' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Plank/ }));
      fireEvent.input(screen.getByPlaceholderText('seconds'), { target: { value: '45' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save to pool' }));

      await waitFor(() => expect(state.value?.pool.length).toBe(2));
      const created = state.value!.pool.find((w) => w.id !== 'w1')!;
      expect(created.tags).toContain('vasa');
      const strengthBlock = created.blocks.find((b) => b.format === 'strength')!;
      expect(strengthBlock.sets).toBe(5);
      expect(strengthBlock.movements[0]).toMatchObject({ movementId: 'squat', reps: 5 });
      const finisherBlock = created.blocks.find((b) => b.format === 'amrap')!;
      expect(finisherBlock.durationSec).toBe(120);
      expect(finisherBlock.movements[0]).toMatchObject({ movementId: 'plank', seconds: 45 });

      expect(window.location.pathname).toBe(`/pool/${created.id}`);
      expect(readEnterDraft()).toBeNull();
    });

    it('Save & start additionally sets today’s workout and starts a run session', async () => {
      renderPage();
      openComposer();

      searchMain('Squat');
      fireEvent.click(screen.getByRole('button', { name: /Back Squat/ }));
      fireEvent.input(screen.getByPlaceholderText('sets'), { target: { value: '5' } });
      fireEvent.input(screen.getByPlaceholderText('reps'), { target: { value: '5' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save & start' }));

      await waitFor(() => expect(state.value?.pool.length).toBe(2));
      const created = state.value!.pool.find((w) => w.id !== 'w1')!;

      expect(todayWorkout.value?.workoutId).toBe(created.id);
      expect(runSession.value?.poolWorkoutId).toBe(created.id);
      expect(window.location.pathname).toBe('/run');
      expect(readEnterDraft()).toBeNull();
    });

    it('restores a previously stored draft in compose mode on mount', () => {
      const draft = newEnterDraft(new Date('2024-01-17T09:00:00')); // Wednesday -> upper
      draft.regionTouched = true;
      draft.region = 'upper';
      draft.blocks[0].movements = [{ movementId: 'squat', sets: '3', reps: '5', seconds: '' }];
      writeEnterDraft(draft);

      renderPage();

      expect(screen.getByRole('button', { name: 'Upper', pressed: true })).toBeInTheDocument();
      expect(within(mainBlockCard()).getByText('Back Squat')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('sets')).toHaveValue(3);
      expect(screen.getByPlaceholderText('reps')).toHaveValue(5);
    });
  });
});
