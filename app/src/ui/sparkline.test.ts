import { describe, it, expect } from 'vitest';
import { sparklinePoints, sparklineRange } from './sparkline';

describe('sparklineRange', () => {
  it('is null for an empty series', () => {
    expect(sparklineRange([])).toBeNull();
  });

  it('returns min/max of the series', () => {
    expect(sparklineRange([3, 1, 4, 1, 5])).toEqual({ min: 1, max: 5 });
  });
});

describe('sparklinePoints', () => {
  it('is empty for no values', () => {
    expect(sparklinePoints([], 100, 20)).toBe('');
  });

  it('renders a single value as a flat midline spanning the padded width', () => {
    expect(sparklinePoints([42], 100, 20, 2)).toBe('2,10 98,10');
  });

  it('renders a flat series (min === max) as a flat midline, not a divide-by-zero', () => {
    const points = sparklinePoints([50, 50, 50], 100, 20, 2);
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]));
    expect(ys.every((y) => y === 10)).toBe(true);
  });

  it('maps the minimum value to the bottom and the maximum to the top', () => {
    const points = sparklinePoints([0, 100], 100, 20, 0)
      .split(' ')
      .map((p) => p.split(',').map(Number));
    expect(points[0]).toEqual([0, 20]); // min -> bottom (y = height)
    expect(points[1]).toEqual([100, 0]); // max -> top (y = 0)
  });

  it('spaces x coordinates evenly across the series', () => {
    const points = sparklinePoints([1, 2, 3, 4], 90, 10, 0)
      .split(' ')
      .map((p) => Number(p.split(',')[0]));
    expect(points).toEqual([0, 30, 60, 90]);
  });

  it('produces one point per value', () => {
    const values = [10, 12, 9, 15, 20, 18, 22, 25, 24, 30, 28, 33];
    expect(sparklinePoints(values, 200, 40).split(' ')).toHaveLength(values.length);
  });
});
