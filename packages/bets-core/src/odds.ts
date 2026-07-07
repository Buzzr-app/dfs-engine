import type { FairLineInput, FairLineResult } from './types';
import { assertFiniteNumber, assertProbability, round } from './internal';

export function americanOddsToImpliedProbability(americanOdds: number): number {
  assertFiniteNumber(americanOdds, 'americanOdds');
  if (americanOdds === 0) {
    throw new Error('americanOddsToImpliedProbability: odds cannot be 0');
  }
  if (americanOdds > 0) {
    return round(100 / (americanOdds + 100), 6);
  }
  return round(Math.abs(americanOdds) / (Math.abs(americanOdds) + 100), 6);
}

export function probabilityToAmericanOdds(probability: number): number {
  assertProbability(probability, 'probability');
  if (probability >= 0.5) {
    return Math.round((-100 * probability) / (1 - probability));
  }
  return Math.round((100 * (1 - probability)) / probability);
}

export function calculateEdgePercent(input: {
  fairProbability: number;
  marketAmericanOdds: number;
}): number {
  assertProbability(input.fairProbability, 'fairProbability');
  return round(
    (input.fairProbability - americanOddsToImpliedProbability(input.marketAmericanOdds)) * 100,
    2,
  );
}

export function calculateNoVigFairLine(input: FairLineInput): FairLineResult {
  const selectedProbability = americanOddsToImpliedProbability(input.selected.americanOdds);
  const oppositeProbability = americanOddsToImpliedProbability(input.opposite.americanOdds);
  const totalProbability = selectedProbability + oppositeProbability;

  if (totalProbability <= 0) {
    throw new Error('calculateNoVigFairLine: odds pair has no probability');
  }

  const fairProbability = round(selectedProbability / totalProbability, 6);
  return {
    selectedSide: input.selected.side,
    fairProbability,
    fairAmericanOdds: probabilityToAmericanOdds(fairProbability),
    marketProbability: selectedProbability,
    overround: round(totalProbability - 1, 6),
    edgePercent: calculateEdgePercent({
      fairProbability,
      marketAmericanOdds: input.selected.americanOdds,
    }),
  };
}
