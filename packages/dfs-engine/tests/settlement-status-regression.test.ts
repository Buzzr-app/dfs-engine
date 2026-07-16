import { describe, expect, test } from 'vitest';

import { createDfsEngine, type DfsEntryInput, type DfsLegInput } from '../src';

function leg(overrides: Partial<DfsLegInput> = {}): DfsLegInput {
  return {
    legId: 'leg-1',
    playerName: 'Regression Guard',
    league: 'NBA',
    propType: 'points',
    line: 20.5,
    direction: 'over',
    ...overrides,
  };
}

function entry(overrides: Partial<DfsEntryInput> = {}): DfsEntryInput {
  return {
    entryId: 'entry-1',
    bookId: 'prizepicks',
    playTypeId: 'power',
    stake: 10,
    displayedMultiplier: 3,
    placedAt: '2026-07-16T00:00:00.000Z',
    legs: [leg(), leg({ legId: 'leg-2' })],
    ...overrides,
  };
}

describe('authoritative leg status regressions', () => {
  test('refunds a two-pick PrizePicks Power entry after one DNP', async () => {
    const result = await createDfsEngine().settleEntry(
      entry({
        legs: [leg({ status: 'dnp' }), leg({ legId: 'leg-2', status: 'won' })],
      }),
    );

    expect(result).toMatchObject({
      status: 'void',
      multiplier: 1,
      effectiveMultiplier: 1,
      payout: { total: 10, withdrawable: 10, bonus: 0 },
      legs: [
        { legId: 'leg-1', status: 'dnp' },
        { legId: 'leg-2', status: 'won' },
      ],
    });
    expect(result.explanationCodes).toContain('refund_below_minimum');
    expect(result.auditTrail.at(-1)?.code).toBe('settlement.void');
  });

  test('settles explicit won and lost statuses without requiring stat data', async () => {
    const engine = createDfsEngine();

    const won = await engine.settleEntry(
      entry({
        legs: [leg({ status: 'won' }), leg({ legId: 'leg-2', status: 'won' })],
      }),
    );
    expect(won).toMatchObject({
      status: 'won',
      multiplier: 3,
      legs: [
        { status: 'won', actual: null, provider: { source: 'status' } },
        { status: 'won', actual: null, provider: { source: 'status' } },
      ],
    });

    const lost = await engine.settleEntry(entry(), {
      legStatusesByLegId: { 'leg-1': 'won', 'leg-2': 'lost' },
    });
    expect(lost).toMatchObject({
      status: 'lost',
      payout: { total: 0, withdrawable: 0, bonus: 0 },
      legs: [{ status: 'won' }, { status: 'lost' }],
    });
  });

  test('settles the current two-pick PrizePicks Power tie outcomes', async () => {
    const engine = createDfsEngine();

    const wonWithTie = await engine.settleEntry(entry(), {
      legStatusesByLegId: { 'leg-1': 'won', 'leg-2': 'push' },
    });
    expect(wonWithTie).toMatchObject({
      status: 'won',
      multiplier: 1.5,
      effectiveMultiplier: 1.5,
      payout: { total: 15, withdrawable: 15, bonus: 0 },
      legs: [{ status: 'won' }, { status: 'push' }],
      payoutTable: { version: '2026-07-02-player-picks' },
    });

    const lostWithTie = await engine.settleEntry(entry(), {
      legStatusesByLegId: { 'leg-1': 'lost', 'leg-2': 'push' },
    });
    expect(lostWithTie).toMatchObject({
      status: 'lost',
      multiplier: 0,
      payout: { total: 0, withdrawable: 0, bonus: 0 },
      legs: [{ status: 'lost' }, { status: 'push' }],
    });
  });

  test('never turns an unpriced zero-loss outcome into a financial loss', async () => {
    const engine = createDfsEngine();
    const prizePicks = await engine.settleEntry(
      entry({
        entryId: 'unpriced-prizepicks',
        displayedMultiplier: 6,
        legs: [leg(), leg({ legId: 'leg-2' }), leg({ legId: 'leg-3' })],
      }),
      {
        legStatusesByLegId: { 'leg-1': 'won', 'leg-2': 'push', 'leg-3': 'push' },
      },
    );
    expect(prizePicks).toMatchObject({
      status: 'pending',
      multiplier: 0,
      payout: { total: 0, withdrawable: 0, bonus: 0 },
      pendingReasons: ['missing_payout_table_row'],
      explanationCodes: expect.arrayContaining(['settlement.no_payout_table_row']),
    });

    const underdog = await engine.settleEntry(
      entry({
        entryId: 'unpriced-underdog',
        bookId: 'underdog',
        playTypeId: 'underdog_standard',
      }),
      { legStatusesByLegId: { 'leg-1': 'won', 'leg-2': 'push' } },
    );
    expect(underdog).toMatchObject({
      status: 'pending',
      payout: { total: 0, withdrawable: 0, bonus: 0 },
      pendingReasons: ['missing_payout_table_row'],
    });
  });
});
