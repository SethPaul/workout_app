import { useRoute } from 'preact-iso';
import { state } from '../../state/store';
import { BlockSummary } from '../components/BlockSummary';
import { movementName } from '../helpers';

export function HistoryDetail() {
  const s = state.value!;
  const { params } = useRoute();
  const log = s.logs.find((l) => l.id === params.id);

  if (!log) {
    return (
      <div class="empty-state">
        <p>Log not found.</p>
        <a href="/history">Back to History</a>
      </div>
    );
  }

  const durationMin = Math.max(
    0,
    Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 60000),
  );

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/history" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">{log.workoutSnapshot.name}</h1>
      </div>

      <div class="card stack" style="margin-bottom:1rem">
        <div class="row-between">
          <span class="muted">{new Date(log.finishedAt).toLocaleString()}</span>
          <span class={`chip chip-${log.workoutSnapshot.intensity}`}>{log.workoutSnapshot.intensity}</span>
        </div>
        <div class="row" style="gap:1rem">
          <span>{durationMin} min</span>
          {log.score && <span>Score: {log.score}</span>}
          {log.rpe !== undefined && <span>RPE {log.rpe}</span>}
        </div>
        {log.notes && <div class="muted">{log.notes}</div>}
      </div>

      <div class="section-title">Results</div>
      <div class="stack" style="margin-bottom:1rem">
        {log.results.map((r, i) => (
          <div class="card" key={i}>
            <div class="list-row-title">{movementName(s, r.movementId)}</div>
            {r.sets ? (
              <div class="muted">
                {r.sets
                  .map((set, si) => `Set ${si + 1}: ${set.weight ?? '–'}${set.weight !== undefined ? ' × ' : ' '}${set.reps ?? '–'} reps`)
                  .join(' · ')}
              </div>
            ) : (
              <div class="muted">
                {r.weight !== undefined ? `${r.weight} × ` : ''}
                {r.reps !== undefined ? `${r.reps} reps` : ''}
              </div>
            )}
            {r.notes && <div class="muted">{r.notes}</div>}
          </div>
        ))}
        {log.results.length === 0 && <div class="muted">No results recorded.</div>}
      </div>

      <div class="section-title">Workout</div>
      <div class="stack">
        {log.workoutSnapshot.blocks.map((block, i) => (
          <BlockSummary key={i} state={s} block={block} index={i} />
        ))}
      </div>
    </div>
  );
}
