import { useMemo } from 'preact/hooks';
import { resolveSettings } from '../../domain/program/context';
import { acceptDeload, dismissFlags, startNewCycle, state } from '../../state/store';
import { Sparkline } from '../components/Sparkline';
import { fmtWeight } from '../helpers';
import {
  cycleSummary,
  deloadOverview,
  hasNoLogs,
  progressionRows,
  recentTrend,
  type ProgressionRow,
} from '../programOverview';
import type { ProgressionStatusValue } from '../../domain/program/progression';

const STATUS_LABELS: Record<ProgressionStatusValue, string> = {
  progress: 'Progress',
  hold: 'Hold',
  stall: 'Stall',
  unknown: 'Unknown',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ProgressionRowView({ row, units }: { row: ProgressionRow; units: 'lb' | 'kg' }) {
  return (
    <a class="list-row" href={`/movements/${row.movementId}`} key={row.movementId}>
      <div class="list-row-main">
        <div class="row" style="gap:0.4rem">
          <div class="list-row-title">{row.name}</div>
          <span class={`status-badge status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
        </div>
        <div class="list-row-sub">
          max {fmtWeight(row.currentMax, units)} · next {fmtWeight(row.nextLoad, units)}
          {row.lastSessionDate ? ` · last ${fmtDate(row.lastSessionDate)}` : ''}
        </div>
        {row.sparkValues.length > 1 && (
          <div style="max-width:160px;margin-top:0.35rem">
            <Sparkline values={row.sparkValues} unit={units} />
          </div>
        )}
      </div>
    </a>
  );
}

export function Program() {
  const s = state.value!;
  const now = new Date();
  const units = resolveSettings(s.settings).units;

  const cycle = useMemo(() => cycleSummary(s, now), [s]);
  const deload = useMemo(() => deloadOverview(s, now), [s]);
  const rows = useMemo(() => progressionRows(s, now), [s]);
  const trend = useMemo(() => recentTrend(s, now), [s]);
  const noLogs = hasNoLogs(s);

  function onStartNewCycle() {
    if (
      !confirm(
        'Start a new cycle now? This resets the current week count and clears any deload/dismissed flags.',
      )
    )
      return;
    void startNewCycle(now);
  }

  function onStartDeload() {
    void acceptDeload(now);
  }

  function onDismiss() {
    void dismissFlags(deload.activeFlags.map((f) => f.id));
  }

  return (
    <div>
      <h1 class="page-title">Program</h1>

      <div class="card stack" style="margin-bottom:1rem">
        <div class="section-title" style="margin-top:0">
          Cycle
        </div>
        <div class="row-between">
          <span class={`cycle-chip${cycle.onDeload ? ' deload' : ''}`}>
            {cycle.onDeload ? 'Deload week' : `Week ${cycle.week} of ${cycle.cycleWeeks}`}
          </span>
          {cycle.onDeload && cycle.deloadDaysRemaining !== null && (
            <span class="muted">
              {cycle.deloadDaysRemaining} day{cycle.deloadDaysRemaining === 1 ? '' : 's'} left
            </span>
          )}
        </div>
        <div class="stat-row">
          <span class="stat-label">Cycle started</span>
          <span class="stat-value">{fmtDate(cycle.cycleStartedAt)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Week type</span>
          <span class="stat-value">{cycle.kindLabel}</span>
        </div>
        <div class="muted">{cycle.kindDescription}</div>
        <button class="btn" onClick={onStartNewCycle}>
          Start new cycle
        </button>
      </div>

      <div class="card stack" style="margin-bottom:1rem">
        <div class="section-title" style="margin-top:0">
          Deload &amp; fatigue
        </div>
        {deload.suggested ? (
          <div class="muted">A deload is currently suggested.</div>
        ) : (
          <div class="muted">No deload suggested right now.</div>
        )}

        {deload.activeFlags.length === 0 ? (
          <div class="muted">No active fatigue flags.</div>
        ) : (
          <ul style="margin:0.4rem 0;padding-left:1.1rem">
            {deload.activeFlags.map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
        )}

        {deload.dismissedFlags.length > 0 && (
          <div class="muted">
            Dismissed this cycle: {deload.dismissedFlags.map((f) => f.text).join('; ')}
          </div>
        )}

        {deload.lastWorkout && (
          <div class="stack" style="border-top:1px solid var(--border);padding-top:0.6rem">
            <div class="section-title" style="margin-top:0">
              Last workout
            </div>
            <div class="stat-row">
              <span class="stat-label">{deload.lastWorkout.name}</span>
              <span class="stat-value">{fmtDate(deload.lastWorkout.date)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Session RPE</span>
              <span class="stat-value">{deload.lastWorkout.rpe ?? '—'}</span>
            </div>
            <div class="muted">
              {deload.lastWorkout.relatedFlagIds.length > 0
                ? `Contributed to: ${deload.activeFlags
                    .filter((f) => deload.lastWorkout!.relatedFlagIds.includes(f.id))
                    .map((f) => f.text)
                    .join('; ')}`
                : 'Did not contribute to any current flag.'}
            </div>
          </div>
        )}

        {deload.activeFlags.length > 0 && (
          <div class="btn-row">
            <button class="btn" onClick={onDismiss}>
              Dismiss
            </button>
            <button class="btn btn-primary" onClick={onStartDeload}>
              Start deload week
            </button>
          </div>
        )}
      </div>

      <div class="section-title">Progression by movement</div>
      {rows.length === 0 ? (
        <div class="empty-state">No strength sessions logged yet.</div>
      ) : (
        <div class="list" style="margin-bottom:1rem">
          {rows.map((row) => (
            <ProgressionRowView row={row} units={units} key={row.movementId} />
          ))}
        </div>
      )}

      <div class="section-title">Recent trend</div>
      {noLogs ? (
        <div class="empty-state">No workouts logged yet.</div>
      ) : (
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <thead>
              <tr>
                <th style="text-align:left;padding:0.3rem 0.4rem 0.3rem 0">Week</th>
                <th style="text-align:right;padding:0.3rem 0.4rem">Sessions</th>
                <th style="text-align:right;padding:0.3rem 0.4rem">Strength</th>
                <th style="text-align:right;padding:0.3rem 0 0.3rem 0.4rem">Avg RPE</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((w) => (
                <tr key={w.weeksAgo} style="border-top:1px solid var(--border)">
                  <td style="padding:0.3rem 0.4rem 0.3rem 0">
                    {w.weeksAgo === 0
                      ? 'This week'
                      : `${w.weeksAgo} week${w.weeksAgo === 1 ? '' : 's'} ago`}
                  </td>
                  <td style="text-align:right;padding:0.3rem 0.4rem">{w.sessionCount}</td>
                  <td style="text-align:right;padding:0.3rem 0.4rem">{w.strengthSessionCount}</td>
                  <td style="text-align:right;padding:0.3rem 0 0.3rem 0.4rem">
                    {w.avgRpe === null ? '—' : w.avgRpe.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
