import { useLocation, useRoute } from 'preact-iso';
import { deleteLog, state } from '../../state/store';
import { logKind } from '../../domain/program/context';
import { BlockSummary } from '../components/BlockSummary';
import { movementName } from '../helpers';

const KIND_LABELS: Record<'adhoc' | 'max-test', string> = {
  adhoc: 'Logged',
  'max-test': 'Max test',
};

export function HistoryDetail() {
  const s = state.value!;
  const { params } = useRoute();
  const location = useLocation();
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
  const kind = logKind(log);
  const logId = log.id;

  async function handleDelete() {
    if (!confirm('Delete this log? This cannot be undone.')) return;
    await deleteLog(logId);
    location.route('/history', true);
  }

  return (
    <div>
      <div class="top-bar">
        <a class="icon-btn" href="/history" aria-label="Back">
          ←
        </a>
        <h1 class="page-title">{log.workoutSnapshot.name}</h1>
      </div>

      <div class="row" style="gap:0.5rem;margin-bottom:1rem">
        <a class="btn" href={`/history/${log.id}/edit`}>
          Edit
        </a>
        <button class="btn btn-danger" onClick={() => void handleDelete()}>
          Delete
        </button>
      </div>

      <div class="card stack" style="margin-bottom:1rem">
        <div class="row-between">
          <span class="muted">{new Date(log.finishedAt).toLocaleString()}</span>
          <div class="row" style="gap:0.4rem">
            {kind !== 'pool' && <span class="chip-kind">{KIND_LABELS[kind]}</span>}
            <span class={`chip chip-${log.workoutSnapshot.intensity}`}>{log.workoutSnapshot.intensity}</span>
          </div>
        </div>
        <div class="row" style="gap:1rem">
          <span>{durationMin} min</span>
          {log.score && <span>Score: {log.score}</span>}
          {log.rpe !== undefined && <span>RPE {log.rpe}</span>}
        </div>
        {log.notes && <div class="muted">{log.notes}</div>}
        {log.editedAt && <div class="muted" style="font-style:italic">Edited {new Date(log.editedAt).toLocaleString()}</div>}
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
