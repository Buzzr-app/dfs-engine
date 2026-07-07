import { describe, expect, test } from 'vitest';
import {
  calculateBetRollup,
  calculateDrawdown,
  calculateRollupByPeriod,
  calculateStreaks,
  type BetRecord,
  type RollupPeriod,
} from '../src';

const bet = (overrides: Partial<BetRecord> = {}): BetRecord => ({
  id: 'bet-1',
  userId: 'user-1',
  sportsbookSlug: 'draftkings',
  kind: 'straight',
  status: 'pending',
  stake: 10,
  placedAt: '2026-05-13T00:00:00.000Z',
  ...overrides,
});

describe('calculateRollupByPeriod', () => {
  const wedWin = bet({
    id: 'wed-win',
    status: 'won',
    payout: 25,
    settledAt: '2026-05-13T18:00:00.000Z',
  });
  const wedLoss = bet({ id: 'wed-loss', status: 'lost', settledAt: '2026-05-13T20:00:00.000Z' });
  const thuWin = bet({
    id: 'thu-win',
    status: 'won',
    payout: 30,
    settledAt: '2026-05-14T01:00:00.000Z',
  });
  const thuPending = bet({ id: 'thu-pending', placedAt: '2026-05-14T02:00:00.000Z' });

  test('buckets by UTC day using settledAt with placedAt fallback', () => {
    const result = calculateRollupByPeriod([thuWin, wedWin, thuPending, wedLoss], 'day');

    expect(result.map((entry) => entry.periodStart)).toEqual(['2026-05-13', '2026-05-14']);
    expect(result[0]?.rollup).toEqual(calculateBetRollup([wedWin, wedLoss]));
    expect(result[0]?.rollup).toMatchObject({
      totalBets: 2,
      won: 1,
      lost: 1,
      staked: 20,
      returned: 25,
      netUnits: 5,
    });
    expect(result[1]?.rollup).toEqual(calculateBetRollup([thuWin, thuPending]));
  });

  test('buckets by UTC week starting Monday', () => {
    const nextMonday = bet({
      id: 'next-monday',
      status: 'won',
      payout: 22,
      settledAt: '2026-05-18T00:00:00.000Z',
    });
    const sunday = bet({ id: 'sunday', status: 'lost', settledAt: '2026-05-17T23:59:59.000Z' });

    const result = calculateRollupByPeriod([nextMonday, wedWin, sunday, wedLoss], 'week');

    expect(result.map((entry) => entry.periodStart)).toEqual(['2026-05-11', '2026-05-18']);
    expect(result[0]?.rollup.totalBets).toBe(3);
    expect(result[1]?.rollup.totalBets).toBe(1);
  });

  test('buckets by UTC month', () => {
    const june = bet({
      id: 'june',
      status: 'won',
      payout: 40,
      settledAt: '2026-06-02T12:00:00.000Z',
    });

    const result = calculateRollupByPeriod([june, wedWin, wedLoss], 'month');

    expect(result.map((entry) => entry.periodStart)).toEqual(['2026-05-01', '2026-06-01']);
    expect(result[0]?.rollup.totalBets).toBe(2);
    expect(result[1]?.rollup).toEqual(calculateBetRollup([june]));
  });

  test('handles empty input and rejects unknown periods', () => {
    expect(calculateRollupByPeriod([], 'day')).toEqual([]);
    expect(() => calculateRollupByPeriod([], 'quarter' as RollupPeriod)).toThrow(TypeError);
    expect(() => calculateRollupByPeriod([], 'quarter' as RollupPeriod)).toThrow(
      "period must be 'day', 'week', or 'month'",
    );
  });
});

describe('calculateDrawdown', () => {
  test('tracks the cumulative net-units curve chronologically', () => {
    const result = calculateDrawdown([
      // Curve: +15 -> +5 -> -5 -> +15 -> +15 (push adds nothing)
      bet({ id: 'w1', status: 'won', payout: 25, settledAt: '2026-05-13T01:00:00.000Z' }),
      bet({ id: 'l1', status: 'lost', settledAt: '2026-05-13T02:00:00.000Z' }),
      bet({ id: 'l2', status: 'lost', settledAt: '2026-05-13T03:00:00.000Z' }),
      bet({
        id: 'w2',
        status: 'won',
        potentialPayout: 30,
        settledAt: '2026-05-13T04:00:00.000Z',
      }),
      bet({ id: 'p1', status: 'pushed', settledAt: '2026-05-13T05:00:00.000Z' }),
      // Not settled money: ignored.
      bet({ id: 'open', status: 'pending', stake: 500 }),
      bet({ id: 'draft', status: 'draft', stake: 500 }),
      bet({ id: 'gone', status: 'canceled', stake: 500 }),
    ]);

    expect(result).toEqual({
      maxDrawdownUnits: 20,
      peakUnits: 15,
      troughUnits: -5,
      currentUnits: 15,
    });
  });

  test('an all-losing book never rises above the starting point', () => {
    const result = calculateDrawdown([
      bet({ id: 'l1', status: 'lost', settledAt: '2026-05-13T01:00:00.000Z' }),
      bet({ id: 'l2', status: 'lost', settledAt: '2026-05-13T02:00:00.000Z' }),
    ]);

    expect(result).toEqual({
      maxDrawdownUnits: 20,
      peakUnits: 0,
      troughUnits: -20,
      currentUnits: -20,
    });
  });

  test('returns zeros for no settled bets', () => {
    expect(calculateDrawdown([])).toEqual({
      maxDrawdownUnits: 0,
      peakUnits: 0,
      troughUnits: 0,
      currentUnits: 0,
    });
    expect(calculateDrawdown([bet({ status: 'pending' })])).toEqual({
      maxDrawdownUnits: 0,
      peakUnits: 0,
      troughUnits: 0,
      currentUnits: 0,
    });
  });
});

describe('calculateStreaks', () => {
  test('computes longest win/loss streaks and the current streak', () => {
    const result = calculateStreaks([
      // Chronological: W W L L L W
      bet({ id: 's1', status: 'won', payout: 20, settledAt: '2026-05-13T01:00:00.000Z' }),
      bet({ id: 's2', status: 'won', payout: 20, settledAt: '2026-05-13T02:00:00.000Z' }),
      bet({ id: 's3', status: 'lost', settledAt: '2026-05-13T03:00:00.000Z' }),
      bet({ id: 's4', status: 'lost', settledAt: '2026-05-13T04:00:00.000Z' }),
      bet({ id: 's5', status: 'lost', settledAt: '2026-05-13T05:00:00.000Z' }),
      bet({ id: 's6', status: 'won', payout: 20, settledAt: '2026-05-13T06:00:00.000Z' }),
      // Pushes and open bets never enter a streak.
      bet({ id: 'push', status: 'pushed', settledAt: '2026-05-13T07:00:00.000Z' }),
      bet({ id: 'open', status: 'pending' }),
    ]);

    expect(result).toEqual({
      longestWinStreak: 2,
      longestLossStreak: 3,
      currentStreak: { status: 'won', count: 1 },
    });
  });

  test('returns empty streaks for no decided bets', () => {
    expect(calculateStreaks([])).toEqual({
      longestWinStreak: 0,
      longestLossStreak: 0,
      currentStreak: { status: null, count: 0 },
    });
    expect(calculateStreaks([bet({ status: 'pushed' })])).toEqual({
      longestWinStreak: 0,
      longestLossStreak: 0,
      currentStreak: { status: null, count: 0 },
    });
  });
});
