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
  /** y of the horizontal reference (current max) line, or null when there is none. */
  referenceY: number | null;
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
 * day) sits in the middle. An optional `reference` value (the current max)
 * is included in the y domain so its line always lands inside the plot.
 */
export function trendLayout(
  sessions: TrendSession[],
  width: number,
  height: number,
  margin: TrendMargin,
  maxYTicks = 5,
  maxXTicks = 3,
  reference: number | null = null,
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
    referenceY: null,
  };
  if (sessions.length === 0) return empty;

  const hasReference = reference !== null && Number.isFinite(reference);
  const values = sessions.flatMap((s) => [s.e1rm, s.actual]);
  if (hasReference) values.push(reference);
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
    referenceY: hasReference ? yOf(reference) : null,
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

const COMFORTABLE_CLEARANCE = 6;

export interface LabelPlacement {
  x: number;
  y: number; // text baseline
  anchor: 'start' | 'end';
}

/** y of the polyline through `pts` at `x`, or null outside its x-range. */
function yAt(pts: { x: number; y: number }[], x: number): number | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) return Math.abs(pts[0].x - x) < 1e-6 ? pts[0].y : null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x >= a.x && x <= b.x) {
      return b.x === a.x ? Math.min(a.y, b.y) : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
  }
  return null;
}

/**
 * Where to put the reference line's text label (`labelWidth` x `labelHeight`
 * in viewBox units): one of the four corners just above/below the line at
 * the left or right end of the plot, whichever leaves the most clearance
 * from both series' lines and markers. Corners are tried right-above,
 * right-below, left-above, left-below; the first with comfortable clearance
 * wins so the label stays put unless the data is actually in the way.
 */
export function referenceLabelPlacement(
  layout: TrendLayout,
  labelWidth: number,
  labelHeight = 11,
  gap = 4,
): LabelPlacement | null {
  const refY = layout.referenceY;
  if (refY === null) return null;
  const series = [
    layout.points.map((p) => ({ x: p.x, y: p.yE1rm })),
    layout.points.map((p) => ({ x: p.x, y: p.yActual })),
  ];
  const markerPad = 5;

  const candidates: { placement: LabelPlacement; box: [number, number, number, number] }[] = [];
  for (const side of ['right', 'left'] as const) {
    for (const vert of ['above', 'below'] as const) {
      const x0 = side === 'right' ? layout.right - 2 - labelWidth : layout.left + 2;
      const yTop = vert === 'above' ? refY - gap - labelHeight : refY + gap;
      // Stay inside the plot (allowing a little of the top margin).
      if (yTop < layout.top - 8 || yTop + labelHeight > layout.bottom) continue;
      candidates.push({
        placement: {
          x: side === 'right' ? layout.right - 2 : layout.left + 2,
          // Baseline sits ~2 units above the box bottom for descenders.
          y: yTop + labelHeight - 2,
          anchor: side === 'right' ? 'end' : 'start',
        },
        box: [x0, yTop, x0 + labelWidth, yTop + labelHeight],
      });
    }
  }
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestClearance = -Infinity;
  for (const c of candidates) {
    const [x0, y0, x1, y1] = c.box;
    let clearance = Infinity;
    for (const pts of series) {
      // Markers (which extend past the line) and the line itself.
      for (const p of pts) {
        if (p.x >= x0 - markerPad && p.x <= x1 + markerPad) {
          clearance = Math.min(clearance, distanceOutside(p.y, y0 - markerPad, y1 + markerPad));
        }
      }
      for (let x = x0; x <= x1; x += 2) {
        const y = yAt(pts, x);
        if (y !== null) clearance = Math.min(clearance, distanceOutside(y, y0, y1));
      }
    }
    if (clearance >= COMFORTABLE_CLEARANCE) return c.placement;
    if (clearance > bestClearance) {
      best = c;
      bestClearance = clearance;
    }
  }
  return best.placement;
}

/** 0 when `v` is inside [lo, hi], else its distance to the nearest edge. */
function distanceOutside(v: number, lo: number, hi: number): number {
  return v < lo ? lo - v : v > hi ? v - hi : 0;
}
