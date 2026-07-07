import { assertPositiveNumber, assertProbability, round } from './internal';
import { americanOddsToImpliedProbability } from './odds';
import { americanToDecimalOdds } from './parlay';

export type ExpectedValueInput = {
  stake: number;
  americanOdds: number;
  winProbability: number;
};

export type ExpectedValueResult = {
  /** Expected profit (same currency unit as the stake), rounded to cents. */
  expectedValue: number;
  /** Expected value as a percentage of the stake. */
  expectedRoiPercent: number;
};

export type KellyStakeInput = {
  bankroll: number;
  americanOdds: number;
  winProbability: number;
  /** Fraction of full Kelly to recommend. Defaults to 0.25 (quarter-Kelly). */
  fraction?: number;
};

export type KellyStakeResult = {
  /** Full Kelly bankroll fraction, clamped at 0 for -EV bets. */
  fullKellyFraction: number;
  /** fullKellyFraction scaled by the requested fraction. */
  recommendedFraction: number;
  /** recommendedFraction applied to the bankroll, rounded to cents. */
  recommendedStake: number;
};

export type ClosingLineValueInput = {
  placedAmericanOdds: number;
  closingAmericanOdds: number;
};

export type ClosingLineValueResult = {
  /**
   * Implied-probability delta (closing minus placed) in percentage points.
   * Positive means the market moved toward the bet after it was placed.
   */
  clvPercent: number;
  beatClosingLine: boolean;
};

/**
 * Expected profit of a single bet given a win probability. Losses forfeit the
 * stake; wins return the profit implied by the American odds.
 */
export function calculateExpectedValue(input: ExpectedValueInput): ExpectedValueResult {
  assertPositiveNumber(input.stake, 'stake', TypeError);
  assertProbability(input.winProbability, 'winProbability', TypeError);

  const profitIfWin = input.stake * (americanToDecimalOdds(input.americanOdds) - 1);
  const expectedValue =
    input.winProbability * profitIfWin - (1 - input.winProbability) * input.stake;

  return {
    expectedValue: round(expectedValue, 2),
    expectedRoiPercent: round((expectedValue / input.stake) * 100, 2),
  };
}

/**
 * Kelly criterion staking. `fullKellyFraction` is (b * p - q) / b with
 * b = decimal odds - 1, clamped at 0 when the bet is -EV.
 */
export function calculateKellyStake(input: KellyStakeInput): KellyStakeResult {
  assertPositiveNumber(input.bankroll, 'bankroll', TypeError);
  assertProbability(input.winProbability, 'winProbability', TypeError);
  const fraction = input.fraction ?? 0.25;
  assertPositiveNumber(fraction, 'fraction', TypeError);
  if (fraction > 1) {
    throw new TypeError('fraction must be at most 1');
  }

  const netOdds = americanToDecimalOdds(input.americanOdds) - 1;
  const rawKelly = (netOdds * input.winProbability - (1 - input.winProbability)) / netOdds;
  const fullKellyFraction = round(Math.max(0, rawKelly), 6);
  const recommendedFraction = round(fullKellyFraction * fraction, 6);

  return {
    fullKellyFraction,
    recommendedFraction,
    recommendedStake: round(input.bankroll * recommendedFraction, 2),
  };
}

/**
 * Closing line value as the raw implied-probability delta between the placed
 * price and the closing price (no vig removal — single-sided prices).
 */
export function calculateClosingLineValue(input: ClosingLineValueInput): ClosingLineValueResult {
  const placedProbability = americanOddsToImpliedProbability(input.placedAmericanOdds);
  const closingProbability = americanOddsToImpliedProbability(input.closingAmericanOdds);
  const clvPercent = round((closingProbability - placedProbability) * 100, 2);

  return {
    clvPercent,
    beatClosingLine: clvPercent > 0,
  };
}
