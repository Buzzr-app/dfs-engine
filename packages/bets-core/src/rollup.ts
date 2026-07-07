import type { BetRecord, BetRollup } from './types';
import { round, timestamp } from './internal';

export function calculateBetRollup(bets: readonly BetRecord[]): BetRollup {
  let pending = 0;
  let won = 0;
  let lost = 0;
  let pushed = 0;
  let voided = 0;
  let canceled = 0;
  let staked = 0;
  let returned = 0;

  for (const bet of bets) {
    if (bet.status === 'canceled') {
      canceled += 1;
      continue;
    }
    if (bet.status === 'draft') {
      pending += 1;
      continue;
    }

    staked += bet.stake;
    returned += returnedAmount(bet);

    if (bet.status === 'pending') {
      pending += 1;
    } else if (bet.status === 'won' || bet.status === 'cashed_out') {
      won += 1;
    } else if (bet.status === 'lost') {
      lost += 1;
    } else if (bet.status === 'pushed') {
      pushed += 1;
    } else if (bet.status === 'void') {
      voided += 1;
    }
  }

  const netUnits = round(returned - staked, 2);
  const decisions = won + lost;
  return {
    totalBets: bets.length,
    pending,
    won,
    lost,
    pushed,
    voided,
    canceled,
    staked: round(staked, 2),
    returned: round(returned, 2),
    netUnits,
    roiPercent: staked > 0 ? round((netUnits / staked) * 100, 2) : 0,
    winRate: decisions > 0 ? round((won / decisions) * 100, 2) : 0,
    currentStreak: calculateCurrentStreak(bets),
  };
}

/**
 * Amount returned to the bettor for a bet, mirroring the settlement rules used
 * by `calculateBetRollup`. Package-internal (shared with `analytics.ts`).
 */
export function returnedAmount(bet: BetRecord): number {
  if (bet.payout != null) {
    return bet.payout;
  }
  if (bet.status === 'won' || bet.status === 'cashed_out') {
    return bet.potentialPayout ?? 0;
  }
  if (bet.status === 'pushed' || bet.status === 'void') {
    return bet.stake;
  }
  return 0;
}

/**
 * Bets that count toward streaks: settled with a win/loss decision.
 * Package-internal (shared with `analytics.ts`).
 */
export function settledWinLossBets(bets: readonly BetRecord[]): BetRecord[] {
  return bets.filter((bet) => bet.status === 'won' || bet.status === 'lost');
}

/**
 * Chronological ordering key: settledAt when present, placedAt otherwise.
 * Package-internal (shared with `analytics.ts`).
 */
export function settlementTimestamp(bet: BetRecord): number {
  return timestamp(bet.settledAt ?? bet.placedAt);
}

/**
 * Current win/loss streak over the most recently settled bets.
 * Package-internal (shared with `analytics.ts`).
 */
export function calculateCurrentStreak(bets: readonly BetRecord[]): BetRollup['currentStreak'] {
  const settled = settledWinLossBets(bets).sort(
    (a, b) => settlementTimestamp(b) - settlementTimestamp(a),
  );

  const first = settled[0];
  if (!first) {
    return { status: null, count: 0 };
  }

  const firstStatus: 'won' | 'lost' = first.status === 'won' ? 'won' : 'lost';
  let count = 0;
  for (const bet of settled) {
    if (bet.status !== firstStatus) {
      break;
    }
    count += 1;
  }

  return { status: firstStatus, count };
}
