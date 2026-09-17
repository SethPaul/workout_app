import type { Movement, PoolWorkout, Settings } from '../../domain/types';
import { formatBlockOutcome, type ResultsDraft } from '../resultsDraft';

export interface ResultsFormProps {
  /** The workout the results are for (used to infer a loadable default when the movement record is unavailable). */
  snapshot: PoolWorkout;
  draft: ResultsDraft;
  onChange: (next: ResultsDraft) => void;
  settings: Settings;
  movements: Movement[];
}

function isStrengthBlockMovement(snapshot: PoolWorkout, movementId: string): boolean {
  return snapshot.blocks.some(
    (block) =>
      block.format === 'strength' && block.movements.some((bm) => bm.movementId === movementId),
  );
}

/** The prescribed target RPE for a (block, movement) pair, for the RPE input's placeholder. */
function targetRpeFor(
  snapshot: PoolWorkout,
  blockIndex: number,
  movementId: string,
): number | undefined {
  return snapshot.blocks[blockIndex]?.movements.find((bm) => bm.movementId === movementId)
    ?.targetRpe;
}

/**
 * Per-movement sets (weight, reps, and — for strength movements — a per-set
 * RPE), score, session RPE, and notes — the results form shared by Run's
 * "finished" screen and EditLog. Renders exactly the markup Run used to
 * render inline.
 */
export function ResultsForm(props: ResultsFormProps) {
  const { snapshot, draft, onChange, movements } = props;

  function patch(mutate: (next: ResultsDraft) => void) {
    const next = structuredClone(draft);
    mutate(next);
    onChange(next);
  }

  const idCounts = new Map<string, number>();
  for (const m of draft.movements)
    idCounts.set(m.movementId, (idCounts.get(m.movementId) ?? 0) + 1);

  return (
    <div class="stack" style="padding-bottom:1rem">
      {draft.movements.map((m, mi) => {
        const mv = movements.find((x) => x.id === m.movementId);
        const loadable = mv ? mv.loadable : isStrengthBlockMovement(snapshot, m.movementId);
        const block = snapshot.blocks[m.blockIndex];
        const showBlockSubtitle = (idCounts.get(m.movementId) ?? 0) > 1;
        return (
          <div class="card stack" key={`${m.blockIndex}-${m.movementId}`}>
            <div class="list-row-title">{mv?.name ?? m.movementId}</div>
            {showBlockSubtitle && (
              <div class="muted" style="font-size:0.8rem;margin-top:-0.4rem">
                {block?.title || `Block ${m.blockIndex + 1}`}
              </div>
            )}
            {m.sets ? (
              <div class="stack">
                {m.sets.map((set, si) => (
                  <div class="row" key={si}>
                    <span class="muted" style="width:3.5rem">
                      Set {si + 1}
                    </span>
                    {loadable && (
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="lb/kg"
                        value={set.weight}
                        onInput={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          patch((next) => {
                            next.movements[mi].sets![si].weight = v;
                          });
                        }}
                      />
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={set.reps}
                      onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        patch((next) => {
                          next.movements[mi].sets![si].reps = v;
                        });
                      }}
                    />
                    {loadable && (
                      <input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        max="10"
                        step="0.5"
                        placeholder={`target ${targetRpeFor(snapshot, m.blockIndex, m.movementId) ?? 8}`}
                        value={set.rpe}
                        onInput={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          patch((next) => {
                            next.movements[mi].sets![si].rpe = v;
                          });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div class="row">
                {loadable && (
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="weight"
                    value={m.weight}
                    onInput={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      patch((next) => {
                        next.movements[mi].weight = v;
                      });
                    }}
                  />
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps (optional)"
                  value={m.reps}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    patch((next) => {
                      next.movements[mi].reps = v;
                    });
                  }}
                />
              </div>
            )}
            {loadable && !m.sets && (
              <div class="field">
                <label for={`rpe-${m.blockIndex}-${m.movementId}`}>RPE (1–10, optional)</label>
                <input
                  id={`rpe-${m.blockIndex}-${m.movementId}`}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="10"
                  step="0.5"
                  placeholder="hardest set"
                  value={m.rpe}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    patch((next) => {
                      next.movements[mi].rpe = v;
                    });
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {(() => {
        const captured = draft.blockOutcomes
          .map((outcome) => {
            const block = snapshot.blocks[outcome.blockIndex];
            if (!block) return null;
            const text = formatBlockOutcome(outcome, block);
            if (!text) return null;
            return {
              blockIndex: outcome.blockIndex,
              title: block.title || `Block ${outcome.blockIndex + 1}`,
              text,
            };
          })
          .filter((c): c is { blockIndex: number; title: string; text: string } => c !== null);
        if (captured.length === 0) return null;
        return (
          <div class="muted" style="font-size:0.85rem">
            Captured:
            {captured.map((c) => (
              <div key={c.blockIndex}>
                {c.title} — {c.text}
              </div>
            ))}
          </div>
        );
      })()}

      <div class="field">
        <label for="score">Score</label>
        <input
          id="score"
          type="text"
          placeholder='e.g. "7 rounds + 3" or "12:34"'
          value={draft.score}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            patch((next) => {
              next.score = v;
              next.scoreAuto = false;
            });
          }}
        />
      </div>

      <div class="field">
        <label for="rpe">RPE (1–10)</label>
        <input
          id="rpe"
          type="number"
          min="1"
          max="10"
          value={draft.rpe}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            patch((next) => {
              next.rpe = v;
            });
          }}
        />
      </div>

      <div class="field">
        <label for="notes">Notes</label>
        <textarea
          id="notes"
          value={draft.notes}
          onInput={(e) => {
            const v = (e.target as HTMLTextAreaElement).value;
            patch((next) => {
              next.notes = v;
            });
          }}
        />
      </div>
    </div>
  );
}
