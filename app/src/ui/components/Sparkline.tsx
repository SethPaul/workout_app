import { sparklinePoints, sparklineRange } from '../sparkline';

const WIDTH = 260;
const HEIGHT = 56;
const PADDING = 4;

/**
 * Inline SVG e1rm trend sparkline (SPEC 9.9): a simple polyline over the
 * last N sessions, with min/max labels, no charting library. Stroke color
 * comes from a CSS variable so it follows the page's light/dark theme.
 */
export function Sparkline({ values, unit }: { values: number[]; unit: string }) {
  if (values.length === 0) {
    return <div class="muted">Not enough history yet for a trend.</div>;
  }

  const range = sparklineRange(values)!;
  const points = sparklinePoints(values, WIDTH, HEIGHT, PADDING);

  return (
    <div class="sparkline">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none" role="img" aria-label="Estimated 1RM trend">
        <polyline points={points} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      <div class="sparkline-labels row-between">
        <span class="muted">
          min {Math.round(range.min)} {unit}
        </span>
        <span class="muted">
          max {Math.round(range.max)} {unit}
        </span>
      </div>
    </div>
  );
}
