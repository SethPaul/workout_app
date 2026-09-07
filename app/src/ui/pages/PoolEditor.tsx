import { useMemo, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import type { Block, BlockMovement, Equipment, Format, Intensity, Movement, PoolWorkout, Unit } from '../../domain/types';
import { state, update } from '../../state/store';
import { EQUIPMENT_LABELS, FORMAT_LABELS, INTENSITY_LABELS, slugify, uid } from '../helpers';

const FORMATS: Format[] = ['strength', 'emom', 'tabata', 'interval', 'amrap', 'rounds', 'chipper', 'death_by'];
const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const ALL_UNITS: Unit[] = ['reps', 'meters', 'calories', 'seconds'];

function blankWorkout(): PoolWorkout {
  return {
    id: uid('workout'),
    name: '',
    intensity: 'M',
    blocks: [],
    cadenceDays: 14,
    enabled: true,
    tags: [],
    source: 'manual',
    notes: '',
  };
}

function blankBlock(): Block {
  return { format: 'strength', title: '', movements: [], sets: 3, restSec: 90 };
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

export function PoolEditor() {
  const s = state.value!;
  const location = useLocation();
  const { params } = useRoute();
  const isNew = params.id === undefined;
  const existing = !isNew ? s.pool.find((w) => w.id === params.id) : undefined;

  const [draft, setDraft] = useState<PoolWorkout>(() => (existing ? structuredClone(existing) : blankWorkout()));
  const [tagInput, setTagInput] = useState('');
  const [pickerBlockIndex, setPickerBlockIndex] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [newMovement, setNewMovement] = useState({
    name: '',
    equipment: [] as Equipment[],
    tags: '',
    cadenceDays: '7',
    unit: 'reps' as Unit,
    loadable: true,
  });

  if (!isNew && !existing) {
    return (
      <div class="empty-state">
        <p>Workout not found.</p>
        <a href="/pool">Back to Pool</a>
      </div>
    );
  }

  function patch(fn: (d: PoolWorkout) => void) {
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });
  }

  function addBlock() {
    patch((d) => d.blocks.push(blankBlock()));
  }

  function removeBlock(i: number) {
    patch((d) => d.blocks.splice(i, 1));
  }

  function moveBlock(i: number, dir: -1 | 1) {
    patch((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.blocks.length) return;
      const [b] = d.blocks.splice(i, 1);
      d.blocks.splice(j, 0, b);
    });
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    patch((d) => {
      d.tags = [...(d.tags ?? []), t];
    });
    setTagInput('');
  }

  function removeTag(t: string) {
    patch((d) => {
      d.tags = (d.tags ?? []).filter((x) => x !== t);
    });
  }

  function addMovementToBlock(blockIndex: number, movementId: string) {
    patch((d) => {
      d.blocks[blockIndex].movements.push({ movementId });
    });
    setPickerBlockIndex(null);
    setPickerQuery('');
  }

  function removeMovementFromBlock(blockIndex: number, movementIndex: number) {
    patch((d) => {
      d.blocks[blockIndex].movements.splice(movementIndex, 1);
    });
  }

  function patchMovement(blockIndex: number, movementIndex: number, fn: (bm: BlockMovement) => void) {
    patch((d) => {
      fn(d.blocks[blockIndex].movements[movementIndex]);
    });
  }

  const pickerMatches = useMemo(() => {
    if (pickerBlockIndex === null) return [];
    const q = pickerQuery.trim().toLowerCase();
    const list = q
      ? s.movements.filter(
          (m) => m.name.toLowerCase().includes(q) || (m.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
        )
      : s.movements;
    return list.slice(0, 25);
  }, [s.movements, pickerBlockIndex, pickerQuery]);

  async function createMovement() {
    const name = newMovement.name.trim();
    if (!name) return;
    const id = slugify(name);
    const movement: Movement = {
      id,
      name,
      tags: newMovement.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      equipment: newMovement.equipment.length ? newMovement.equipment : ['none'],
      cadenceDays: numOrUndef(newMovement.cadenceDays) ?? 3,
      unit: newMovement.unit,
      loadable: newMovement.loadable,
    };
    await update((cur) => ({ ...cur, movements: [...cur.movements.filter((m) => m.id !== id), movement] }));
    if (pickerBlockIndex !== null) addMovementToBlock(pickerBlockIndex, id);
    setShowNewMovement(false);
    setNewMovement({ name: '', equipment: [], tags: '', cadenceDays: '7', unit: 'reps', loadable: true });
  }

  async function save() {
    if (!draft.name.trim()) {
      alert('Name is required.');
      return;
    }
    await update((cur) => {
      const exists = cur.pool.some((w) => w.id === draft.id);
      return {
        ...cur,
        pool: exists ? cur.pool.map((w) => (w.id === draft.id ? draft : w)) : [...cur.pool, draft],
      };
    });
    location.route('/pool', true);
  }

  async function remove() {
    if (!confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    await update((cur) => ({ ...cur, pool: cur.pool.filter((w) => w.id !== draft.id) }));
    location.route('/pool', true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/pool" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">{isNew ? 'New Workout' : 'Edit Workout'}</h1>
      </div>

      <div class="stack">
        <div class="field">
          <label for="name">Name</label>
          <input
            id="name"
            type="text"
            value={draft.name}
            onInput={(e) => patch((d) => (d.name = (e.target as HTMLInputElement).value))}
          />
        </div>

        <div class="row">
          <div class="field" style="flex:1">
            <label for="intensity">Intensity</label>
            <select
              id="intensity"
              value={draft.intensity}
              onChange={(e) => patch((d) => (d.intensity = (e.target as HTMLSelectElement).value as Intensity))}
            >
              {(['H', 'M', 'L'] as const).map((i) => (
                <option value={i} key={i}>
                  {INTENSITY_LABELS[i]}
                </option>
              ))}
            </select>
          </div>
          <div class="field" style="flex:1">
            <label for="cadence">Repeat cadence (days)</label>
            <input
              id="cadence"
              type="number"
              value={draft.cadenceDays}
              onInput={(e) => patch((d) => (d.cadenceDays = Number((e.target as HTMLInputElement).value) || 0))}
            />
          </div>
        </div>

        <div class="toggle-row">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => patch((d) => (d.enabled = (e.target as HTMLInputElement).checked))}
            style="width:24px;height:24px"
          />
        </div>

        <div class="field">
          <label>Tags</label>
          <div class="tag-list">
            {(draft.tags ?? []).map((t) => (
              <span class="tag-pill" key={t}>
                {t}
                <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div class="row">
            <input
              type="text"
              placeholder="add tag…"
              value={tagInput}
              onInput={(e) => setTagInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
            <button class="btn" onClick={addTag}>
              Add
            </button>
          </div>
        </div>

        <div class="field">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            value={draft.notes ?? ''}
            onInput={(e) => patch((d) => (d.notes = (e.target as HTMLTextAreaElement).value))}
          />
        </div>

        <div class="section-title">Blocks</div>
        <div class="stack">
          {draft.blocks.map((block, bi) => (
            <div class="card stack" key={bi}>
              <div class="row-between">
                <strong>Block {bi + 1}</strong>
                <div class="row">
                  <button class="icon-btn" onClick={() => moveBlock(bi, -1)} disabled={bi === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    class="icon-btn"
                    onClick={() => moveBlock(bi, 1)}
                    disabled={bi === draft.blocks.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button class="icon-btn" onClick={() => removeBlock(bi)} aria-label="Remove block">
                    🗑
                  </button>
                </div>
              </div>

              <div class="field">
                <label>Title</label>
                <input
                  type="text"
                  value={block.title ?? ''}
                  onInput={(e) =>
                    patch((d) => (d.blocks[bi].title = (e.target as HTMLInputElement).value))
                  }
                />
              </div>

              <div class="field">
                <label>Format</label>
                <select
                  value={block.format}
                  onChange={(e) =>
                    patch((d) => (d.blocks[bi].format = (e.target as HTMLSelectElement).value as Format))
                  }
                >
                  {FORMATS.map((f) => (
                    <option value={f} key={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              <FormatFields block={block} onChange={(fn) => patch((d) => fn(d.blocks[bi]))} />

              <div class="section-title" style="margin-top:0.5rem">
                Movements
              </div>
              <div class="stack">
                {block.movements.map((bm, mi) => {
                  const mv = s.movements.find((m) => m.id === bm.movementId);
                  return (
                    <div class="card stack" key={mi} style="padding:0.6rem">
                      <div class="row-between">
                        <span class="list-row-title">{mv?.name ?? bm.movementId}</span>
                        <button class="icon-btn" onClick={() => removeMovementFromBlock(bi, mi)} aria-label="Remove movement">
                          ×
                        </button>
                      </div>
                      <div class="row">
                        <input
                          type="number"
                          placeholder="reps"
                          value={bm.reps ?? ''}
                          onInput={(e) =>
                            patchMovement(bi, mi, (m) => (m.reps = numOrUndef((e.target as HTMLInputElement).value)))
                          }
                        />
                        <input
                          type="number"
                          placeholder="distance (m)"
                          value={bm.distanceM ?? ''}
                          onInput={(e) =>
                            patchMovement(bi, mi, (m) => (m.distanceM = numOrUndef((e.target as HTMLInputElement).value)))
                          }
                        />
                        <input
                          type="number"
                          placeholder="seconds"
                          value={bm.seconds ?? ''}
                          onInput={(e) =>
                            patchMovement(bi, mi, (m) => (m.seconds = numOrUndef((e.target as HTMLInputElement).value)))
                          }
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="load note (e.g. heavy, 70% 1RM)"
                        value={bm.loadNote ?? ''}
                        onInput={(e) =>
                          patchMovement(bi, mi, (m) => (m.loadNote = (e.target as HTMLInputElement).value || undefined))
                        }
                      />
                    </div>
                  );
                })}
              </div>

              {pickerBlockIndex === bi ? (
                <div class="card stack">
                  <input
                    type="search"
                    autoFocus
                    placeholder="Search movements…"
                    value={pickerQuery}
                    onInput={(e) => setPickerQuery((e.target as HTMLInputElement).value)}
                  />
                  <div class="list" style="max-height:220px;overflow-y:auto">
                    {pickerMatches.map((m) => (
                      <button class="list-row" key={m.id} onClick={() => addMovementToBlock(bi, m.id)}>
                        <span class="list-row-main list-row-title">{m.name}</span>
                      </button>
                    ))}
                    {pickerMatches.length === 0 && <div class="muted">No matches.</div>}
                  </div>
                  <div class="row">
                    <button class="btn" onClick={() => setShowNewMovement((v) => !v)}>
                      + New movement
                    </button>
                    <button class="btn btn-ghost" onClick={() => setPickerBlockIndex(null)}>
                      Cancel
                    </button>
                  </div>
                  {showNewMovement && (
                    <div class="stack">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newMovement.name}
                        onInput={(e) => setNewMovement((n) => ({ ...n, name: (e.target as HTMLInputElement).value }))}
                      />
                      <div class="tag-list">
                        {ALL_EQUIPMENT.map((eq) => (
                          <label class="tag-pill" key={eq}>
                            <input
                              type="checkbox"
                              checked={newMovement.equipment.includes(eq)}
                              onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setNewMovement((n) => ({
                                  ...n,
                                  equipment: checked ? [...n.equipment, eq] : n.equipment.filter((x) => x !== eq),
                                }));
                              }}
                            />
                            {EQUIPMENT_LABELS[eq]}
                          </label>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="tags (comma separated)"
                        value={newMovement.tags}
                        onInput={(e) => setNewMovement((n) => ({ ...n, tags: (e.target as HTMLInputElement).value }))}
                      />
                      <div class="row">
                        <input
                          type="number"
                          placeholder="cadence days"
                          value={newMovement.cadenceDays}
                          onInput={(e) =>
                            setNewMovement((n) => ({ ...n, cadenceDays: (e.target as HTMLInputElement).value }))
                          }
                        />
                        <select
                          value={newMovement.unit}
                          onChange={(e) =>
                            setNewMovement((n) => ({ ...n, unit: (e.target as HTMLSelectElement).value as Unit }))
                          }
                        >
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
                          checked={newMovement.loadable}
                          onChange={(e) =>
                            setNewMovement((n) => ({ ...n, loadable: (e.target as HTMLInputElement).checked }))
                          }
                          style="width:24px;height:24px"
                        />
                      </label>
                      <button class="btn btn-primary" onClick={() => void createMovement()}>
                        Create &amp; Add
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button class="btn" onClick={() => setPickerBlockIndex(bi)}>
                  + Add movement
                </button>
              )}
            </div>
          ))}
          <button class="btn btn-block" onClick={addBlock}>
            + Add Block
          </button>
        </div>

        <hr class="sep" />
        <button class="btn btn-primary btn-big btn-block" onClick={() => void save()}>
          Save
        </button>
        {!isNew && (
          <button class="btn btn-danger btn-block" onClick={() => void remove()}>
            Delete Workout
          </button>
        )}
      </div>
    </div>
  );
}

function FormatFields({ block, onChange }: { block: Block; onChange: (fn: (b: Block) => void) => void }) {
  switch (block.format) {
    case 'strength':
      return (
        <div class="row">
          <div class="field" style="flex:1">
            <label>Sets</label>
            <input
              type="number"
              value={block.sets ?? ''}
              onInput={(e) => onChange((b) => (b.sets = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Rest (sec)</label>
            <input
              type="number"
              value={block.restSec ?? ''}
              onInput={(e) => onChange((b) => (b.restSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
        </div>
      );
    case 'emom':
      return (
        <div class="stack">
          <div class="row">
            <div class="field" style="flex:1">
              <label>Rounds</label>
              <input
                type="number"
                value={block.rounds ?? ''}
                onInput={(e) => onChange((b) => (b.rounds = numOrUndef((e.target as HTMLInputElement).value)))}
              />
            </div>
            <div class="field" style="flex:1">
              <label>Interval (sec)</label>
              <input
                type="number"
                value={block.intervalSec ?? ''}
                onInput={(e) => onChange((b) => (b.intervalSec = numOrUndef((e.target as HTMLInputElement).value)))}
              />
            </div>
          </div>
          <label class="toggle-row">
            <span>Alternate movements each round</span>
            <input
              type="checkbox"
              checked={!!block.alternate}
              onChange={(e) => onChange((b) => (b.alternate = (e.target as HTMLInputElement).checked))}
              style="width:24px;height:24px"
            />
          </label>
        </div>
      );
    case 'tabata':
      return (
        <div class="row">
          <div class="field" style="flex:1">
            <label>Rounds</label>
            <input
              type="number"
              placeholder="8"
              value={block.rounds ?? ''}
              onInput={(e) => onChange((b) => (b.rounds = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Work (sec)</label>
            <input
              type="number"
              placeholder="20"
              value={block.workSec ?? ''}
              onInput={(e) => onChange((b) => (b.workSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Rest (sec)</label>
            <input
              type="number"
              placeholder="10"
              value={block.restSec ?? ''}
              onInput={(e) => onChange((b) => (b.restSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
        </div>
      );
    case 'interval':
      return (
        <div class="row">
          <div class="field" style="flex:1">
            <label>Rounds</label>
            <input
              type="number"
              value={block.rounds ?? ''}
              onInput={(e) => onChange((b) => (b.rounds = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Work (sec)</label>
            <input
              type="number"
              value={block.workSec ?? ''}
              onInput={(e) => onChange((b) => (b.workSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Rest (sec)</label>
            <input
              type="number"
              value={block.restSec ?? ''}
              onInput={(e) => onChange((b) => (b.restSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
        </div>
      );
    case 'amrap':
      return (
        <div class="field">
          <label>Duration (sec)</label>
          <input
            type="number"
            value={block.durationSec ?? ''}
            onInput={(e) => onChange((b) => (b.durationSec = numOrUndef((e.target as HTMLInputElement).value)))}
          />
        </div>
      );
    case 'rounds':
      return (
        <div class="row">
          <div class="field" style="flex:1">
            <label>Rounds (optional)</label>
            <input
              type="number"
              value={block.rounds ?? ''}
              onInput={(e) => onChange((b) => (b.rounds = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
          <div class="field" style="flex:1">
            <label>Time cap (sec, optional)</label>
            <input
              type="number"
              value={block.timeCapSec ?? ''}
              onInput={(e) => onChange((b) => (b.timeCapSec = numOrUndef((e.target as HTMLInputElement).value)))}
            />
          </div>
        </div>
      );
    case 'chipper':
      return (
        <div class="field">
          <label>Time cap (sec, optional)</label>
          <input
            type="number"
            value={block.timeCapSec ?? ''}
            onInput={(e) => onChange((b) => (b.timeCapSec = numOrUndef((e.target as HTMLInputElement).value)))}
          />
        </div>
      );
    case 'death_by':
      return <p class="muted">Minute 1 = 1 rep, +1 rep each minute until failure. Set starting reps per movement below.</p>;
  }
}
