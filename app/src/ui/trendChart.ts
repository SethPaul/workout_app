/**
 * Pure geometry for the strength trend chart (SPEC 9.9): estimated 1RM and
 * the heaviest weight actually lifted, per session, on one shared weight
 * axis with a date x-axis. Inline SVG, no charting library — kept separate
 * from the rendering component so the scale and tick math is unit-testable
 * without a DOM.
 */

export interface TrendSession {
  date: string; // ISO
  e1rm: number;
  actual: number; // heaviest weight lifted that session
}

export interface TrendMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TrendPoint {
  x: number;
  yE1rm: number;
  yActual: number;
}

export interface TrendLayout {
  /** Plot-area edges in viewBox coordinates. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  yTicks: { value: number; y: number }[];
  /** Indices into `sessions` worth labelling on the x-axis, with their x. */
  xTicks: { index: number; x: number }[];
  points: TrendPoint[];
  e1rmPath: string;
  actualPath: string;
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Round, evenly spaced axis ticks covering [min, max], at most `maxCount`
 * of them (and at least 2). The first tick is <= min and the last >= max,
 * so the ticks double as the axis domain. A zero-width range is widened so
 * a flat series still gets a readable axis.
 */
export function niceTicks(min: number, max: number, maxCount = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max < min) [min, max] = [max, min];
  if (max === min) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    min -= pad;
    max += pad;
  }
  const count = Math.max(2, maxCount);
  const rawStep = (max - min) / (count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  for (const mult of NICE_STEPS) {
    const step = mult * magnitude;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const n = Math.round((hi - lo) / step) + 1;
    if (n <= count) {
      return Array.from({ length: n }, (_, i) => roundTo(lo + i * step, step));
    }
  }
  // Unreachable: the 10x step always fits, but keep a sane fallback.
  return [min, max];
}

/** Strip float noise (e.g. 0.30000000000000004) relative to the step size. */
function roundTo(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(decimals));
}

/**
 * Lays out `sessions` (oldest first) in a `width` x `height` viewBox. Both
 * series share one weight axis (never a dual axis) spanning the lowest
 * actual load to the highest estimate. X is positioned by date, so gaps
 * between sessions read as gaps in time; a single session (or all on one
 * day) sits in the middle.
 */
export function trendLayout(
  sessions: TrendSession[],
  width: number,
  height: number,
  margin: TrendMargin,
  maxYTicks = 5,
  maxXTicks = 3,
): TrendLayout {
  const left = margin.left;
  const right = width - margin.right;
  const top = margin.top;
  const bottom = height - margin.bottom;
  const empty: TrendLayout = {
    left,
    right,
    top,
    bottom,
    yTicks: [],
    xTicks: [],
    points: [],
    e1rmPath: '',
    actualPath: '',
  };
  if (sessions.length === 0) return empty;

  const values = sessions.flatMap((s) => [s.e1rm, s.actual]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), maxYTicks);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const yOf = (v: number) => bottom - ((v - yMin) / (yMax - yMin)) * (bottom - top);

  const times = sessions.map((s) => Date.parse(s.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const xOf = (t: number) =>
    tMax === tMin ? (left + right) / 2 : left + ((t - tMin) / (tMax - tMin)) * (right - left);

  const points = sessions.map((s, i) => ({
    x: xOf(times[i]),
    yE1rm: yOf(s.e1rm),
    yActual: yOf(s.actual),
  }));

  return {
    left,
    right,
    top,
    bottom,
    yTicks: ticks.map((value) => ({ value, y: yOf(value) })),
    xTicks: pickXTicks(points, maxXTicks),
    points,
    e1rmPath: pathOf(points.map((p) => [p.x, p.yE1rm])),
    actualPath: pathOf(points.map((p) => [p.x, p.yActual])),
  };
}

/** First, last, and evenly spread sessions in between — at most `max`. */
function pickXTicks(points: TrendPoint[], max: number): { index: number; x: number }[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1 || max <= 1) return [{ index: 0, x: points[0].x }];
  const count = Math.min(n, Math.max(2, max));
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) indices.add(Math.round((i * (n - 1)) / (count - 1)));
  return [...indices].map((index) => ({ index, x: points[index].x }));
}

function pathOf(coords: [number, number][]): string {
  return coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

/** Index of the point whose x is nearest `x` (for the hover/tap readout). */
export function nearestIndex(points: TrendPoint[], x: number): number {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
  }
  return best;
}
