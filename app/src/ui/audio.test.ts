import { describe, it, expect } from 'vitest';
import { getVolume, setVolume } from './audio';

describe('setVolume/getVolume', () => {
  it('defaults to 1', () => {
    expect(getVolume()).toBe(1);
  });

  it('stores an in-range value', () => {
    setVolume(0.4);
    expect(getVolume()).toBe(0.4);
  });

  it('clamps values above 1', () => {
    setVolume(1.5);
    expect(getVolume()).toBe(1);
  });

  it('clamps values below 0', () => {
    setVolume(-0.2);
    expect(getVolume()).toBe(0);
  });

  it('clamps exactly at the bounds', () => {
    setVolume(0);
    expect(getVolume()).toBe(0);
    setVolume(1);
    expect(getVolume()).toBe(1);
  });
});
