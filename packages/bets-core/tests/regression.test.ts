import { describe, expect, test } from 'vitest';
import * as betsCore from '../src';
import { combineAmericanOdds, type BetRecord } from '../src';

const V4_FUNCTION_EXPORTS = [
  'americanOddsToImpliedProbability',
  'probabilityToAmericanOdds',
  'calculateEdgePercent',
  'calculateNoVigFairLine',
  'calculateBetRollup',
  'normalizeSportsbookSlug',
  'buildExternalBetKey',
  'betRecordToDfsEntryInput',
] as const;

function captureError(fn: () => unknown): unknown {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

describe('v4 export regression', () => {
  test('every v4 function export still exists', () => {
    for (const name of V4_FUNCTION_EXPORTS) {
      expect(typeof betsCore[name], `${name} should be exported as a function`).toBe('function');
    }
  });

  test('v4 odds math behavior is unchanged', () => {
    expect(betsCore.americanOddsToImpliedProbability(-110)).toBe(0.52381);
    expect(betsCore.americanOddsToImpliedProbability(150)).toBe(0.4);
    expect(betsCore.probabilityToAmericanOdds(0.6)).toBe(-150);
    expect(betsCore.probabilityToAmericanOdds(0.4)).toBe(150);
    expect(
      betsCore.calculateEdgePercent({ fairProbability: 0.55, marketAmericanOdds: 120 }),
    ).toBeCloseTo(9.55, 2);

    const fairLine = betsCore.calculateNoVigFairLine({
      selected: { side: 'over', americanOdds: 120 },
      opposite: { side: 'under', americanOdds: -130 },
    });
    expect(fairLine).toMatchObject({ selectedSide: 'over', marketProbability: 0.454545 });
    expect(fairLine.fairProbability).toBeCloseTo(0.445736, 6);
    expect(fairLine.fairAmericanOdds).toBe(124);
  });

  test('v4 rollup, slug, and adapter behavior is unchanged', () => {
    expect(betsCore.normalizeSportsbookSlug('Draft Kings')).toBe('draftkings');
    expect(betsCore.normalizeSportsbookSlug('My Local Book')).toBe('my-local-book');
    expect(
      betsCore.buildExternalBetKey({
        userId: 'user-1',
        provider: 'Prize Picks',
        externalBetId: ' slip-99 ',
      }),
    ).toBe('user-1:prizepicks:slip-99');

    const won: BetRecord = {
      id: 'won-1',
      userId: 'user-1',
      sportsbookSlug: 'draftkings',
      kind: 'straight',
      status: 'won',
      stake: 10,
      potentialPayout: 25,
      placedAt: '2026-05-13T00:00:00.000Z',
      settledAt: '2026-05-13T02:00:00.000Z',
    };
    expect(betsCore.calculateBetRollup([won, { ...won, id: 'lost-1', status: 'lost' }])).toEqual({
      totalBets: 2,
      pending: 0,
      won: 1,
      lost: 1,
      pushed: 0,
      voided: 0,
      canceled: 0,
      staked: 20,
      returned: 25,
      netUnits: 5,
      roiPercent: 25,
      winRate: 50,
      currentStreak: { status: 'won', count: 1 },
    });

    expect(
      betsCore.betRecordToDfsEntryInput({
        ...won,
        kind: 'dfs',
        sportsbookSlug: 'Prize Picks',
        dfs: { playTypeId: 'power', displayedMultiplier: 3 },
        legs: [
          {
            legId: 'leg-1',
            playerName: 'A. Example',
            league: 'NBA',
            propType: 'Points',
            line: 20.5,
            direction: 'over',
          },
        ],
      }),
    ).toMatchObject({ entryId: 'won-1', bookId: 'prizepicks', playTypeId: 'power', stake: 10 });
  });

  test('v4 exports still throw plain Error while v5 validation throws TypeError', () => {
    const legacyError = captureError(() => betsCore.probabilityToAmericanOdds(1));
    expect(legacyError).toBeInstanceOf(Error);
    expect((legacyError as Error).name).toBe('Error');
    expect((legacyError as Error).message).toBe('probability must be between 0 and 1');

    const legacyOddsError = captureError(() => betsCore.americanOddsToImpliedProbability(0));
    expect((legacyOddsError as Error).name).toBe('Error');

    const v5Error = captureError(() => combineAmericanOdds([]));
    expect(v5Error).toBeInstanceOf(TypeError);
  });
});
