import type { Movement, PoolWorkout, Settings } from '../../domain/types';
import type { ResultsDraft } from '../resultsDraft';

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
    (block) => block.format === 'strength' && block.movements.some((bm) => bm.movementId === movementId),
  );
}

/**
 * Per-movement sets (weight, reps, per-movement RPE), score, session RPE,
 * and notes — the results form shared by Run's "finished" screen and
 * EditLog. Renders exactly the markup Run used to render inline.
 */
export function ResultsForm(props: ResultsFormProps) {
  const { snapshot, draft, onChange, movements } = props;

  function patch(mutate: (next: ResultsDraft) => void) {
    const next = structuredClone(draft);
    mutate(next);
    onChange(next);
  }

  return (
    <div class="stack" style="padding-bottom:1rem">
      {draft.movements.map((m, mi) => {
        const mv = movements.find((x) => x.id === m.movementId);
        const loadable = mv ? mv.loadable : isStrengthBlockMovement(snapshot, m.movementId);
        return (
          <div class="card stack" key={m.movementId}>
            <div class="list-row-title">{mv?.name ?? m.movementId}</div>
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
            {loadable && (
              <div class="field">
                <label for={`rpe-${m.movementId}`}>RPE (1–10, optional)</label>
                <input
                  id={`rpe-${m.movementId}`}
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
