import { describe, expect, test } from 'vitest';
import { calculateClosingLineValue, calculateExpectedValue, calculateKellyStake } from '../src';

describe('value and staking', () => {
  test('computes expected value and expected ROI', () => {
    // +100 at 55%: EV = 0.55 * 100 - 0.45 * 100 = +10
    expect(calculateExpectedValue({ stake: 100, americanOdds: 100, winProbability: 0.55 })).toEqual(
      { expectedValue: 10, expectedRoiPercent: 10 },
    );

    // -110 at a coin flip: EV = 0.5 * 100 - 0.5 * 110 = -5
    expect(calculateExpectedValue({ stake: 110, americanOdds: -110, winProbability: 0.5 })).toEqual(
      { expectedValue: -5, expectedRoiPercent: -4.55 },
    );

    expect(() =>
      calculateExpectedValue({ stake: 0, americanOdds: 100, winProbability: 0.5 }),
    ).toThrow(TypeError);
    expect(() =>
      calculateExpectedValue({ stake: 0, americanOdds: 100, winProbability: 0.5 }),
    ).toThrow('stake must be a positive number');
    expect(() =>
      calculateExpectedValue({ stake: -5, americanOdds: 100, winProbability: 0.5 }),
    ).toThrow('stake must be a positive number');
    expect(() =>
      calculateExpectedValue({ stake: 100, americanOdds: 100, winProbability: 1 }),
    ).toThrow('winProbability must be between 0 and 1');
    expect(() =>
      calculateExpectedValue({ stake: 100, americanOdds: 0, winProbability: 0.5 }),
    ).toThrow('odds cannot be 0');
  });

  test('computes Kelly staking with quarter-Kelly default', () => {
    // +100 at 55%: b = 1, full Kelly = (0.55 - 0.45) / 1 = 0.10
    expect(
      calculateKellyStake({ bankroll: 1000, americanOdds: 100, winProbability: 0.55 }),
    ).toEqual({
      fullKellyFraction: 0.1,
      recommendedFraction: 0.025,
      recommendedStake: 25,
    });

    // Full Kelly when fraction = 1.
    expect(
      calculateKellyStake({ bankroll: 1000, americanOdds: 100, winProbability: 0.55, fraction: 1 }),
    ).toEqual({
      fullKellyFraction: 0.1,
      recommendedFraction: 0.1,
      recommendedStake: 100,
    });

    // -110 at 55%: b = 0.909091, full Kelly = 0.055
    expect(
      calculateKellyStake({ bankroll: 1000, americanOdds: -110, winProbability: 0.55 }),
    ).toEqual({
      fullKellyFraction: 0.055,
      recommendedFraction: 0.01375,
      recommendedStake: 13.75,
    });

    // -EV bets clamp to zero.
    expect(
      calculateKellyStake({ bankroll: 1000, americanOdds: 100, winProbability: 0.45 }),
    ).toEqual({
      fullKellyFraction: 0,
      recommendedFraction: 0,
      recommendedStake: 0,
    });

    expect(() =>
      calculateKellyStake({ bankroll: 0, americanOdds: 100, winProbability: 0.55 }),
    ).toThrow(TypeError);
    expect(() =>
      calculateKellyStake({ bankroll: 0, americanOdds: 100, winProbability: 0.55 }),
    ).toThrow('bankroll must be a positive number');
    expect(() =>
      calculateKellyStake({ bankroll: 1000, americanOdds: 100, winProbability: 0.55, fraction: 0 }),
    ).toThrow('fraction must be a positive number');
    expect(() =>
      calculateKellyStake({
        bankroll: 1000,
        americanOdds: 100,
        winProbability: 0.55,
        fraction: 1.5,
      }),
    ).toThrow('fraction must be at most 1');
  });

  test('computes closing line value as an implied-probability delta', () => {
    // Placed +110 (47.619%), closed -105 (51.2195%): +3.6 points of CLV.
    expect(
      calculateClosingLineValue({ placedAmericanOdds: 110, closingAmericanOdds: -105 }),
    ).toEqual({ clvPercent: 3.6, beatClosingLine: true });

    // The reverse move loses 3.6 points.
    expect(
      calculateClosingLineValue({ placedAmericanOdds: -105, closingAmericanOdds: 110 }),
    ).toEqual({ clvPercent: -3.6, beatClosingLine: false });

    // No movement is not a beat.
    expect(
      calculateClosingLineValue({ placedAmericanOdds: -110, closingAmericanOdds: -110 }),
    ).toEqual({ clvPercent: 0, beatClosingLine: false });

    expect(() =>
      calculateClosingLineValue({ placedAmericanOdds: 0, closingAmericanOdds: -110 }),
    ).toThrow('odds cannot be 0');
  });
});
