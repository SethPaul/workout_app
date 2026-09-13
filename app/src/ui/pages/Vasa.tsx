import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { buildVasaLog, lastVasaSets } from '../../domain/vasa/build';
import { hasExactName, searchMovements } from '../../domain/vasa/search';
import {
  inLibrary,
  newVasaMovement,
  VASA_STYLES,
  VASA_STYLE_LABELS,
} from '../../domain/vasa/library';
import { REGION_LABELS, movementRegion } from '../../domain/vasa/region';
import { EQUIPMENT_LABELS } from '../helpers';
import { resolveSettings } from '../../domain/program/context';
import { logVasa, state, update } from '../../state/store';
import { NewMovementSheet } from '../components/NewMovementSheet';
import type { BodyRegion, Equipment, SetResult, Unit, VasaStyle } from '../../domain/types';
import {
  draftHasAnyMovement,
  draftToLogInput,
  newVasaDraft,
  readVasaDraft,
  regionForDraftDate,
  writeVasaDraft,
  type VasaDraft,
  type VasaDraftMovement,
} from '../vasaDraft';

const REGIONS: BodyRegion[] = ['lower', 'upper', 'full'];

/** "185×8, 185×8" from stored sets; weight-only shows "185", reps-only "×8"; a set with neither is skipped. */
function formatLastSets(sets: SetResult[]): string {
  return sets
    .filter((s) => s.weight !== undefined || s.reps !== undefined)
    .map((s) => {
      if (s.weight !== undefined && s.reps !== undefined) return `${s.weight}×${s.reps}`;
      return s.weight !== undefined ? `${s.weight}` : `×${s.reps}`;
    })
    .join(', ');
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** SPEC 10.7 item 1: picker result subtitle — "<Region> · <equipment, ...>" or "No equipment". */
function equipmentSummary(equipment: Equipment[]): string {
  const named = equipment.filter((e) => e !== 'none');
  if (named.length === 0) return 'No equipment';
  return named.map((e) => EQUIPMENT_LABELS[e]).join(', ');
}

/**
 * Vasa LFT quick-logging screen (SPEC 10.5). Optimised for one-thumb entry
 * between sets: a draft is restored from localStorage on mount and written
 * back on every change (`src/ui/vasaDraft.ts`, same pattern as
 * `state/run.ts`), so a reload mid-class loses nothing. Save builds and
 * commits the log via `buildVasaLog`/`logVasa` and clears the draft; Discard
 * clears it after confirmation and starts fresh without leaving the page.
 */
export function Vasa() {
  const s = state.value!;
  const location = useLocation();
  const units = resolveSettings(s.settings).units;

  const [draft, setDraftState] = useState<VasaDraft>(
    () => readVasaDraft() ?? newVasaDraft(new Date()),
  );
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerMode, setPickerMode] = useState<'search' | 'create'>('search');

  function setDraft(updater: VasaDraft | ((prev: VasaDraft) => VasaDraft)) {
    setDraftState((prev) => {
      const next =
        typeof updater === 'function' ? (updater as (p: VasaDraft) => VasaDraft)(prev) : updater;
      writeVasaDraft(next);
      return next;
    });
  }

  function movementName(id: string): string {
    return s.movements.find((m) => m.id === id)?.name ?? id;
  }

  function onDateInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (!value) return;
    setDraft((prev) => ({
      ...prev,
      date: value,
      region: prev.regionTouched ? prev.region : regionForDraftDate(value),
    }));
  }

  function setRegion(region: BodyRegion) {
    setDraft((prev) => ({ ...prev, region, regionTouched: true }));
  }

  function setStyle(style: VasaStyle) {
    setDraft((prev) => ({ ...prev, style: prev.style === style ? undefined : style }));
  }

  function openPickerFor(blockIndex: number) {
    setOpenPicker(blockIndex);
    setPickerQuery('');
    setPickerMode('search');
  }

  function closePicker() {
    setOpenPicker(null);
    setPickerQuery('');
    setPickerMode('search');
  }

  function addMovementToBlock(blockIndex: number, movementId: string) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        const movement: VasaDraftMovement =
          b.role === 'finisher'
            ? { movementId, sets: [], note: '' }
            : { movementId, sets: [{ weight: '', reps: '' }], note: '' };
        return { ...b, movements: [...b.movements, movement] };
      }),
    }));
    closePicker();
  }

  /** SPEC 10.7 item 3: Add on the New movement sheet — creates via `newVasaMovement` and adds it. */
  async function createAndAdd(
    blockIndex: number,
    input: {
      name: string;
      region: BodyRegion;
      equipment: Equipment[];
      loadable: boolean;
      unit: Unit;
    },
  ) {
    const movement = newVasaMovement({
      name: input.name,
      region: input.region,
      existingIds: s.movements.map((m) => m.id),
      loadable: input.loadable,
      equipment: input.equipment.length ? input.equipment : ['none'],
      unit: input.unit,
    });
    await update((cur) => ({ ...cur, movements: [...cur.movements, movement] }));
    addMovementToBlock(blockIndex, movement.id);
  }

  function removeMovement(blockIndex: number, movementId: string) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) =>
        i === blockIndex
          ? { ...b, movements: b.movements.filter((m) => m.movementId !== movementId) }
          : b,
      ),
    }));
  }

  function addSet(blockIndex: number, movementId: string) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        return {
          ...b,
          movements: b.movements.map((m) => {
            if (m.movementId !== movementId) return m;
            const prevSet = m.sets[m.sets.length - 1];
            const nextSet = prevSet ? { ...prevSet } : { weight: '', reps: '' };
            return { ...m, sets: [...m.sets, nextSet] };
          }),
        };
      }),
    }));
  }

  function removeSet(blockIndex: number, movementId: string, index: number) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        return {
          ...b,
          movements: b.movements.map((m) =>
            m.movementId === movementId
              ? { ...m, sets: m.sets.filter((_, si) => si !== index) }
              : m,
          ),
        };
      }),
    }));
  }

  function patchSet(
    blockIndex: number,
    movementId: string,
    index: number,
    field: 'weight' | 'reps',
    value: string,
  ) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        return {
          ...b,
          movements: b.movements.map((m) => {
            if (m.movementId !== movementId) return m;
            return {
              ...m,
              sets: m.sets.map((set, si) => (si === index ? { ...set, [field]: value } : set)),
            };
          }),
        };
      }),
    }));
  }

  function patchNote(blockIndex: number, movementId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) =>
        i === blockIndex
          ? {
              ...b,
              movements: b.movements.map((m) =>
                m.movementId === movementId ? { ...m, note: value } : m,
              ),
            }
          : b,
      ),
    }));
  }

  async function save() {
    if (!draftHasAnyMovement(draft)) return;
    const log = buildVasaLog(draftToLogInput(draft, s.movements));
    await logVasa(log);
    writeVasaDraft(null);
    location.route(`/history/${log.id}`, true);
  }

  function discard() {
    if (!confirm('Discard this Vasa log?')) return;
    setDraft(newVasaDraft(new Date()));
  }

  function renderMainAccessoryRow(blockIndex: number, movement: VasaDraftMovement) {
    const name = movementName(movement.movementId);
    const last = lastVasaSets(s.logs, movement.movementId);
    const lastText = last ? formatLastSets(last.sets) : '';
    return (
      <div class="card stack" key={movement.movementId}>
        <div class="row-between">
          <span class="row">
            <span class="list-row-title">{name}</span>
            <a class="muted" href={`/movements/${movement.movementId}`}>
              edit
            </a>
          </span>
          <button
            class="icon-btn"
            onClick={() => removeMovement(blockIndex, movement.movementId)}
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        </div>
        {lastText && (
          <div class="muted">
            last: {lastText} · {shortDate(last!.date)}
          </div>
        )}
        <div class="stack">
          {movement.sets.map((set, si) => (
            <div class="row" key={si}>
              <span class="muted" style="width:3.5rem">
                Set {si + 1}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder={`weight (${units})`}
                value={set.weight}
                onInput={(e) =>
                  patchSet(
                    blockIndex,
                    movement.movementId,
                    si,
                    'weight',
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={set.reps}
                onInput={(e) =>
                  patchSet(
                    blockIndex,
                    movement.movementId,
                    si,
                    'reps',
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
              <button
                class="icon-btn"
                onClick={() => removeSet(blockIndex, movement.movementId, si)}
                disabled={movement.sets.length <= 1}
                aria-label="Remove set"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        <button class="btn" onClick={() => addSet(blockIndex, movement.movementId)}>
          + Set
        </button>
      </div>
    );
  }

  function renderFinisherRow(blockIndex: number, movement: VasaDraftMovement) {
    const name = movementName(movement.movementId);
    return (
      <div class="card stack" key={movement.movementId}>
        <div class="row-between">
          <span class="row">
            <span class="list-row-title">{name}</span>
            <a class="muted" href={`/movements/${movement.movementId}`}>
              edit
            </a>
          </span>
          <button
            class="icon-btn"
            onClick={() => removeMovement(blockIndex, movement.movementId)}
            aria-label={`Remove ${name}`}
          >
            ×
          </button>
        </div>
        <div class="field">
          <input
            type="text"
            placeholder="3 rounds / 20 each side"
            value={movement.note}
            onInput={(e) =>
              patchNote(blockIndex, movement.movementId, (e.target as HTMLInputElement).value)
            }
          />
        </div>
      </div>
    );
  }

  /** Default region for a movement created from this block (SPEC 10.7 item 3, 10.5 item 2). */
  function defaultRegionFor(blockIndex: number): BodyRegion {
    return draft.blocks[blockIndex].role === 'finisher' ? 'full' : draft.region;
  }

  function renderPicker(blockIndex: number) {
    const block = draft.blocks[blockIndex];

    if (pickerMode === 'create') {
      return (
        <NewMovementSheet
          initialName={pickerQuery}
          defaultRegion={defaultRegionFor(blockIndex)}
          blockTitle={block.title}
          movements={s.movements}
          onUseExisting={(movementId) => addMovementToBlock(blockIndex, movementId)}
          onCreate={(input) => createAndAdd(blockIndex, input)}
          onBack={() => setPickerMode('search')}
        />
      );
    }

    const alreadyAdded = new Set(block.movements.map((m) => m.movementId));
    const candidates = s.movements.filter((m) => !alreadyAdded.has(m.id));
    const trimmedQuery = pickerQuery.trim();
    const results = searchMovements(candidates, pickerQuery, {
      region: draft.region,
      logs: s.logs,
      now: new Date(),
      limit: trimmedQuery === '' ? 8 : 20,
    });
    const showCreate = trimmedQuery !== '' && !hasExactName(s.movements, pickerQuery);

    const createRow = (
      <button class="list-row" key="create" onClick={() => setPickerMode('create')}>
        <span class="list-row-main list-row-title">Create &ldquo;{trimmedQuery}&rdquo;</span>
      </button>
    );

    return (
      <div class="card stack">
        <input
          type="search"
          autoFocus
          placeholder="Search movements…"
          value={pickerQuery}
          onInput={(e) => setPickerQuery((e.target as HTMLInputElement).value)}
        />
        <div class="list" style="max-height:220px;overflow-y:auto">
          {showCreate && results.length === 0 && createRow}
          {results.map((m) => (
            <button
              class="list-row"
              key={m.id}
              onClick={() => addMovementToBlock(blockIndex, m.id)}
            >
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
          {showCreate && results.length > 0 && createRow}
          {results.length === 0 && !showCreate && <div class="muted">No matches.</div>}
        </div>
        <button class="btn btn-ghost" onClick={closePicker}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/history" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">Vasa LFT</h1>
      </div>

      <div class="stack">
        <div class="field">
          <label for="vasa-date">Date</label>
          <input id="vasa-date" type="date" value={draft.date} onInput={onDateInput} />
        </div>

        <div class="chip-row">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              class={`chip-toggle${draft.region === r ? ' active' : ''}`}
              aria-pressed={draft.region === r}
              onClick={() => setRegion(r)}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>

        <div class="chip-row">
          {VASA_STYLES.map((st) => (
            <button
              key={st}
              type="button"
              class={`chip-toggle${draft.style === st ? ' active' : ''}`}
              aria-pressed={draft.style === st}
              onClick={() => setStyle(st)}
            >
              {VASA_STYLE_LABELS[st]}
            </button>
          ))}
        </div>

        {draft.blocks.map((block, i) => (
          <div class="card stack" key={i}>
            <div class="section-title">{block.title}</div>
            <div class="stack">
              {block.movements.map((m) =>
                block.role === 'finisher' ? renderFinisherRow(i, m) : renderMainAccessoryRow(i, m),
              )}
            </div>
            {openPicker === i ? (
              renderPicker(i)
            ) : (
              <button class="btn btn-block" onClick={() => openPickerFor(i)}>
                + Add movement
              </button>
            )}
          </div>
        ))}

        <div class="field">
          <label for="vasa-notes">Notes</label>
          <textarea
            id="vasa-notes"
            value={draft.notes}
            onInput={(e) =>
              setDraft((prev) => ({ ...prev, notes: (e.target as HTMLTextAreaElement).value }))
            }
          />
        </div>

        <div class="field">
          <label for="vasa-rpe">RPE</label>
          <input
            id="vasa-rpe"
            type="number"
            inputMode="decimal"
            min="1"
            max="10"
            step="0.5"
            placeholder="optional"
            value={draft.rpe}
            onInput={(e) =>
              setDraft((prev) => ({ ...prev, rpe: (e.target as HTMLInputElement).value }))
            }
          />
        </div>

        <button
          class="btn btn-primary btn-big btn-block"
          disabled={!draftHasAnyMovement(draft)}
          onClick={() => void save()}
        >
          Save
        </button>
        <button class="btn btn-ghost" onClick={discard}>
          Discard
        </button>
      </div>
    </div>
  );
}
