import { describe, expect, it } from 'vitest';
import { withAllFuelCards } from '../../context/FuelDataContext';
import { INITIAL_FUEL_METRICS } from '../mockData';

describe('withAllFuelCards', () => {
  it('shows every purchase card when the saved list is empty', () => {
    expect(withAllFuelCards([]).map(m => m.id)).toEqual(INITIAL_FUEL_METRICS.map(m => m.id));
  });
  it('keeps saved values and adds only the missing cards', () => {
    const first = { ...INITIAL_FUEL_METRICS[0], priceIqd: 999 };
    const out = withAllFuelCards([first]);
    expect(out).toHaveLength(INITIAL_FUEL_METRICS.length);
    expect(out[0].priceIqd).toBe(999);
  });
});
