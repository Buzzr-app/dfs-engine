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
});
