import { describe, expect, test } from 'vitest';
import {
  americanOddsToImpliedProbability,
  betRecordToDfsEntryInput,
  buildExternalBetKey,
  calculateBetRollup,
  calculateEdgePercent,
  calculateNoVigFairLine,
  normalizeSportsbookSlug,
  probabilityToAmericanOdds,
  type BetRecord,
} from '../src';

const baseBet = (overrides: Partial<BetRecord> = {}): BetRecord => ({
  id: 'bet-1',
  userId: 'user-1',
  sportsbookSlug: 'Prize Picks',
  kind: 'dfs',
  status: 'pending',
  stake: 10,
  potentialPayout: 30,
  placedAt: '2026-05-13T00:00:00.000Z',
  dfs: {
    playTypeId: 'power',
    displayedMultiplier: 3,
  },
  legs: [
    {
      legId: 'leg-1',
      playerName: 'A. Example',
      playerId: 'athlete-1',
      league: 'NBA',
      propType: 'Points',
      line: 20.5,
      direction: 'over',
      actual: 24,
    },
    {
      legId: 'leg-2',
      playerName: 'B. Example',
      league: 'NBA',
      propType: 'Rebounds',
      line: 7.5,
      side: 'more',
    },
  ],
  ...overrides,
});

describe('@buzzr/bets-core', () => {
  test('normalizes sportsbook names and builds stable external bet keys', () => {
    expect(normalizeSportsbookSlug('Draft Kings')).toBe('draftkings');
    expect(normalizeSportsbookSlug('ESPN BET')).toBe('espnbet');
    expect(normalizeSportsbookSlug('My Local Book')).toBe('my-local-book');
    expect(() => normalizeSportsbookSlug('   ')).toThrow('sportsbook value is required');

    expect(
      buildExternalBetKey({
        userId: 'user-1',
        provider: 'Prize Picks',
        externalBetId: ' slip-99 ',
      }),
    ).toBe('user-1:prizepicks:slip-99');
    expect(() =>
      buildExternalBetKey({ userId: '', provider: 'kalshi', externalBetId: 'x' }),
    ).toThrow('userId is required');
  });

  test('computes no-vig fair lines and edge percent from American odds', () => {
    expect(americanOddsToImpliedProbability(-110)).toBe(0.52381);
    expect(americanOddsToImpliedProbability(150)).toBe(0.4);
    expect(probabilityToAmericanOdds(0.6)).toBe(-150);
    expect(probabilityToAmericanOdds(0.4)).toBe(150);

    const fairLine = calculateNoVigFairLine({
      selected: { side: 'over', americanOdds: 120 },
      opposite: { side: 'under', americanOdds: -130 },
    });

    expect(fairLine).toMatchObject({
      selectedSide: 'over',
      marketProbability: 0.454545,
    });
    expect(fairLine.fairProbability).toBeCloseTo(0.445736, 6);
    expect(fairLine.fairAmericanOdds).toBe(124);
    expect(fairLine.edgePercent).toBeCloseTo(-0.88, 2);
    expect(
      calculateEdgePercent({
        fairProbability: 0.55,
        marketAmericanOdds: 120,
      }),
    ).toBeCloseTo(9.55, 2);
    expect(() => americanOddsToImpliedProbability(0)).toThrow('odds cannot be 0');
    expect(() => probabilityToAmericanOdds(1)).toThrow('between 0 and 1');
    expect(() =>
      calculateEdgePercent({
        fairProbability: Number.NaN,
        marketAmericanOdds: 120,
      }),
    ).toThrow('fairProbability must be a finite number');
  });

  test('rolls up bet performance with payouts, pushes, voids, and current streaks', () => {
    const rollup = calculateBetRollup([
      baseBet({
        id: 'won-1',
        status: 'won',
        stake: 10,
        potentialPayout: 25,
        settledAt: '2026-05-13T02:00:00.000Z',
      }),
      baseBet({
        id: 'won-2',
        status: 'won',
        stake: 10,
        payout: 18,
        settledAt: '2026-05-13T03:00:00.000Z',
      }),
      baseBet({
        id: 'lost-1',
        status: 'lost',
        stake: 10,
        settledAt: '2026-05-13T01:00:00.000Z',
      }),
      baseBet({ id: 'push-1', status: 'pushed', stake: 10 }),
      baseBet({ id: 'void-1', status: 'void', stake: 10 }),
      baseBet({ id: 'pending-1', status: 'pending', stake: 10 }),
      baseBet({ id: 'canceled-1', status: 'canceled', stake: 100 }),
    ]);

    expect(rollup).toMatchObject({
      totalBets: 7,
      pending: 1,
      won: 2,
      lost: 1,
      pushed: 1,
      voided: 1,
      canceled: 1,
      staked: 60,
      returned: 63,
      netUnits: 3,
      roiPercent: 5,
      winRate: 66.67,
      currentStreak: {
        status: 'won',
        count: 2,
      },
    });
    expect(
      calculateBetRollup([baseBet({ id: 'draft-1', status: 'draft', stake: 100 })]),
    ).toMatchObject({
      pending: 1,
      staked: 0,
      returned: 0,
      roiPercent: 0,
      currentStreak: { status: null, count: 0 },
    });
  });

  test('adapts a tracked DFS bet record into a dfs-engine settlement input', () => {
    expect(betRecordToDfsEntryInput(baseBet())).toMatchObject({
      entryId: 'bet-1',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      legs: [
        {
          legId: 'leg-1',
          playerId: 'athlete-1',
          playerName: 'A. Example',
          league: 'NBA',
          propType: 'Points',
          line: 20.5,
          direction: 'over',
          stat: 24,
        },
        {
          legId: 'leg-2',
          playerName: 'B. Example',
          direction: 'over',
        },
      ],
    });

    expect(
      betRecordToDfsEntryInput(
        baseBet({
          dfs: { playTypeId: 'flex' },
          potentialPayout: 45,
        }),
      ).displayedMultiplier,
    ).toBe(4.5);
    expect(() => betRecordToDfsEntryInput(baseBet({ legs: [] }))).toThrow(
      'at least one leg is required',
    );
    expect(() => betRecordToDfsEntryInput(baseBet({ dfs: null }))).toThrow(
      'dfs.playTypeId is required',
    );
    expect(
      betRecordToDfsEntryInput(
        baseBet({
          legs: [
            {
              legId: 'under-leg',
              playerName: 'C. Example',
              league: 'NBA',
              propType: 'Assists',
              line: 5.5,
              side: 'under',
            },
          ],
        }),
      ).legs[0],
    ).toMatchObject({ direction: 'under' });
    expect(() =>
      betRecordToDfsEntryInput(
        baseBet({
          potentialPayout: null,
          dfs: { playTypeId: 'power' },
        }),
      ),
    ).toThrow('displayed multiplier is required');
    expect(() =>
      betRecordToDfsEntryInput(
        baseBet({
          legs: [
            {
              legId: 'bad-leg',
              playerName: 'C. Example',
              league: 'NBA',
              propType: 'Assists',
              line: 5.5,
              side: 'exactly',
            },
          ],
        }),
      ),
    ).toThrow('direction is required');
  });
});
