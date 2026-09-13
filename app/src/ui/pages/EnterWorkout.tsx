import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { lastPerformedWorkout } from '../../domain/cadence';
import { buildEnteredWorkout, defaultWorkoutName, searchPool } from '../../domain/vasa/pool';
import { hasExactName, searchMovements } from '../../domain/vasa/search';
import {
  inLibrary,
  newVasaMovement,
  VASA_STYLES,
  VASA_STYLE_LABELS,
} from '../../domain/vasa/library';
import { REGION_LABELS, movementRegion, regionForDate } from '../../domain/vasa/region';
import { EQUIPMENT_LABELS, movementName } from '../helpers';
import { addPoolWorkout, chooseTodayWorkout, state, update } from '../../state/store';
import { beginRunSession, runSession } from '../../state/run';
import { BlockSummary } from '../components/BlockSummary';
import { NewMovementSheet } from '../components/NewMovementSheet';
import type { BodyRegion, Equipment, PoolWorkout, Unit, VasaStyle } from '../../domain/types';
import {
  draftHasAnyMovement,
  draftToWorkoutInput,
  newEnterDraft,
  readEnterDraft,
  regionForDraftDate,
  writeEnterDraft,
  type EnterDraft,
  type EnterDraftMovement,
} from '../enterDraft';

const REGIONS: BodyRegion[] = ['lower', 'upper', 'full'];

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
 * `/enter` (SPEC 10.8): "Enter a workout" — search the pool for something
 * already known, or fall through to entering a new one that joins the pool.
 * Both flows end on `/run` via `chooseTodayWorkout` + `beginRunSession`.
 * Replaces `/vasa`; the composer draft is `src/ui/enterDraft.ts`, persisted
 * under `workout_app.enterDraft` the same way the old Vasa draft was.
 */
