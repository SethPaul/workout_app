import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { NewMovementSheet } from './NewMovementSheet';
import type { Movement } from '../../domain/types';

function movement(id: string, name: string, overrides: Partial<Movement> = {}): Movement {
  return {
    id,
    name,
    tags: [],
    equipment: [],
    cadenceDays: 3,
    unit: 'reps',
    loadable: true,
    ...overrides,
  };
}

const MOVEMENTS: Movement[] = [movement('squat', 'Back Squat'), movement('plank', 'Plank')];

function renderSheet(overrides: Partial<Parameters<typeof NewMovementSheet>[0]> = {}) {
  const onCreate = vi.fn();
  const onUseExisting = vi.fn();
  const onBack = vi.fn();
  render(
    <NewMovementSheet
      initialName="Wall Ball"
      defaultRegion="full"
      blockTitle="Main"
      movements={MOVEMENTS}
      onCreate={onCreate}
      onUseExisting={onUseExisting}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { onCreate, onUseExisting, onBack };
}

/** SPEC 10.7 item 3: the "New movement" sheet swapped in for the Vasa picker. */
describe('NewMovementSheet', () => {
  afterEach(() => cleanup());

  it('prefills the name and defaults the region chip, disabling Add when the name is blank', () => {
    renderSheet();
    expect(screen.getByDisplayValue('Wall Ball')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full body', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Main' })).not.toBeDisabled();

    fireEvent.input(screen.getByDisplayValue('Wall Ball'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Add to Main' })).toBeDisabled();
  });

  it('Add creates with the selected region, equipment, loadable and unit', () => {
    const { onCreate, onUseExisting } = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Lower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seconds' }));
    fireEvent.click(screen.getByRole('checkbox')); // turn "Log weight" off
    fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

    expect(onUseExisting).not.toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Wall Ball',
      region: 'lower',
      equipment: ['band'],
      loadable: false,
      unit: 'seconds',
    });
  });

  it('equipment chips multi-select and un-select', () => {
    const { onCreate } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Bands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Barbell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bands' })); // un-select
    fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ equipment: ['barbell'] }));
  });

  it('shows "Already have" chips from similarMovements and adds the existing movement instead of creating', () => {
    const { onCreate, onUseExisting } = renderSheet({ initialName: 'Back Sq' });

    fireEvent.click(screen.getByRole('button', { name: 'Back Squat' }));

    expect(onUseExisting).toHaveBeenCalledWith('squat');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('editing the name to exactly match an existing movement uses it on Add instead of creating', () => {
    const { onCreate, onUseExisting } = renderSheet();

    fireEvent.input(screen.getByDisplayValue('Wall Ball'), { target: { value: 'Back Squat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Main' }));

    expect(onUseExisting).toHaveBeenCalledWith('squat');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('Back calls onBack', () => {
    const { onBack } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
