import type { BetRecord, BetRollup } from './types';
import { round } from './internal';
import {
  calculateBetRollup,
  calculateCurrentStreak,
  returnedAmount,
  settledWinLossBets,
  settlementTimestamp,
} from './rollup';

export type RollupPeriod = 'day' | 'week' | 'month';

export type PeriodRollup = {
  /** UTC start of the bucket as an ISO date string (YYYY-MM-DD). */
  periodStart: string;
  rollup: BetRollup;
};

export type DrawdownResult = {
  /** Largest peak-to-trough decline on the cumulative net-units curve. */
  maxDrawdownUnits: number;
  /** Highest point of the cumulative curve (at least 0, the starting point). */
  peakUnits: number;
  /** Lowest point of the cumulative curve (at most 0, the starting point). */
  troughUnits: number;
  /** Final cumulative net units across all settled bets. */
  currentUnits: number;
};

export type StreaksResult = {
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: BetRollup['currentStreak'];
};

/** Statuses that have a monetary settlement on the net-units curve. */
const MONETARY_SETTLED_STATUSES: ReadonlySet<BetRecord['status']> = new Set([
  'won',
  'lost',
  'pushed',
  'void',
  'cashed_out',
]);

/**
 * Buckets bets by settledAt (falling back to placedAt) in UTC and computes a
 * full `calculateBetRollup` per bucket. Buckets are sorted ascending by
 * period start. Week buckets start on Monday (UTC).
 */
export function calculateRollupByPeriod(
  bets: readonly BetRecord[],
  period: RollupPeriod,
): PeriodRollup[] {
  if (period !== 'day' && period !== 'week' && period !== 'month') {
    throw new TypeError("calculateRollupByPeriod: period must be 'day', 'week', or 'month'");
  }

  const buckets = new Map<string, BetRecord[]>();
  for (const bet of bets) {
    const key = periodStartFor(settlementTimestamp(bet), period);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(bet);
    } else {
      buckets.set(key, [bet]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([periodStart, bucketBets]) => ({
      periodStart,
      rollup: calculateBetRollup(bucketBets),
    }));
}

/**
 * Maximum drawdown over the chronological cumulative net-units curve. Each
 * settled bet contributes `returned - stake`, matching the netUnits semantics
 * of `calculateBetRollup`. Pending, draft, and canceled bets are excluded.
 * The curve starts at 0, so peakUnits >= 0 and troughUnits <= 0.
 */
export function calculateDrawdown(bets: readonly BetRecord[]): DrawdownResult {
  const settled = bets
    .filter((bet) => MONETARY_SETTLED_STATUSES.has(bet.status))
    .sort((a, b) => settlementTimestamp(a) - settlementTimestamp(b));

  let cumulative = 0;
  let peak = 0;
  let trough = 0;
  let maxDrawdown = 0;

  for (const bet of settled) {
    cumulative += returnedAmount(bet) - bet.stake;
    peak = Math.max(peak, cumulative);
    trough = Math.min(trough, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }

  return {
    maxDrawdownUnits: round(maxDrawdown, 2),
    peakUnits: round(peak, 2),
    troughUnits: round(trough, 2),
    currentUnits: round(cumulative, 2),
  };
}

/**
 * Longest win/loss streaks over chronologically ordered won/lost bets, plus
 * the current streak using the same semantics as `calculateBetRollup`.
 */
export function calculateStreaks(bets: readonly BetRecord[]): StreaksResult {
  const decided = settledWinLossBets(bets).sort(
    (a, b) => settlementTimestamp(a) - settlementTimestamp(b),
  );

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let run = 0;
  let runStatus: 'won' | 'lost' | null = null;

  for (const bet of decided) {
    const status: 'won' | 'lost' = bet.status === 'won' ? 'won' : 'lost';
    if (status === runStatus) {
      run += 1;
    } else {
      runStatus = status;
      run = 1;
    }
    if (status === 'won') {
      longestWinStreak = Math.max(longestWinStreak, run);
    } else {
      longestLossStreak = Math.max(longestLossStreak, run);
    }
  }

  return {
    longestWinStreak,
    longestLossStreak,
    currentStreak: calculateCurrentStreak(bets),
  };
}

function periodStartFor(ms: number, period: RollupPeriod): string {
  const date = new Date(ms);
  if (period === 'month') {
    return isoDate(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  if (period === 'week') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    return isoDate(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday),
    );
  }
  return isoDate(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
