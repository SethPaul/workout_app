import { describe, expect, it } from 'vitest';
import { nearestIndex, niceTicks, trendLayout, type TrendSession } from './trendChart';

const MARGIN = { top: 10, right: 10, bottom: 20, left: 40 };

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(183, 247, 5)).toEqual([180, 200, 220, 240, 260]);
  });

  it('never exceeds maxCount', () => {
    for (const [lo, hi] of [
      [0, 1],
      [97, 103],
      [12.5, 400],
      [135, 136],
    ]) {
      const ticks = niceTicks(lo, hi, 4);
      expect(ticks.length).toBeLessThanOrEqual(4);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks[0]).toBeLessThanOrEqual(lo);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(hi);
    }
  });

  it('widens a flat range instead of collapsing to one tick', () => {
    const ticks = niceTicks(225, 225, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThan(225);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(225);
  });

  it('returns no float noise', () => {
    expect(niceTicks(0.1, 0.35, 4)).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});

describe('trendLayout', () => {
  const sessions: TrendSession[] = [
    { date: '2024-01-01T00:00:00.000Z', e1rm: 200, actual: 180 },
    { date: '2024-01-03T00:00:00.000Z', e1rm: 210, actual: 185 },
    { date: '2024-01-11T00:00:00.000Z', e1rm: 225, actual: 200 },
  ];

  it('returns an empty layout for no sessions', () => {
    const layout = trendLayout([], 300, 150, MARGIN);
    expect(layout.points).toEqual([]);
    expect(layout.e1rmPath).toBe('');
  });

  it('puts both series on one axis spanning lowest actual to highest estimate', () => {
    const layout = trendLayout(sessions, 300, 150, MARGIN);
    const values = layout.yTicks.map((t) => t.value);
    expect(values[0]).toBeLessThanOrEqual(180);
    expect(values[values.length - 1]).toBeGreaterThanOrEqual(225);
    // Estimate sits above the actual load (smaller y) in every session.
    for (const p of layout.points) expect(p.yE1rm).toBeLessThan(p.yActual);
    // Ticks run bottom-to-top.
    expect(layout.yTicks[0].y).toBe(layout.bottom);
    expect(layout.yTicks[layout.yTicks.length - 1].y).toBe(layout.top);
  });

  it('spaces sessions by date, not by index', () => {
    const { points, left, right } = trendLayout(sessions, 300, 150, MARGIN);
    expect(points[0].x).toBe(left);
    expect(points[2].x).toBe(right);
    // Day 2 of a 10-day span: 20% of the way across.
    expect(points[1].x).toBeCloseTo(left + (right - left) * 0.2);
  });

  it('centres a single session', () => {
    const { points, left, right, xTicks } = trendLayout([sessions[0]], 300, 150, MARGIN);
    expect(points[0].x).toBe((left + right) / 2);
    expect(xTicks).toEqual([{ index: 0, x: (left + right) / 2 }]);
  });

  it('labels first and last sessions on the x-axis', () => {
    const { xTicks } = trendLayout(sessions, 300, 150, MARGIN, 5, 2);
    expect(xTicks.map((t) => t.index)).toEqual([0, 2]);
  });
});

describe('nearestIndex', () => {
  it('finds the closest point by x', () => {
    const pts = [0, 50, 100].map((x) => ({ x, yE1rm: 0, yActual: 0 }));
    expect(nearestIndex(pts, 60)).toBe(1);
    expect(nearestIndex(pts, 99)).toBe(2);
    expect(nearestIndex(pts, -5)).toBe(0);
  });
});
