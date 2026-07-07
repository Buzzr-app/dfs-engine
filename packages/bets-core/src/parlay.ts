import { assertFiniteNumber, assertProbability, round } from './internal';
import { calculateEdgePercent, calculateNoVigFairLine, probabilityToAmericanOdds } from './odds';

export type ParlayLegOdds = {
  /** American odds offered for the selected side of the leg. */
  selected: number;
  /** American odds offered for the opposite side of the same market. */
  opposite: number;
};

export type ParlayFairValueInput = {
  legs: readonly ParlayLegOdds[];
};

export type ParlayFairValueResult = {
  /** No-vig fair win probability of each leg, in input order. */
  legFairProbabilities: readonly number[];
  /** Combined no-vig fair probability of the parlay (independent legs). */
  fairProbability: number;
  /** Combined fair price expressed as American odds. */
  fairAmericanOdds: number;
  /** Combined offered price built from the selected legs' American odds. */
  offeredAmericanOdds: number;
  /** Edge of the offered combined price versus the fair probability. */
  edgePercent: number;
};

/**
 * Converts American odds to decimal odds (stake included), rounded to six
 * decimal places. Both +100 and -100 map to 2.0.
 */
export function americanToDecimalOdds(americanOdds: number): number {
  assertFiniteNumber(americanOdds, 'americanOdds', TypeError);
  if (americanOdds === 0) {
    throw new TypeError('americanToDecimalOdds: odds cannot be 0');
  }
  if (americanOdds > 0) {
    return round(1 + americanOdds / 100, 6);
  }
  return round(1 + 100 / Math.abs(americanOdds), 6);
}

/**
 * Converts decimal odds (must be greater than 1) back to the nearest integer
 * American odds. Decimal 2.0 maps to +100.
 */
export function decimalToAmericanOdds(decimalOdds: number): number {
  assertFiniteNumber(decimalOdds, 'decimalOdds', TypeError);
  if (decimalOdds <= 1) {
    throw new TypeError('decimalToAmericanOdds: decimal odds must be greater than 1');
  }
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  }
  return Math.round(-100 / (decimalOdds - 1));
}

/**
 * Combined parlay price for a list of American odds, computed via the product
 * of the per-leg decimal odds.
 */
export function combineAmericanOdds(odds: readonly number[]): number {
  if (odds.length === 0) {
    throw new TypeError('combineAmericanOdds: at least one leg is required');
  }
  let combinedDecimal = 1;
  for (const legOdds of odds) {
    combinedDecimal *= americanToDecimalOdds(legOdds);
  }
  return decimalToAmericanOdds(combinedDecimal);
}

/**
 * Probability that every leg of a parlay hits, assuming independent legs.
 * Each probability must be strictly between 0 and 1.
 */
export function calculateParlayProbability(probabilities: readonly number[]): number {
  if (probabilities.length === 0) {
    throw new TypeError('calculateParlayProbability: at least one leg is required');
  }
  let combined = 1;
  probabilities.forEach((probability, index) => {
    assertProbability(probability, `probabilities[${index}]`, TypeError);
    combined *= probability;
  });
  return round(combined, 6);
}

/**
 * Removes the vig from each leg (selected vs opposite price), combines the
 * fair leg probabilities into a fair parlay price, and reports the edge of the
 * offered combined price against that fair probability.
 */
export function calculateParlayFairValue(input: ParlayFairValueInput): ParlayFairValueResult {
  if (input.legs.length === 0) {
    throw new TypeError('calculateParlayFairValue: at least one leg is required');
  }

  const legFairProbabilities = input.legs.map(
    (leg) =>
      calculateNoVigFairLine({
        selected: { side: 'selected', americanOdds: leg.selected },
        opposite: { side: 'opposite', americanOdds: leg.opposite },
      }).fairProbability,
  );
  const fairProbability = calculateParlayProbability(legFairProbabilities);
  const offeredAmericanOdds = combineAmericanOdds(input.legs.map((leg) => leg.selected));

  return {
    legFairProbabilities,
    fairProbability,
    fairAmericanOdds: probabilityToAmericanOdds(fairProbability),
    offeredAmericanOdds,
    edgePercent: calculateEdgePercent({
      fairProbability,
      marketAmericanOdds: offeredAmericanOdds,
    }),
  };
}
