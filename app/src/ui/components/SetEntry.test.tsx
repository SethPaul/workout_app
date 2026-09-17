import { useState } from 'preact/hooks';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { SetEntry } from './SetEntry';
import { buildResultsDraft, type ResultsDraft } from '../resultsDraft';
import type { AppState, Block, PoolWorkout } from '../../domain/types';

function fixtureState(): AppState {
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
      },
    ],
    cadenceDays: 14,
    enabled: true,
    source: 'manual',
  };
}

/** Controlled harness so SetEntry's onChange updates feed back into its own draft prop, and the
 * test can also drive `currentSet` forward the way Run's timer does. */
function Harness({ initialSet }: { initialSet: number }) {
  const appState = fixtureState();
  const workout = strengthWorkout();
  const block: Block = workout.blocks[0];
  const [draft, setDraft] = useState<ResultsDraft>(() => buildResultsDraft(appState, workout));
  const [currentSet, setCurrentSet] = useState(initialSet);

  return (
    <div>
      <button onClick={() => setCurrentSet((n) => n + 1)}>Next set</button>
      <SetEntry
        appState={appState}
        block={block}
        blockIndex={0}
        currentSet={currentSet}
        draft={draft}
        onChange={setDraft}
      />
      <pre data-testid="rpes">{JSON.stringify(draft.movements[0].sets!.map((s) => s.rpe))}</pre>
    </div>
  );
}

describe('SetEntry (bug fix: per-set RPE, not shared across sets)', () => {
  afterEach(() => cleanup());

  it('typing RPE on set 1 then advancing to set 2 and typing a different RPE leaves set 1 intact', () => {
    render(<Harness initialSet={1} />);

    fireEvent.input(screen.getByPlaceholderText('target 8'), { target: { value: '7' } });
    expect(screen.getByTestId('rpes')).toHaveTextContent('["7","",""]');

    fireEvent.click(screen.getByRole('button', { name: 'Next set' }));
    expect(screen.getByText('Back Squat · Set 2')).toBeInTheDocument();

    fireEvent.input(screen.getByPlaceholderText('target 8'), { target: { value: '9' } });
    expect(screen.getByTestId('rpes')).toHaveTextContent('["7","9",""]');
  });
});
