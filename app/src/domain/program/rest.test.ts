import { describe, it, expect } from 'vitest';
import type { Movement } from '../types';
import { recommendedRestSec, restCategory } from './rest';

function mv(id: string, tags: string[], loadable = true): Movement {
  return { id, name: id, tags, equipment: [], cadenceDays: 3, unit: 'reps', loadable };
}

const hipThrust = mv('hip_thrust', ['compound', 'hinge', 'legs']);
const clean = mv('power_clean', ['olympic']);
const curl = mv('db_curl', ['pull', 'accessory']);
const weightedPlank = mv('weighted_plank', ['core']);
const pushup = mv('pushup', ['push', 'bodyweight'], false);

describe('restCategory', () => {
  it('sorts movements by how much recovery their sets need', () => {
    expect(restCategory(hipThrust)).toBe('heavy');
    expect(restCategory(clean)).toBe('heavy');
    expect(restCategory(curl)).toBe('accessory');
    expect(restCategory(mv('new_thing', []))).toBe('accessory');
    expect(restCategory(weightedPlank)).toBe('light');
    expect(restCategory(pushup)).toBe('light');
  });
});

describe('recommendedRestSec', () => {
  it('scales with RPE band, assuming RPE 8 when none was entered', () => {
    expect(recommendedRestSec([hipThrust], 7)).toBe(120);
    expect(recommendedRestSec([hipThrust], 8)).toBe(150);
    expect(recommendedRestSec([hipThrust], undefined)).toBe(150);
    expect(recommendedRestSec([hipThrust], 9)).toBe(180);
    expect(recommendedRestSec([curl], 7.5)).toBe(90);
    expect(recommendedRestSec([curl], 10)).toBe(120);
    expect(recommendedRestSec([pushup], 6)).toBe(30);
  });

  it('rests a superset for as long as its most demanding movement needs', () => {
    expect(recommendedRestSec([pushup, curl, hipThrust], 8)).toBe(150);
    expect(recommendedRestSec([pushup, curl], 9)).toBe(120);
  });
});
