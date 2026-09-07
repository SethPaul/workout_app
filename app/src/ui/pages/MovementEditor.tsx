import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Equipment, Movement, Unit } from '../../domain/types';
import { state, update } from '../../state/store';
import { EQUIPMENT_LABELS } from '../helpers';

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const ALL_UNITS: Unit[] = ['reps', 'meters', 'calories', 'seconds'];

export function MovementEditor() {
  const s = state.value!;
  const location = useLocation();
  const { params } = useRoute();
  const existing = s.movements.find((m) => m.id === params.id);

  const [draft, setDraft] = useState<Movement | null>(existing ? structuredClone(existing) : null);
  const [tagsInput, setTagsInput] = useState(existing?.tags.join(', ') ?? '');

  if (!existing || !draft) {
    return (
      <div class="empty-state">
        <p>Movement not found.</p>
        <a href="/movements">Back to Movements</a>
      </div>
    );
  }

  function patch(fn: (m: Movement) => void) {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const toSave: Movement = { ...draft, tags };
    await update((cur) => ({ ...cur, movements: cur.movements.map((m) => (m.id === toSave.id ? toSave : m)) }));
    location.route('/movements', true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/movements" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">{draft.name}</h1>
      </div>
      <div class="stack">
        <div class="field">
          <label>Name</label>
          <input
            type="text"
            value={draft.name}
            onInput={(e) => patch((m) => (m.name = (e.target as HTMLInputElement).value))}
          />
        </div>

        <div class="field">
          <label>Cadence (minimum days between performances)</label>
          <input
            type="number"
            value={draft.cadenceDays}
            onInput={(e) => patch((m) => (m.cadenceDays = Number((e.target as HTMLInputElement).value) || 0))}
          />
        </div>

        <div class="field">
          <label>Unit</label>
          <select value={draft.unit} onChange={(e) => patch((m) => (m.unit = (e.target as HTMLSelectElement).value as Unit))}>
            {ALL_UNITS.map((u) => (
              <option value={u} key={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <label class="toggle-row">
          <span>Loadable (logs weight)</span>
          <input
            type="checkbox"
            checked={draft.loadable}
            onChange={(e) => patch((m) => (m.loadable = (e.target as HTMLInputElement).checked))}
            style="width:24px;height:24px"
          />
        </label>

        <div class="field">
          <label>Equipment required</label>
          <div class="tag-list">
            {ALL_EQUIPMENT.map((eq) => (
              <label class="tag-pill" key={eq}>
                <input
                  type="checkbox"
                  checked={draft.equipment.includes(eq)}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    patch((m) => {
                      m.equipment = checked ? [...m.equipment, eq] : m.equipment.filter((x) => x !== eq);
                    });
                  }}
                />
                {EQUIPMENT_LABELS[eq]}
              </label>
            ))}
          </div>
        </div>

        <div class="field">
          <label>Tags (comma separated)</label>
          <input type="text" value={tagsInput} onInput={(e) => setTagsInput((e.target as HTMLInputElement).value)} />
        </div>

        {draft.aliases && draft.aliases.length > 0 && (
          <div class="field">
            <label>Aliases</label>
            <div class="muted">{draft.aliases.join(', ')}</div>
          </div>
        )}

        <button class="btn btn-primary btn-big btn-block" onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  );
}
