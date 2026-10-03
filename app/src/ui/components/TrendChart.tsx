import { useState } from 'preact/hooks';
import type { E1rmPoint } from '../../domain/program/e1rm';
import { nearestIndex, trendLayout, type TrendMargin } from '../trendChart';

type Units = 'lb' | 'kg';

const FULL = { width: 340, height: 210, margin: { top: 22, right: 12, bottom: 24, left: 40 } };
const COMPACT = { width: 220, height: 84, margin: { top: 6, right: 6, bottom: 16, left: 30 } };

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const round = (v: number) => Math.round(v);

/**
 * Legend for the strength trend chart. Each series has its own marker shape
 * and line style, so identity never relies on color alone. Exported so the
 * Program page can show it once above a list of compact charts.
 */
export function TrendLegend() {
  return (
    <div class="trend-legend">
      <span class="trend-legend-item">
        <svg width="22" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="21" y2="5" class="trend-line-e1rm" />
          <circle cx="11" cy="5" r="3.5" class="trend-dot-e1rm" />
        </svg>
        Estimated 1RM
      </span>
      <span class="trend-legend-item">
        <svg width="22" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="21" y2="5" class="trend-line-actual" />
          <rect x="7.5" y="1.5" width="7" height="7" class="trend-dot-actual" />
        </svg>
        Heaviest set lifted
      </span>
      <span class="trend-legend-item">
        <svg width="12" height="12" aria-hidden="true">
          <path d="M6,1 L11,6 L6,11 L1,6 Z" class="trend-dot-tested" />
        </svg>
        Tested max
      </span>
    </div>
  );
}

function Marks({
  history,
  layout,
  compact,
}: {
  history: E1rmPoint[];
  layout: ReturnType<typeof trendLayout>;
  compact: boolean;
}) {
  const r = compact ? 2.5 : 4;
  return (
    <>
      <path d={layout.actualPath} class="trend-line-actual" fill="none" />
      <path d={layout.e1rmPath} class="trend-line-e1rm" fill="none" />
      {layout.points.map((p, i) => (
        <rect
          key={`a${i}`}
          x={p.x - r}
          y={p.yActual - r}
          width={r * 2}
          height={r * 2}
          class="trend-dot-actual"
        />
      ))}
      {layout.points.map((p, i) =>
        history[i].source === 'max-test' ? (
          <path
            key={`e${i}`}
            d={`M${p.x},${p.yE1rm - r * 1.5} L${p.x + r * 1.5},${p.yE1rm} L${p.x},${p.yE1rm + r * 1.5} L${p.x - r * 1.5},${p.yE1rm} Z`}
            class="trend-dot-tested"
          />
        ) : (
          <circle key={`e${i}`} cx={p.x} cy={p.yE1rm} r={r} class="trend-dot-e1rm" />
        ),
      )}
    </>
  );
}

function Axes({
  history,
  layout,
  units,
  compact,
}: {
  history: E1rmPoint[];
  layout: ReturnType<typeof trendLayout>;
  units: Units;
  compact: boolean;
}) {
  const last = layout.xTicks.length - 1;
  return (
    <>
      {layout.yTicks.map((t) => (
        <g key={t.value}>
          <line x1={layout.left} x2={layout.right} y1={t.y} y2={t.y} class="trend-grid" />
          <text x={layout.left - 5} y={t.y} class="trend-axis-label" text-anchor="end" dy="0.32em">
            {round(t.value)}
          </text>
        </g>
      ))}
      {!compact && (
        <text x={layout.left - 5} y={layout.top - 12} class="trend-axis-label" text-anchor="end">
          {units}
        </text>
      )}
      {layout.xTicks.map((t, i) => (
        <text
          key={t.index}
          x={t.x}
          y={layout.bottom + (compact ? 12 : 16)}
          class="trend-axis-label"
          // Keep the end labels inside the plot instead of clipping.
          text-anchor={
            layout.xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === last ? 'end' : 'middle'
          }
        >
          {fmtShortDate(history[t.index].date)}
        </text>
      ))}
    </>
  );
}

