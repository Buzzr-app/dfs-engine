import { describe, expect, test } from 'vitest';
import {
  createDfsEngine,
  type DfsBookPolicySnapshot,
  type DfsEntryInput,
  type DfsLegInput,
} from '../src';

const PRIZEPICKS_PAYOUTS_URL = 'https://www.prizepicks.com/help-center/payouts';
const PRIZEPICKS_OUTCOMES_URL = 'https://www.prizepicks.com/help-center/potential-outcomes';
const UNDERDOG_LEGAL_URL = 'https://legal.underdogsports.com/';

function leg(index: number): DfsLegInput {
  return {
    legId: `leg-${index}`,
    playerName: `Player ${index}`,
    league: 'NBA',
    propType: 'Points',
    line: 20.5,
    direction: 'over',
  };
}

function entry(input: {
  bookId: string;
  playTypeId: string;
  pickCount: number;
  displayedMultiplier: number;
  placedAt: string;
}): DfsEntryInput {
  return {
    entryId: `${input.bookId}-${input.playTypeId}-${input.placedAt}`,
    bookId: input.bookId,
    playTypeId: input.playTypeId,
    stake: 10,
    displayedMultiplier: input.displayedMultiplier,
    placedAt: input.placedAt,
    legs: Array.from({ length: input.pickCount }, (_, index) => leg(index + 1)),
  };
}

function lookup(input: {
  playTypeId: 'power' | 'flex';
  pickCount: number;
  hits: number;
  displayedMultiplier: number;
  placedAt: string;
}) {
  const engine = createDfsEngine();
  const placedEntry = entry({
    bookId: 'prizepicks',
    playTypeId: input.playTypeId,
    pickCount: input.pickCount,
    displayedMultiplier: input.displayedMultiplier,
    placedAt: input.placedAt,
  });
  return engine.lookupPayout({
    bookId: 'prizepicks',
    playTypeId: input.playTypeId,
    stake: 10,
    displayedMultiplier: input.displayedMultiplier,
    pickCount: input.pickCount,
    hits: input.hits,
    losses: input.pickCount - input.hits,
    entry: placedEntry,
  });
}

