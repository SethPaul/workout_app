import { useState } from 'preact/hooks';
import { EQUIPMENT_LABELS } from '../helpers';
import { hasExactName, similarMovements } from '../../domain/vasa/search';
import { VASA_EQUIPMENT } from '../../domain/vasa/library';
import { REGION_LABELS } from '../../domain/vasa/region';
import type { BodyRegion, Equipment, Movement, Unit } from '../../domain/types';

const REGIONS: BodyRegion[] = ['lower', 'upper', 'full'];
const VASA_CREATE_EQUIPMENT = VASA_EQUIPMENT.filter((e) => e !== 'none');
const MEASURES: { unit: Unit; label: string }[] = [
  { unit: 'reps', label: 'Reps' },
  { unit: 'seconds', label: 'Seconds' },
];

export interface NewMovementSheetProps {
  initialName: string;
  defaultRegion: BodyRegion;
  blockTitle: string;
  movements: Movement[];
  onUseExisting: (movementId: string) => void;
  onCreate: (input: {
    name: string;
    region: BodyRegion;
    equipment: Equipment[];
    loadable: boolean;
    unit: Unit;
  }) => void | Promise<void>;
  onBack: () => void;
}

/**
 * SPEC 10.7 item 3: the "New movement" sheet swapped in for the picker when
 * the user taps "Create <query>…" — name, near-duplicate shortcuts
 * (`similarMovements`), region/equipment/measure chips and a "Log weight"
 * toggle, ending in a single Add action. If the (possibly edited) name now
 * exactly matches an existing movement, Add uses that movement instead of
 * creating a duplicate.
 */
export function NewMovementSheet(props: NewMovementSheetProps) {
  const { blockTitle, movements, onUseExisting, onCreate, onBack } = props;
  const [name, setName] = useState(props.initialName);
  const [region, setRegion] = useState<BodyRegion>(props.defaultRegion);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loadable, setLoadable] = useState(true);
  const [unit, setUnit] = useState<Unit>('reps');

  const trimmedName = name.trim();
  const similar = trimmedName ? similarMovements(movements, trimmedName, 3) : [];

  function toggleEquipment(eq: Equipment) {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));
  }

  function handleAdd() {
    if (!trimmedName) return;
    const existing = movements.find((m) => hasExactName([m], trimmedName));
    if (existing) {
      onUseExisting(existing.id);
      return;
    }
    void onCreate({ name: trimmedName, region, equipment, loadable, unit });
  }

  return (
    <div class="card stack">
      <div class="field">
        <label for="new-movement-name">Name</label>
        <input
          id="new-movement-name"
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </div>

      {similar.length > 0 && (
        <div class="stack" style="gap:0.3rem">
          <span class="muted">Already have:</span>
          <div class="chip-row">
            {similar.map((m) => (
              <button
                key={m.id}
                type="button"
                class="chip-toggle"
                onClick={() => onUseExisting(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <span class="muted">Region</span>
      <div class="chip-row">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            class={`chip-toggle${region === r ? ' active' : ''}`}
            aria-pressed={region === r}
            onClick={() => setRegion(r)}
          >
            {REGION_LABELS[r]}
          </button>
        ))}
      </div>

      <span class="muted">Equipment</span>
      <div class="chip-row">
        {VASA_CREATE_EQUIPMENT.map((eq) => (
          <button
            key={eq}
            type="button"
            class={`chip-toggle${equipment.includes(eq) ? ' active' : ''}`}
            aria-pressed={equipment.includes(eq)}
            onClick={() => toggleEquipment(eq)}
          >
            {EQUIPMENT_LABELS[eq]}
          </button>
        ))}
      </div>

      <label class="toggle-row">
        <span>Log weight</span>
        <input
          type="checkbox"
          checked={loadable}
          onChange={(e) => setLoadable((e.target as HTMLInputElement).checked)}
          style="width:24px;height:24px"
        />
      </label>

      <span class="muted">Measure</span>
      <div class="chip-row">
        {MEASURES.map((m) => (
          <button
            key={m.unit}
            type="button"
            class={`chip-toggle${unit === m.unit ? ' active' : ''}`}
            aria-pressed={unit === m.unit}
            onClick={() => setUnit(m.unit)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button class="btn btn-primary btn-block" disabled={!trimmedName} onClick={handleAdd}>
        Add to {blockTitle}
      </button>
      <button class="btn btn-ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
