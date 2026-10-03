import { useState } from 'preact/hooks';
import { hasExactName, searchMovements } from '../../domain/vasa/search';
import { inLibrary, newVasaMovement } from '../../domain/vasa/library';
import { recentEnteredMovementIds } from '../../domain/vasa/pool';
import { REGION_LABELS, movementRegion } from '../../domain/vasa/region';
import { update } from '../../state/store';
import type { AppState, Block, BodyRegion, Equipment, Unit } from '../../domain/types';
import { EQUIPMENT_LABELS, movementName } from '../helpers';
import { NewMovementSheet } from './NewMovementSheet';

const REGIONS: BodyRegion[] = ['lower', 'upper', 'full'];

/** A live block holds a superset of up to this many movements. */
export const LIVE_BLOCK_MAX_MOVEMENTS = 3;

/** The 2-minute AMRAP the planned composer uses for its finisher (`buildEnteredWorkout`). */
const FINISHER_SEC = 120;

function equipmentSummary(equipment: Equipment[]): string {
  const named = equipment.filter((e) => e !== 'none');
  if (named.length === 0) return 'No equipment';
  return named.map((e) => EQUIPMENT_LABELS[e]).join(', ');
}

export interface LiveBlockPickerProps {
  appState: AppState;
  /** 1-based number of the block being picked. */
  blockNumber: number;
  region: BodyRegion;
  onRegion: (region: BodyRegion) => void;
  onBegin: (block: Block) => void;
  onFinish: () => void;
}

/**
 * Live workouts: pick the next block's movements (a superset of up to three)
 * right before it starts — recent movements as one-tap chips, search, or
 * create a new one — then Begin. A block is open sets (count-up set and rest
 * clocks until End block) or a 2-minute AMRAP finisher.
 */
export function LiveBlockPicker({
  appState,
  blockNumber,
  region,
  onRegion,
  onBegin,
  onFinish,
}: LiveBlockPickerProps) {
  const [kind, setKind] = useState<'sets' | 'finisher'>('sets');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const full = selected.length >= LIVE_BLOCK_MAX_MOVEMENTS;
  const title = kind === 'finisher' ? 'Finisher' : `Block ${blockNumber}`;

  function add(movementId: string) {
    setSelected((prev) =>
      prev.includes(movementId) || prev.length >= LIVE_BLOCK_MAX_MOVEMENTS
        ? prev
        : [...prev, movementId],
    );
    setQuery('');
    setCreating(false);
  }

  function remove(movementId: string) {
    setSelected((prev) => prev.filter((id) => id !== movementId));
  }

  async function createAndAdd(input: {
    name: string;
    region: BodyRegion;
    equipment: Equipment[];
    loadable: boolean;
    unit: Unit;
  }) {
    const movement = newVasaMovement({
      name: input.name,
      region: input.region,
      existingIds: appState.movements.map((m) => m.id),
      loadable: input.loadable,
      equipment: input.equipment.length ? input.equipment : ['none'],
      unit: input.unit,
    });
    await update((cur) => ({ ...cur, movements: [...cur.movements, movement] }));
    add(movement.id);
  }

  function begin() {
    const movements = selected.map((movementId) => ({ movementId }));
    onBegin(
      kind === 'finisher'
        ? { format: 'amrap', title, movements, durationSec: FINISHER_SEC }
        : { format: 'strength', title, movements, openSets: true },
    );
  }

  const known = new Set(appState.movements.map((m) => m.id));
  const recent = recentEnteredMovementIds(appState.logs, region).filter(
    (id) => known.has(id) && !selected.includes(id),
  );
  const candidates = appState.movements.filter((m) => !selected.includes(m.id));
  const trimmed = query.trim();
  const results = searchMovements(candidates, query, {
    region,
    logs: appState.logs,
    now: new Date(),
    limit: trimmed === '' ? 8 : 20,
  });
  const showCreate = trimmed !== '' && !hasExactName(appState.movements, query);

  return (
    <div class="run-screen">
      <div class="run-top">
        <span class="run-top-spacer" />
        <span class="muted">Block {blockNumber}</span>
        <span class="run-top-spacer" />
      </div>
      <div class="stack live-picker">
        <p class="run-phase-label">Next: {title}</p>

        <div class="chip-row" role="group" aria-label="Region">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              class={`chip-toggle${region === r ? ' active' : ''}`}
              aria-pressed={region === r}
              onClick={() => onRegion(r)}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>

        <div class="chip-row" role="group" aria-label="Block type">
          <button
            type="button"
            class={`chip-toggle${kind === 'sets' ? ' active' : ''}`}
            aria-pressed={kind === 'sets'}
            onClick={() => setKind('sets')}
          >
            Sets
          </button>
          <button
            type="button"
            class={`chip-toggle${kind === 'finisher' ? ' active' : ''}`}
            aria-pressed={kind === 'finisher'}
            onClick={() => setKind('finisher')}
          >
            Finisher · 2 min AMRAP
          </button>
        </div>

        <div class="card stack">
          <div class="section-title">
            Movements ({selected.length}/{LIVE_BLOCK_MAX_MOVEMENTS})
          </div>
          {selected.length === 0 && <div class="muted">Add up to three for a superset.</div>}
          {selected.map((id) => {
            const name = movementName(appState, id);
            return (
              <div class="row" key={id}>
                <span class="list-row-title" style="flex:1;min-width:0">
                  {name}
                </span>
                <button class="icon-btn" onClick={() => remove(id)} aria-label={`Remove ${name}`}>
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {!full && creating && (
          <NewMovementSheet
            initialName={query}
            defaultRegion={kind === 'finisher' ? 'full' : region}
            blockTitle={title}
            movements={appState.movements}
            onUseExisting={add}
            onCreate={createAndAdd}
            onBack={() => setCreating(false)}
          />
        )}

        {!full && !creating && (
          <div class="card stack">
            {recent.length > 0 && (
              <div class="chip-row" role="group" aria-label="Recent movements">
                {recent.map((id) => (
                  <button key={id} type="button" class="chip-toggle" onClick={() => add(id)}>
                    {movementName(appState, id)}
                  </button>
                ))}
              </div>
            )}
            <input
              type="search"
              placeholder="Search movements…"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
            <div class="list" style="max-height:220px;overflow-y:auto">
              {results.map((m) => (
                <button class="list-row" key={m.id} onClick={() => add(m.id)}>
                  <div class="list-row-main">
                    <div class="row" style="gap:0.4rem">
                      <div class="list-row-title">{m.name}</div>
                      {inLibrary(m, 'vasa') && <span class="chip-kind">Vasa</span>}
                    </div>
                    <div class="list-row-sub">
                      {REGION_LABELS[movementRegion(m)]} · {equipmentSummary(m.equipment)}
                    </div>
                  </div>
                </button>
              ))}
              {showCreate && (
                <button class="list-row" onClick={() => setCreating(true)}>
                  <span class="list-row-main list-row-title">Create &ldquo;{trimmed}&rdquo;</span>
                </button>
              )}
              {results.length === 0 && !showCreate && <div class="muted">No matches.</div>}
            </div>
          </div>
        )}
      </div>
      <div class="run-controls">
        <button class="btn" onClick={onFinish}>
          Finish workout
        </button>
        <button class="btn btn-primary btn-big" onClick={begin} disabled={selected.length === 0}>
          Begin {kind === 'finisher' ? 'finisher' : 'block'}
        </button>
      </div>
    </div>
  );
}