describe('built-in policy truthfulness', () => {
  test('preserves the May PrizePicks compatibility tables for historical entries', () => {
    expect(
      lookup({
        playTypeId: 'power',
        pickCount: 3,
        hits: 3,
        displayedMultiplier: 5,
        placedAt: '2026-07-01T23:59:59.999Z',
      }),
    ).toMatchObject({ multiplier: 5, payoutTable: { version: '2026-05', sources: [] } });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 3,
        hits: 3,
        displayedMultiplier: 2.25,
        placedAt: '2026-06-01',
      }),
    ).toMatchObject({ multiplier: 2.25 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 3,
        hits: 2,
        displayedMultiplier: 2.25,
        placedAt: '2026-06-01',
      }),
    ).toMatchObject({ multiplier: 1.25 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 4,
        hits: 4,
        displayedMultiplier: 5,
        placedAt: '2026-06-01',
      }),
    ).toMatchObject({ multiplier: 5 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 6,
        hits: 5,
        displayedMultiplier: 25,
        placedAt: '2026-06-01',
      }),
    ).toMatchObject({ multiplier: 1.75 });
  });

  test('uses the current standard Player Pick tables beginning July 2, 2026', () => {
    expect(
      lookup({
        playTypeId: 'power',
        pickCount: 3,
        hits: 3,
        displayedMultiplier: 6,
        placedAt: '2026-07-02T00:00:00.000Z',
      }),
    ).toMatchObject({
      multiplier: 6,
      payoutTable: {
        version: '2026-07-02-player-picks',
        effectiveFrom: '2026-07-02',
        sourceNotes: expect.arrayContaining([
          expect.stringContaining(PRIZEPICKS_PAYOUTS_URL),
          expect.stringContaining(PRIZEPICKS_OUTCOMES_URL),
        ]),
        sources: expect.arrayContaining([
          expect.objectContaining({ url: PRIZEPICKS_PAYOUTS_URL, retrievedAt: '2026-07-16' }),
          expect.objectContaining({ url: PRIZEPICKS_OUTCOMES_URL, retrievedAt: '2026-07-16' }),
        ]),
      },
    });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 3,
        hits: 3,
        displayedMultiplier: 3,
        placedAt: '2026-07-16',
      }),
    ).toMatchObject({ multiplier: 3 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 3,
        hits: 2,
        displayedMultiplier: 3,
        placedAt: '2026-07-16',
      }),
    ).toMatchObject({ multiplier: 1 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 4,
        hits: 4,
        displayedMultiplier: 6,
        placedAt: '2026-07-16',
      }),
    ).toMatchObject({ multiplier: 6 });
    expect(
      lookup({
        playTypeId: 'flex',
        pickCount: 6,
        hits: 5,
        displayedMultiplier: 25,
        placedAt: '2026-07-16',
      }),
    ).toMatchObject({ multiplier: 2 });
  });

  test('returns deeply immutable authoritative policy snapshots', () => {
    const engine = createDfsEngine();
    const policies = engine.getBookPolicies();
    const prizePicks = policies.find((policy) => policy.id === 'prizepicks');
    const underdog = policies.find((policy) => policy.id === 'underdog');

    expect(policies.map((policy) => policy.id)).toEqual(['prizepicks', 'underdog']);
    expect(prizePicks).toMatchObject({
      status: 'experimental',
      verification: { status: 'partial', reviewedAt: '2026-07-16' },
      sources: expect.arrayContaining([
        expect.objectContaining({ url: PRIZEPICKS_PAYOUTS_URL, retrievedAt: '2026-07-16' }),
        expect.objectContaining({ url: PRIZEPICKS_OUTCOMES_URL, retrievedAt: '2026-07-16' }),
      ]),
    });
    expect(underdog).toMatchObject({
      status: 'experimental',
      verification: { status: 'unverified', reviewedAt: '2026-07-16' },
      sources: [expect.objectContaining({ url: UNDERDOG_LEGAL_URL, retrievedAt: '2026-07-16' })],
    });
    expect(Object.isFrozen(policies)).toBe(true);
    expect(Object.isFrozen(prizePicks)).toBe(true);
    expect(Object.isFrozen(prizePicks?.sources)).toBe(true);
    expect(Object.isFrozen(prizePicks?.sources[0])).toBe(true);
    expect(Object.isFrozen(prizePicks?.playTypes[0]?.pickCount)).toBe(true);
    expect(Object.isFrozen(prizePicks?.verification)).toBe(true);
    expect(Object.isFrozen(prizePicks?.verification?.notes)).toBe(true);

    expect(() => {
      (prizePicks as DfsBookPolicySnapshot & { status: string }).status = 'stable';
    }).toThrow(TypeError);
    expect(() => {
      (prizePicks?.verification?.notes as string[]).push('mutated');
    }).toThrow(TypeError);
    expect(engine.getBookPolicies().find((policy) => policy.id === 'prizepicks')).toMatchObject({
      status: 'experimental',
      verification: { status: 'partial' },
    });
  });

  test('propagates policy verification and caps settlement confidence', async () => {
    const engine = createDfsEngine();
    const prizePicksEntry = entry({
      bookId: 'prizepicks',
      playTypeId: 'power',
      pickCount: 3,
      displayedMultiplier: 6,
      placedAt: '2026-07-16',
    });
    const prizePicks = await engine.settleEntry(prizePicksEntry, {
      actualsByLegId: Object.fromEntries(prizePicksEntry.legs.map((item) => [item.legId, 30])),
    });

    expect(prizePicks).toMatchObject({
      status: 'won',
      effectiveMultiplier: 6,
      policyStatus: 'experimental',
      policyVerification: { status: 'partial', reviewedAt: '2026-07-16' },
      confidence: 'medium',
      explanationCodes: expect.arrayContaining([
        'policy.status.experimental',
        'policy.verification.partial',
      ]),
    });

    const underdogEntry = entry({
      bookId: 'underdog',
      playTypeId: 'underdog_standard',
      pickCount: 2,
      displayedMultiplier: 3,
      placedAt: '2026-07-16',
    });
    const underdog = await engine.settleEntry(underdogEntry, {
      actualsByLegId: Object.fromEntries(underdogEntry.legs.map((item) => [item.legId, 30])),
    });

    expect(underdog).toMatchObject({
      status: 'won',
      policyStatus: 'experimental',
      policyVerification: { status: 'unverified', reviewedAt: '2026-07-16' },
      confidence: 'low',
      sourceRefs: [expect.objectContaining({ url: UNDERDOG_LEGAL_URL })],
      explanationCodes: expect.arrayContaining([
        'policy.status.experimental',
        'policy.verification.unverified',
      ]),
    });
  });
});