export function EnterWorkout() {
  const s = state.value!;
  const location = useLocation();

  const [initialDraft] = useState<EnterDraft>(() => readEnterDraft() ?? newEnterDraft(new Date()));
  const [mode, setMode] = useState<'search' | 'compose'>(() =>
    draftHasAnyMovement(initialDraft) || initialDraft.name.trim() !== '' ? 'compose' : 'search',
  );
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [draft, setDraftState] = useState<EnterDraft>(initialDraft);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerMode, setPickerMode] = useState<'search' | 'create'>('search');

  function setDraft(updater: EnterDraft | ((prev: EnterDraft) => EnterDraft)) {
    setDraftState((prev) => {
      const next =
        typeof updater === 'function' ? (updater as (p: EnterDraft) => EnterDraft)(prev) : updater;
      writeEnterDraft(next);
      return next;
    });
  }

  // --- Search mode --------------------------------------------------------

  const region = regionForDate(new Date());
  const trimmedQuery = query.trim();
  const results = searchPool(s.pool, s.movements, query, {
    region,
    logs: s.logs,
    now: new Date(),
    limit: trimmedQuery === '' ? 8 : 20,
  });

  function summaryLine(w: PoolWorkout): string {
    const ids = w.blocks.flatMap((b) => b.movements.map((m) => m.movementId));
    if (ids.length === 0) return '';
    const names = ids.slice(0, 3).map((id) => movementName(s, id));
    return ids.length > 3 ? `${names.join(', ')}…` : names.join(', ');
  }

  function lastDoneLabel(w: PoolWorkout): string {
    const last = lastPerformedWorkout(s.logs, w.id);
    return last ? `last ${shortDate(last)}` : 'never done';
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function start(w: PoolWorkout) {
    if (
      runSession.value &&
      !confirm('A workout is already in progress. Discard it and start this one instead?')
    ) {
      return;
    }
    const snapshot = chooseTodayWorkout(w.id);
    if (!snapshot) return;
    beginRunSession(state.value!, snapshot);
    location.route('/run');
  }

  function makeToday(w: PoolWorkout) {
    chooseTodayWorkout(w.id);
    location.route('/');
  }

  function openComposer() {
    setMode('compose');
  }

  function backToSearch(e: Event) {
    e.preventDefault();
    setMode('search');
  }

  // --- Composer ------------------------------------------------------------

  function onDateInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (!value) return;
    setDraft((prev) => ({
      ...prev,
      date: value,
      region: prev.regionTouched ? prev.region : regionForDraftDate(value),
    }));
  }

  function setRegion(r: BodyRegion) {
    setDraft((prev) => ({ ...prev, region: r, regionTouched: true }));
  }

  function setStyle(st: VasaStyle) {
    setDraft((prev) => ({ ...prev, style: prev.style === st ? undefined : st }));
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
        const movement: EnterDraftMovement = { movementId, sets: '', reps: '', seconds: '' };
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

  function patchMovement(
    blockIndex: number,
    movementId: string,
    field: 'sets' | 'reps' | 'seconds',
    value: string,
  ) {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        return {
          ...b,
          movements: b.movements.map((m) =>
            m.movementId === movementId ? { ...m, [field]: value } : m,
          ),
        };
      }),
    }));
  }

  /** Default region for a movement created from this block (SPEC 10.7 item 3). */
  function defaultRegionFor(blockIndex: number): BodyRegion {
    return draft.blocks[blockIndex].role === 'finisher' ? 'full' : draft.region;
  }

  async function saveWorkout(): Promise<PoolWorkout | null> {
    if (!draftHasAnyMovement(draft)) return null;
    const workout = buildEnteredWorkout(draftToWorkoutInput(draft, s.movements));
    await addPoolWorkout(workout);
    return workout;
  }

  async function saveAndStart() {
    const workout = await saveWorkout();
    if (!workout) return;
    const snapshot = chooseTodayWorkout(workout.id);
    if (!snapshot) return;
    beginRunSession(state.value!, snapshot);
    writeEnterDraft(null);
    location.route('/run');
  }

  async function saveToPool() {
    const workout = await saveWorkout();
    if (!workout) return;
    writeEnterDraft(null);
    location.route(`/pool/${workout.id}`);
  }

  function discard() {
    if (!confirm('Discard this workout?')) return;
    writeEnterDraft(null);
    setDraft(newEnterDraft(new Date()));
    setMode('search');
  }

  function renderMainAccessoryRow(blockIndex: number, movement: EnterDraftMovement) {
    const name = movementName(s, movement.movementId);
    return (
      <div class="row" key={movement.movementId}>
        <span class="list-row-title" style="flex:1;min-width:0">
          {name}
        </span>
        <a class="muted" href={`/movements/${movement.movementId}`}>
          edit
        </a>
        <input
          type="number"
          inputMode="numeric"
          placeholder="sets"
          style="flex:0 0 4.5rem;min-width:0"
          value={movement.sets}
          onInput={(e) =>
            patchMovement(
              blockIndex,
              movement.movementId,
              'sets',
              (e.target as HTMLInputElement).value,
            )
          }
        />
        <span class="muted">×</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          style="flex:0 0 4.5rem;min-width:0"
          value={movement.reps}
          onInput={(e) =>
            patchMovement(
              blockIndex,
              movement.movementId,
              'reps',
              (e.target as HTMLInputElement).value,
            )
          }
        />
        <button
          class="icon-btn"
          onClick={() => removeMovement(blockIndex, movement.movementId)}
          aria-label={`Remove ${name}`}
        >
          ×
        </button>
      </div>
    );
  }

  function renderFinisherRow(blockIndex: number, movement: EnterDraftMovement) {
    const name = movementName(s, movement.movementId);
    return (
      <div class="row" key={movement.movementId}>
        <span class="list-row-title" style="flex:1;min-width:0">
          {name}
        </span>
        <a class="muted" href={`/movements/${movement.movementId}`}>
          edit
        </a>
        <input
          type="number"
          inputMode="numeric"
          placeholder="seconds"
          style="flex:0 0 4.5rem;min-width:0"
          value={movement.seconds}
          onInput={(e) =>
            patchMovement(
              blockIndex,
              movement.movementId,
              'seconds',
              (e.target as HTMLInputElement).value,
            )
          }
        />
        <button
          class="icon-btn"
          onClick={() => removeMovement(blockIndex, movement.movementId)}
          aria-label={`Remove ${name}`}
        >
          ×
        </button>
      </div>
    );
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
    const trimmed = pickerQuery.trim();
    const pickerResults = searchMovements(candidates, pickerQuery, {
      region: draft.region,
      logs: s.logs,
      now: new Date(),
      limit: trimmed === '' ? 8 : 20,
    });
    const showCreate = trimmed !== '' && !hasExactName(s.movements, pickerQuery);

    const createRow = (
      <button class="list-row" key="create" onClick={() => setPickerMode('create')}>
        <span class="list-row-main list-row-title">Create &ldquo;{trimmed}&rdquo;</span>
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
          {showCreate && pickerResults.length === 0 && createRow}
          {pickerResults.map((m) => (
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
          {showCreate && pickerResults.length > 0 && createRow}
          {pickerResults.length === 0 && !showCreate && <div class="muted">No matches.</div>}
        </div>
        <button class="btn btn-ghost" onClick={closePicker}>
          Cancel
        </button>
      </div>
    );
  }

  // --- Render ---------------------------------------------------------------

  if (mode === 'search') {
    return (
      <div>
        <div class="top-bar">
          <h1 class="page-title">Enter a workout</h1>
        </div>
        <div class="stack">
          <input
            type="search"
            autoFocus
            placeholder="Search the pool…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <div class="list">
            {results.map((w) => (
              <div class="stack" key={w.id}>
                <button class="list-row" onClick={() => toggleExpanded(w.id)}>
                  <div class="list-row-main">
                    <div class="list-row-title">{w.name}</div>
                    <div class="list-row-sub">{summaryLine(w)}</div>
                    <div class="list-row-sub">{lastDoneLabel(w)}</div>
                  </div>
                </button>
                {expandedId === w.id && (
                  <div class="card stack">
                    <div class="stack">
                      {w.blocks.map((block, i) => (
                        <BlockSummary key={i} state={s} block={block} index={i} />
                      ))}
                    </div>
                    <div class="btn-row">
                      <button class="btn" onClick={() => makeToday(w)}>
                        Make it today&rsquo;s
                      </button>
                      <button class="btn btn-primary btn-big" onClick={() => start(w)}>
                        Start
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button class="btn btn-block" onClick={openComposer}>
            {trimmedQuery !== '' && results.length === 0
              ? 'Not here? Enter a new workout'
              : 'Enter a new workout'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="top-bar">
        <h1 class="page-title">Enter a workout</h1>
      </div>
      <div class="stack">
        <a class="btn btn-ghost" href="#" onClick={backToSearch}>
          ← Back to search
        </a>

        <div class="field">
          <label for="enter-name">Name</label>
          <input
            id="enter-name"
            type="text"
            placeholder={defaultWorkoutName(draft.region, draft.style, draft.date)}
            value={draft.name}
            onInput={(e) =>
              setDraft((prev) => ({ ...prev, name: (e.target as HTMLInputElement).value }))
            }
          />
        </div>

        <div class="field">
          <label for="enter-date">Date</label>
          <input id="enter-date" type="date" value={draft.date} onInput={onDateInput} />
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
          <label for="enter-notes">Notes</label>
          <textarea
            id="enter-notes"
            value={draft.notes}
            onInput={(e) =>
              setDraft((prev) => ({ ...prev, notes: (e.target as HTMLTextAreaElement).value }))
            }
          />
        </div>

        <button
          class="btn btn-primary btn-big btn-block"
          disabled={!draftHasAnyMovement(draft)}
          onClick={() => void saveAndStart()}
        >
          Save &amp; start
        </button>
        <button
          class="btn btn-block"
          disabled={!draftHasAnyMovement(draft)}
          onClick={() => void saveToPool()}
        >
          Save to pool
        </button>
        <button class="btn btn-ghost" onClick={discard}>
          Discard
        </button>
      </div>
    </div>
  );
}