function Readout({ point, units }: { point: E1rmPoint; units: Units }) {
  const tested = point.source === 'max-test';
  return (
    <div class="trend-readout" aria-live="polite">
      <div class="trend-readout-date">{fmtLongDate(point.date)}</div>
      <div class="trend-readout-row">
        <span>{tested ? 'Tested max' : 'Estimated 1RM'}</span>
        <span>
          <strong>
            {round(point.e1rm)} {units}
          </strong>{' '}
          <span class="muted">
            {tested
              ? `(${point.bestSet.weight} × ${point.bestSet.reps})`
              : `from ${point.bestSet.weight} × ${point.bestSet.reps}`}
          </span>
        </span>
      </div>
      <div class="trend-readout-row">
        <span>Heaviest set lifted</span>
        <span>
          <strong>
            {point.heaviestSet.weight} {units}
          </strong>{' '}
          <span class="muted">× {point.heaviestSet.reps}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Strength trend chart (SPEC 9.9): per session, the estimated 1RM (Epley,
 * from the session's best set) and the heaviest weight actually lifted, on
 * one labelled weight axis with dates along the bottom. Tested maxes are
 * marked with a diamond. The full variant has a legend, a tap/hover/arrow-key
 * readout of the selected session, and a data table; the compact variant
 * (Program rows) is a static mini chart with min/max ticks and end dates.
 */
export function TrendChart({
  history,
  units,
  compact = false,
}: {
  history: E1rmPoint[];
  units: Units;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (history.length === 0) {
    return <div class="muted">Not enough history yet for a trend.</div>;
  }

  const dims = compact ? COMPACT : FULL;
  const margin: TrendMargin = dims.margin;
  const layout = trendLayout(
    history.map((p) => ({ date: p.date, e1rm: p.e1rm, actual: p.heaviestSet.weight })),
    dims.width,
    dims.height,
    margin,
    compact ? 3 : 5,
    compact ? 2 : 3,
  );

  const latest = history[history.length - 1];
  const label = `Strength trend over ${history.length} session${history.length === 1 ? '' : 's'}: latest estimated 1RM ${round(latest.e1rm)} ${units}, heaviest set ${latest.heaviestSet.weight} ${units}.`;

  if (compact) {
    return (
      <svg
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        width="100%"
        class="trend-chart"
        role="img"
        aria-label={label}
      >
        <Axes history={history} layout={layout} units={units} compact />
        <Marks history={history} layout={layout} compact />
      </svg>
    );
  }

  const active = selected ?? history.length - 1;
  const activePoint = layout.points[active];

  function selectAt(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((clientX - rect.left) / rect.width) * dims.width;
    setSelected(nearestIndex(layout.points, x));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') setSelected(Math.max(0, active - 1));
    else if (e.key === 'ArrowRight') setSelected(Math.min(history.length - 1, active + 1));
    else return;
    e.preventDefault();
  }

  return (
    <div class="trend">
      <TrendLegend />
      <svg
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        width="100%"
        class="trend-chart trend-chart-interactive"
        role="img"
        aria-label={`${label} Use the left and right arrow keys to step through sessions.`}
        tabIndex={0}
        onPointerDown={(e) => selectAt(e.clientX, e.currentTarget)}
        onPointerMove={(e) => selectAt(e.clientX, e.currentTarget)}
        onKeyDown={onKeyDown}
      >
        <Axes history={history} layout={layout} units={units} compact={false} />
        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={layout.top}
          y2={layout.bottom}
          class="trend-crosshair"
        />
        <Marks history={history} layout={layout} compact={false} />
        {/* Halo the selected session's marks so the readout below maps back to them. */}
        <circle cx={activePoint.x} cy={activePoint.yE1rm} r={7} class="trend-halo" />
        <circle cx={activePoint.x} cy={activePoint.yActual} r={7} class="trend-halo" />
      </svg>
      <Readout point={history[active]} units={units} />
      <details class="trend-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Est. 1RM</th>
              <th>Heaviest set</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((p) => (
              <tr key={p.date}>
                <td>{fmtShortDate(p.date)}</td>
                <td>
                  {round(p.e1rm)}
                  {p.source === 'max-test' ? ' (tested)' : ''}
                </td>
                <td>
                  {p.heaviestSet.weight} × {p.heaviestSet.reps}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
