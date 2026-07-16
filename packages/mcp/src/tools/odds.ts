import {
  calculateClosingLineValue,
  calculateEdgePercent,
  calculateExpectedValue,
  calculateKellyStake,
  calculateNoVigFairLine,
  calculateParlayFairValue,
  combineAmericanOdds,
} from '@buzzr/bets-core';
import { z } from 'zod';

import { positiveFiniteNumber } from './schemas';
import { defineTool, jsonResult } from './shared';
import type { BuzzrToolDefinition } from './shared';

const americanOdds = z
  .number()
  .finite()
  .min(-1_000_000)
  .max(1_000_000)
  .refine((value) => value !== 0, { message: 'American odds cannot be 0.' })
  .describe('American odds, e.g. -110 or +145.');

const fairLineSchema = z.object({
  selected: americanOdds.describe('American odds offered for the side you are evaluating.'),
  opposite: americanOdds.describe('American odds offered for the other side of the same market.'),
  selectedSide: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('Optional label for the selected side, e.g. "Lakers -3.5".'),
});

const closingLineValueSchema = z.object({
  placedAmericanOdds: americanOdds.describe('American odds when the bet was placed.'),
  closingAmericanOdds: americanOdds.describe('American odds when the market closed.'),
});

export const closingLineValueTool = defineTool({
  name: 'closing_line_value',
  title: 'Closing line value',
  description:
    'Compare placed and closing American odds with @buzzr/bets-core. Returns the ' +
    'implied-probability delta in percentage points and whether the bet beat the close.',
  inputSchema: closingLineValueSchema,
  run: (args) =>
    jsonResult({
      contractVersion: 1,
      ...calculateClosingLineValue(args),
    }),
});

export const fairLineTool = defineTool({
  name: 'fair_line',
  title: 'No-vig fair line',
  description:
    'Remove the vig from a two-sided market with @buzzr/bets-core. Given the offered ' +
    'American odds for both sides, returns the fair win probability, fair American odds, ' +
    'market overround, and the edge of the selected price versus fair.',
  inputSchema: fairLineSchema,
  run: (args) => {
    const result = calculateNoVigFairLine({
      selected: { side: args.selectedSide ?? 'selected', americanOdds: args.selected },
      opposite: { side: 'opposite', americanOdds: args.opposite },
    });
    return jsonResult(result);
  },
});

const parlayValueSchema = z.object({
  legs: z
    .array(
      z.object({
        selected: americanOdds.describe('Offered American odds for the picked side of the leg.'),
        opposite: americanOdds.describe('Offered American odds for the other side of the leg.'),
      }),
    )
    .min(1)
    .max(50)
    .describe('Every leg of the parlay, each with both sides of its market.'),
  offeredAmericanOdds: americanOdds
    .optional()
    .describe(
      'Combined parlay price the book is offering. Defaults to the product of the ' +
        'selected leg prices when omitted.',
    ),
  stake: positiveFiniteNumber
    .optional()
    .describe('Optional stake; adds expected-value math to the result.'),
});

export const parlayValueTool = defineTool({
  name: 'parlay_value',
  title: 'Parlay fair value',
  description:
    'Price a parlay with @buzzr/bets-core: removes the vig from each leg, combines the ' +
    'fair leg probabilities into a fair parlay price, and reports the edge of the offered ' +
    'combined odds. With a stake, also returns expected profit and expected ROI.',
  inputSchema: parlayValueSchema,
  run: (args) => {
    const fair = calculateParlayFairValue({ legs: args.legs });
    const combinedLegOdds = combineAmericanOdds(args.legs.map((leg) => leg.selected));
    const offeredAmericanOdds = args.offeredAmericanOdds ?? combinedLegOdds;
    const edgePercent = calculateEdgePercent({
      fairProbability: fair.fairProbability,
      marketAmericanOdds: offeredAmericanOdds,
    });
    const expectedValue =
      args.stake === undefined
        ? undefined
        : calculateExpectedValue({
            stake: args.stake,
            americanOdds: offeredAmericanOdds,
            winProbability: fair.fairProbability,
          });

    return jsonResult({
      legFairProbabilities: fair.legFairProbabilities,
      fairProbability: fair.fairProbability,
      fairAmericanOdds: fair.fairAmericanOdds,
      combinedLegOdds,
      offeredAmericanOdds,
      edgePercent,
      ...(expectedValue === undefined ? {} : { expectedValue }),
    });
  },
});

const kellyStakeSchema = z.object({
  bankroll: positiveFiniteNumber.describe('Total bankroll in currency units.'),
  americanOdds: americanOdds.describe('American odds offered for the bet.'),
  winProbability: z
    .number()
    .finite()
    .gt(0)
    .lt(1)
    .describe('Your estimated win probability, strictly between 0 and 1.'),
  fraction: z
    .number()
    .finite()
    .gt(0)
    .max(1)
    .optional()
    .describe('Fraction of full Kelly to recommend. Defaults to 0.25 (quarter-Kelly).'),
});

export const kellyStakeTool = defineTool({
  name: 'kelly_stake',
  title: 'Kelly stake sizing',
  description:
    'Kelly-criterion stake sizing with @buzzr/bets-core. Returns the full Kelly bankroll ' +
    'fraction (clamped at 0 for -EV bets), the fractional-Kelly recommendation, and the ' +
    'recommended stake for the given bankroll.',
  inputSchema: kellyStakeSchema,
  run: (args) => {
    const result = calculateKellyStake({
      bankroll: args.bankroll,
      americanOdds: args.americanOdds,
      winProbability: args.winProbability,
      ...(args.fraction === undefined ? {} : { fraction: args.fraction }),
    });
    return jsonResult(result);
  },
});

export const oddsTools: readonly BuzzrToolDefinition[] = [
  fairLineTool,
  closingLineValueTool,
  parlayValueTool,
  kellyStakeTool,
];
