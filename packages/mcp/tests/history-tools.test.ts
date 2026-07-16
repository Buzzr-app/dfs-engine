import { describe, expect, it } from 'vitest';

import { summarizeBetHistoryTool } from '../src/tools/history';
import type { ToolResult } from '../src/tools/shared';

function parseResult(result: ToolResult): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function bet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bet-1',
    userId: 'user-1',
    sportsbookSlug: 'draftkings',
    kind: 'straight',
    status: 'won',
    stake: 10,
    payout: 25,
    placedAt: '2026-07-15T17:00:00.000Z',
    settledAt: '2026-07-15T18:00:00.000Z',
    ...overrides,
  };
}

describe('summarize_bet_history', () => {
  it('returns rollup, period, drawdown, and streak analytics in one versioned result', async () => {
    const result = await summarizeBetHistoryTool.handler({
      bets: [
        bet(),
        bet({
          id: 'bet-2',
          status: 'lost',
          payout: 0,
          settledAt: '2026-07-16T18:00:00.000Z',
        }),
      ],
      period: 'day',
    });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toEqual({
      contractVersion: '1',
      period: 'day',
      overall: expect.objectContaining({ totalBets: 2, won: 1, lost: 1, netUnits: 5 }),
      byPeriod: [
        expect.objectContaining({ periodStart: '2026-07-15' }),
        expect.objectContaining({ periodStart: '2026-07-16' }),
      ],
      drawdown: {
        maxDrawdownUnits: 10,
        peakUnits: 15,
        troughUnits: 0,
        currentUnits: 5,
      },
      streaks: {
        longestWinStreak: 1,
        longestLossStreak: 1,
        currentStreak: { status: 'lost', count: 1 },
      },
    });
  });

  it.each([
    [
      'more than 500 bets',
      { bets: Array.from({ length: 501 }, (_, index) => bet({ id: `bet-${index}` })) },
    ],
    ['duplicate bet ids', { bets: [bet(), bet()] }],
    ['invalid placedAt', { bets: [bet({ placedAt: 'yesterday' })] }],
    ['invalid settledAt', { bets: [bet({ settledAt: 'tomorrow maybe' })] }],
    ['non-finite stake', { bets: [bet({ stake: Number.NaN })] }],
  ])('rejects %s', async (_label, input) => {
    const result = await summarizeBetHistoryTool.handler(input);

    expect(result.isError).toBe(true);
    expect(parseResult(result).error as Record<string, unknown>).toMatchObject({
      code: 'invalid_input',
    });
  });
});
