import type { AppState, Block } from '../../domain/types';
import { movementName } from '../helpers';
import type { ResultsDraft } from '../resultsDraft';

function findEntryIndex(draft: ResultsDraft, blockIndex: number, movementId: string): number {
  return draft.movements.findIndex(
    (m) => m.blockIndex === blockIndex && m.movementId === movementId,
  );
}

function patchDraft(
  draft: ResultsDraft,
  onChange: (next: ResultsDraft) => void,
  mutate: (next: ResultsDraft) => void,
): void {
  const next = structuredClone(draft);
  mutate(next);
  onChange(next);
}

export interface SetEntryProps {
  appState: AppState;
  block: Block;
  blockIndex: number;
  /** 1-based: the set currently in progress (work phase) or just completed (rest phase). */
  currentSet: number;
  draft: ResultsDraft;
  onChange: (next: ResultsDraft) => void;
}

/**
 * Inline mid-set entry for a running strength block (SPEC: log weights/reps
 * as you go, not only at the end): one compact row per loadable movement in
 * the block, bound to the current set's weight/reps/RPE — each set keeps its
 * own RPE value — prefilled with the target RPE as a placeholder. Rendered during
 * both the work phase (the set about to happen) and the rest phase that
 * follows it (the set just finished), so the numbers just lifted stay
 * editable through the rest period.
 */
export function SetEntry({
  appState,
  block,
  blockIndex,
  currentSet,
  draft,
  onChange,
}: SetEntryProps) {
  const loadableMovements = block.movements.filter(
    (bm) => appState.movements.find((m) => m.id === bm.movementId)?.loadable,
  );
  if (loadableMovements.length === 0) return null;

  return (
    <div class="set-entry stack">
      {loadableMovements.map((bm) => {
        const entryIndex = findEntryIndex(draft, blockIndex, bm.movementId);
        if (entryIndex < 0) return null;
        const entry = draft.movements[entryIndex];
        const setIdx = currentSet - 1;
        const set = entry.sets?.[setIdx];
        if (!set) return null;
        return (
          <div class="set-entry-row" key={bm.movementId}>
            <span class="set-entry-label">
              {movementName(appState, bm.movementId)} · Set {currentSet}
            </span>
            <div class="row">
              <input
                type="number"
                inputMode="decimal"
                placeholder="weight"
                value={set.weight}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  patchDraft(draft, onChange, (next) => {
                    next.movements[entryIndex].sets![setIdx].weight = v;
                  });
                }}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={set.reps}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  patchDraft(draft, onChange, (next) => {
                    next.movements[entryIndex].sets![setIdx].reps = v;
                  });
                }}
              />
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="10"
                step="0.5"
                placeholder={`target ${bm.targetRpe ?? 8}`}
                value={set.rpe}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  patchDraft(draft, onChange, (next) => {
                    next.movements[entryIndex].sets![setIdx].rpe = v;
                  });
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface BlockLogDetailsProps {
  appState: AppState;
  block: Block;
  blockIndex: number;
  draft: ResultsDraft;
  onChange: (next: ResultsDraft) => void;
}

/**
 * Collapsed-by-default "Log this block" entry for a running non-strength
 * block (emom/amrap/etc.): weight (loadable movements only) + reps per
 * movement, bound to the same draft the finished screen prefills from.
 */
export function BlockLogDetails({
  appState,
  block,
  blockIndex,
  draft,
  onChange,
}: BlockLogDetailsProps) {
  const entries = block.movements
    .map((bm) => ({ bm, index: findEntryIndex(draft, blockIndex, bm.movementId) }))
    .filter((e) => e.index >= 0);
  if (entries.length === 0) return null;

  return (
    <details class="log-block-details">
      <summary>Log this block</summary>
      <div class="stack">
        {entries.map(({ bm, index }) => {
          const entry = draft.movements[index];
          const loadable =
            appState.movements.find((m) => m.id === bm.movementId)?.loadable ?? false;
          return (
            <div class="set-entry-row" key={bm.movementId}>
              <span class="set-entry-label">{movementName(appState, bm.movementId)}</span>
              <div class="row">
                {loadable && (
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="weight"
                    value={entry.weight}
                    onInput={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      patchDraft(draft, onChange, (next) => {
                        next.movements[index].weight = v;
                      });
                    }}
                  />
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={entry.reps}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    patchDraft(draft, onChange, (next) => {
                      next.movements[index].reps = v;
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
