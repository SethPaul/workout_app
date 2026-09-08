/**
 * Pure geometry for the Movements-detail e1rm trend sparkline (SPEC 9.9):
 * an inline SVG polyline, no charting library. Kept separate from the
 * rendering component so the point-mapping math is unit-testable without a
 * DOM.
 */

export interface SparklineRange {
  min: number;
  max: number;
}

/** min/max of `values`, or null for an empty series. */
export function sparklineRange(values: number[]): SparklineRange | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Maps `values` (oldest first) onto a `points` string for an SVG
 * `<polyline>` sized `width` x `height`, inset by `padding` on every edge.
 * A single value renders as a flat midline; a flat series (min === max)
 * also renders as a flat midline rather than dividing by a zero span.
 */
export function sparklinePoints(values: number[], width: number, height: number, padding = 2): string {
  if (values.length === 0) return '';
  const midY = height / 2;
  if (values.length === 1) return `${padding},${midY} ${width - padding},${midY}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  return values
    .map((v, i) => {
      const x = padding + (innerW * i) / (values.length - 1);
      const t = span === 0 ? 0.5 : (v - min) / span;
      const y = padding + innerH * (1 - t);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
