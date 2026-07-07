import { describe, expect, test } from 'vitest';
import {
  americanToDecimalOdds,
  calculateParlayFairValue,
  calculateParlayProbability,
  combineAmericanOdds,
  decimalToAmericanOdds,
} from '../src';

describe('parlay math', () => {
  test('converts American odds to decimal odds', () => {
    expect(americanToDecimalOdds(-110)).toBe(1.909091);
    expect(americanToDecimalOdds(150)).toBe(2.5);
    expect(americanToDecimalOdds(100)).toBe(2);
    expect(americanToDecimalOdds(-100)).toBe(2);
    expect(americanToDecimalOdds(-200)).toBe(1.5);
    expect(() => americanToDecimalOdds(0)).toThrow(TypeError);
    expect(() => americanToDecimalOdds(0)).toThrow('odds cannot be 0');
    expect(() => americanToDecimalOdds(Number.NaN)).toThrow('americanOdds must be a finite number');
  });

  test('converts decimal odds back to American odds', () => {
    expect(decimalToAmericanOdds(2.5)).toBe(150);
    expect(decimalToAmericanOdds(2)).toBe(100);
    expect(decimalToAmericanOdds(1.909091)).toBe(-110);
    expect(decimalToAmericanOdds(1.5)).toBe(-200);
    expect(decimalToAmericanOdds(3)).toBe(200);
    expect(() => decimalToAmericanOdds(1)).toThrow(TypeError);
    expect(() => decimalToAmericanOdds(1)).toThrow('decimal odds must be greater than 1');
    expect(() => decimalToAmericanOdds(0.8)).toThrow(TypeError);
    expect(() => decimalToAmericanOdds(Number.POSITIVE_INFINITY)).toThrow(
      'decimalOdds must be a finite number',
    );
  });

  test('round-trips American -> decimal -> American', () => {
    for (const odds of [-350, -110, -105, 100, 120, 264, 900]) {
      expect(decimalToAmericanOdds(americanToDecimalOdds(odds))).toBe(odds);
    }
  });

  test('combines American odds via decimal-odds product', () => {
    // 1.909091 * 1.909091 = 3.644628... -> +264 (the classic two-leg -110 parlay)
    expect(combineAmericanOdds([-110, -110])).toBe(264);
    // 2.5 * 1.5 = 3.75 -> +275
    expect(combineAmericanOdds([150, -200])).toBe(275);
    // single leg passes through
    expect(combineAmericanOdds([100])).toBe(100);
    expect(combineAmericanOdds([-110])).toBe(-110);
    // three legs of +100 -> decimal 8 -> +700
    expect(combineAmericanOdds([100, 100, 100])).toBe(700);
    expect(() => combineAmericanOdds([])).toThrow(TypeError);
    expect(() => combineAmericanOdds([])).toThrow('at least one leg is required');
    expect(() => combineAmericanOdds([-110, 0])).toThrow('odds cannot be 0');
  });

  test('multiplies independent leg probabilities', () => {
    expect(calculateParlayProbability([0.5, 0.5])).toBe(0.25);
    expect(calculateParlayProbability([0.6])).toBe(0.6);
    expect(calculateParlayProbability([0.52381, 0.52381])).toBeCloseTo(0.274377, 6);
    expect(() => calculateParlayProbability([])).toThrow(TypeError);
    expect(() => calculateParlayProbability([])).toThrow('at least one leg is required');
    expect(() => calculateParlayProbability([0.5, 1.2])).toThrow(
      'probabilities[1] must be between 0 and 1',
    );
    expect(() => calculateParlayProbability([1])).toThrow(TypeError);
  });

  test('computes no-vig parlay fair value and edge vs offered combined odds', () => {
    const twoLeg = calculateParlayFairValue({
      legs: [
        { selected: -110, opposite: -110 },
        { selected: -110, opposite: -110 },
      ],
    });

    // Each -110/-110 leg is a fair coin flip -> combined fair 25% -> +300 fair.
    expect(twoLeg.legFairProbabilities).toEqual([0.5, 0.5]);
    expect(twoLeg.fairProbability).toBe(0.25);
    expect(twoLeg.fairAmericanOdds).toBe(300);
    expect(twoLeg.offeredAmericanOdds).toBe(264);
    // implied(+264) = 100/364 = 0.274725 -> (0.25 - 0.274725) * 100 = -2.47
    expect(twoLeg.edgePercent).toBeCloseTo(-2.47, 2);

    // A single leg matches calculateNoVigFairLine for the same market.
    const singleLeg = calculateParlayFairValue({
      legs: [{ selected: 120, opposite: -130 }],
    });
    expect(singleLeg.fairProbability).toBeCloseTo(0.445736, 6);
    expect(singleLeg.fairAmericanOdds).toBe(124);
    expect(singleLeg.offeredAmericanOdds).toBe(120);
    expect(singleLeg.edgePercent).toBeCloseTo(-0.88, 2);

    expect(() => calculateParlayFairValue({ legs: [] })).toThrow(TypeError);
    expect(() => calculateParlayFairValue({ legs: [] })).toThrow('at least one leg is required');
  });
});
