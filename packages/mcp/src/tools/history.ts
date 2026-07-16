import {
  calculateBetRollup,
  calculateDrawdown,
  calculateRollupByPeriod,
  calculateStreaks,
} from '@buzzr/bets-core';
import { z } from 'zod';

import {
  boundedIdentifier,
  boundedLabel,
  finiteNumber,
  isoTimestamp,
  nonNegativeFiniteNumber,
} from './schemas';
import { defineTool, jsonResult } from './shared';
import type { BuzzrToolDefinition } from './shared';

const betStatusSchema = z.enum([
  'draft',
  'pending',
  'won',
  'lost',
  'pushed',
  'void',
  'cashed_out',
  'canceled',
]);

const betSchema = z.object({
  id: boundedIdentifier,
  userId: boundedIdentifier,
  sportsbookSlug: boundedIdentifier,
  externalSource: boundedIdentifier.nullish(),
  externalBetId: boundedIdentifier.nullish(),
  kind: boundedIdentifier,
  status: betStatusSchema,
  stake: nonNegativeFiniteNumber,
  potentialPayout: nonNegativeFiniteNumber.nullish(),
  payout: nonNegativeFiniteNumber.nullish(),
  market: boundedLabel.nullish(),
  league: boundedIdentifier.nullish(),
  gameId: boundedIdentifier.nullish(),
  side: boundedLabel.nullish(),
  line: finiteNumber.nullish(),
  americanOdds: finiteNumber.nullish(),
  placedAt: isoTimestamp,
  settledAt: isoTimestamp.nullish(),
  visibility: z.enum(['private', 'friends', 'public']).optional(),
  fairLine: finiteNumber.nullish(),
  edgePercent: finiteNumber.nullish(),
});

const summarizeBetHistorySchema = z
  .object({
    bets: z.array(betSchema).max(500),
    period: z.enum(['day', 'week', 'month']).optional(),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, bet] of value.bets.entries()) {
      if (ids.has(bet.id)) {
        context.addIssue({
          code: 'custom',
          path: ['bets', index, 'id'],
          message: `Duplicate bet id: ${bet.id}`,
        });
      }
      ids.add(bet.id);
    }
  });

export const summarizeBetHistoryTool = defineTool({
  name: 'summarize_bet_history',
  title: 'Summarize bet history',
  description:
    'Summarize up to 500 bet records with @buzzr/bets-core. Returns the overall ' +
    'rollup, UTC period buckets, maximum drawdown, and win/loss streaks.',
  inputSchema: summarizeBetHistorySchema,
  run: (args) => {
    const period = args.period ?? 'month';
    return jsonResult({
      contractVersion: 1,
      rollup: calculateBetRollup(args.bets),
      byPeriod: calculateRollupByPeriod(args.bets, period),
      drawdown: calculateDrawdown(args.bets),
      streaks: calculateStreaks(args.bets),
    });
  },
});

export const historyTools: readonly BuzzrToolDefinition[] = [summarizeBetHistoryTool];
