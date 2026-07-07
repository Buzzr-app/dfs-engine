import { describe, expect, test } from 'vitest';
import {
  createDfsEngine,
  defineBookPolicy,
  defineStatProvider,
  DfsEngineInvariantError,
  type DfsBookPolicy,
  type DfsEntryInput,
  type DfsLegInput,
  type PlayerGameLogEntryShape,
} from '../src';

const gameLogRow = (overrides: Partial<PlayerGameLogEntryShape> = {}): PlayerGameLogEntryShape => ({
  date: '2026-07-01T00:00:00.000Z',
  minutes: '34:12',
  points: '26',
  rebounds: '8',
  assists: '6',
  steals: '1',
  blocks: '0',
  turnovers: '2',
  threeP: '4',
  ...overrides,
});

const leg = (overrides: Partial<DfsLegInput> = {}): DfsLegInput => ({
  legId: 'leg-1',
  playerName: 'A. Example',
  league: 'NBA',
  propType: 'Points',
  line: 20.5,
  direction: 'over',
  gameDate: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const singleLegBook: DfsBookPolicy = defineBookPolicy({
  id: 'batch-book',
  displayName: 'Batch Book',
  version: 'test-1',
  effectiveFrom: '2026-07-01',
  status: 'draft',
  sources: [{ label: 'Batch settlement test policy' }],
  playTypes: [
    {
      id: 'single',
      displayName: 'Single',
      payoutModel: 'displayed-multiplier',
      pickCount: { min: 1, max: 6 },
    },
  ],
  tiePolicy: { type: 'push' },
  dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
  pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
  payoutSplit: { type: 'all_withdrawable' },
  validation: { duplicatePlayers: 'allow', sameTeam: 'allow', sameGame: 'allow' },
});

const entry = (overrides: Partial<DfsEntryInput> = {}): DfsEntryInput => ({
  entryId: 'entry-1',
  bookId: 'batch-book',
  playTypeId: 'single',
  stake: 10,
  displayedMultiplier: 2,
  legs: [leg()],
  ...overrides,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('v5 batch settlement (engine.settleEntries)', () => {
  test('settles entries and returns results in input order', async () => {
    const engine = createDfsEngine({ bookPolicies: [singleLegBook] });
    const inputs = [
      entry({ entryId: 'batch-a', legs: [leg({ legId: 'a-1', actual: 30 })] }),
      entry({ entryId: 'batch-b', legs: [leg({ legId: 'b-1', actual: 10 })] }),
      entry({ entryId: 'batch-c', legs: [leg({ legId: 'c-1', actual: 25 })] }),
    ];

    const batch = await engine.settleEntries(inputs);

    expect(batch.results.map((result) => result.entryId)).toEqual([
      'batch-a',
      'batch-b',
      'batch-c',
    ]);
    expect(batch.results.map((result) => result.status)).toEqual(['won', 'lost', 'won']);
    expect(batch.summary).toEqual({ total: 3, settled: 3, pending: 0, failed: 0 });
    expect(batch.failures).toEqual([]);
    expect(batch.cache).toEqual({ providerCalls: 0, cacheHits: 0 });
  });

  test('dedupes getGameLog provider calls across entries for the same player/game/league key', async () => {
    let calls = 0;
    const provider = defineStatProvider({
      id: 'counting-log',
      getGameLog() {
        calls += 1;
        return [gameLogRow()];
      },
    });
    const engine = createDfsEngine({ bookPolicies: [singleLegBook], statProviders: [provider] });

    const inputs = [
      entry({ entryId: 'dedup-a', legs: [leg({ legId: 'a-1' })] }),
      entry({
        entryId: 'dedup-b',
        legs: [leg({ legId: 'b-1', propType: 'Rebounds', line: 7.5 })],
      }),
      entry({ entryId: 'dedup-c', legs: [leg({ legId: 'c-1' })] }),
    ];

    const batch = await engine.settleEntries(inputs);

    expect(calls).toBe(1);
    expect(batch.cache).toEqual({ providerCalls: 1, cacheHits: 2 });
    expect(batch.results.map((result) => result.status)).toEqual(['won', 'won', 'won']);
    // First entry invoked the provider; the rest were served from cache.
    expect(batch.results[0]?.explanationCodes).not.toContain('batch_cache_hit');
    expect(batch.results[1]?.explanationCodes).toContain('batch_cache_hit');
    expect(batch.results[2]?.explanationCodes).toContain('batch_cache_hit');
  });

  test('does not dedupe different players, games, or leagues', async () => {
    let calls = 0;
    const provider = defineStatProvider({
      id: 'counting-log',
      getGameLog() {
        calls += 1;
        return [gameLogRow()];
      },
    });
    const engine = createDfsEngine({ bookPolicies: [singleLegBook], statProviders: [provider] });

    const batch = await engine.settleEntries([
      entry({ entryId: 'k-a', legs: [leg({ legId: 'a-1' })] }),
      entry({
        entryId: 'k-b',
        legs: [leg({ legId: 'b-1', playerName: 'B. Example' })],
      }),
      entry({
        entryId: 'k-c',
        legs: [leg({ legId: 'c-1', gameDate: '2026-07-02T00:00:00.000Z' })],
      }),
    ]);

    expect(calls).toBe(3);
    expect(batch.cache).toEqual({ providerCalls: 3, cacheHits: 0 });
  });

  test('dedupes extractStat provider calls per player/game/league/prop key', async () => {
    let calls = 0;
    const provider = defineStatProvider({
      id: 'counting-stat',
      extractStat() {
        calls += 1;
        return { ok: true as const, actual: 28 };
      },
    });
    const engine = createDfsEngine({ bookPolicies: [singleLegBook], statProviders: [provider] });

    const batch = await engine.settleEntries([
      entry({ entryId: 'stat-a', legs: [leg({ legId: 'a-1' })] }),
      entry({ entryId: 'stat-b', legs: [leg({ legId: 'b-1' })] }),
    ]);

    expect(calls).toBe(1);
    expect(batch.cache).toEqual({ providerCalls: 1, cacheHits: 1 });
    expect(batch.results.map((result) => result.status)).toEqual(['won', 'won']);
  });

  test('captures per-entry failures without aborting the batch', async () => {
    const explodingBook = defineBookPolicy({
      ...singleLegBook,
      id: 'exploding-book',
      playTypes: [
        {
          id: 'single',
          displayName: 'Single',
          payoutModel: 'custom',
          pickCount: { min: 1, max: 6 },
        },
      ],
      payoutResolver: ({ entry: resolverEntry }) => {
        if (resolverEntry.metadata?.explode) {
          throw new Error('resolver exploded');
        }
        return { multiplier: 2 };
      },
    });
    const engine = createDfsEngine({ bookPolicies: [explodingBook] });

    const batch = await engine.settleEntries([
      entry({ entryId: 'ok-1', bookId: 'exploding-book', legs: [leg({ legId: 'a-1', actual: 30 })] }),
      entry({
        entryId: 'boom',
        bookId: 'exploding-book',
        metadata: { explode: true },
        legs: [leg({ legId: 'b-1', actual: 30 })],
      }),
      entry({ entryId: 'ok-2', bookId: 'exploding-book', legs: [leg({ legId: 'c-1', actual: 30 })] }),
    ]);

    expect(batch.results.map((result) => result.entryId)).toEqual(['ok-1', 'ok-2']);
    expect(batch.failures).toHaveLength(1);
    expect(batch.failures[0]).toMatchObject({ entryId: 'boom', index: 1 });
    expect(batch.failures[0]?.error).toBeInstanceOf(Error);
    expect(batch.failures[0]?.error.message).toBe('resolver exploded');
    expect(batch.summary).toEqual({ total: 3, settled: 2, pending: 0, failed: 1 });
  });

  test('counts pending results separately in the summary', async () => {
    const engine = createDfsEngine({ bookPolicies: [singleLegBook] });

    const batch = await engine.settleEntries([
      entry({ entryId: 'settled', legs: [leg({ legId: 'a-1', actual: 30 })] }),
      entry({ entryId: 'no-data', legs: [leg({ legId: 'b-1' })] }),
    ]);

    expect(batch.results.map((result) => result.status)).toEqual(['won', 'pending']);
    expect(batch.summary).toEqual({ total: 2, settled: 1, pending: 1, failed: 0 });
  });

  test('runs sequentially by default and honors the concurrency option', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const makeProvider = () =>
      defineStatProvider({
        id: 'slow-log',
        async getGameLog() {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await sleep(10);
          inFlight -= 1;
          return [gameLogRow()];
        },
      });
    const inputs = ['w', 'x', 'y', 'z'].map((name, index) =>
      entry({
        entryId: `conc-${name}`,
        legs: [leg({ legId: `${name}-1`, playerName: `Player ${index}` })],
      }),
    );

    const sequentialEngine = createDfsEngine({
      bookPolicies: [singleLegBook],
      statProviders: [makeProvider()],
    });
    await sequentialEngine.settleEntries(inputs);
    expect(maxInFlight).toBe(1);

    maxInFlight = 0;
    const concurrentEngine = createDfsEngine({
      bookPolicies: [singleLegBook],
      statProviders: [makeProvider()],
    });
    const batch = await concurrentEngine.settleEntries(inputs, { concurrency: 2 });
    expect(maxInFlight).toBe(2);
    expect(batch.results.map((result) => result.entryId)).toEqual([
      'conc-w',
      'conc-x',
      'conc-y',
      'conc-z',
    ]);
  });

  test('dedupes in-flight provider calls under concurrency', async () => {
    let calls = 0;
    const provider = defineStatProvider({
      id: 'slow-shared-log',
      async getGameLog() {
        calls += 1;
        await sleep(10);
        return [gameLogRow()];
      },
    });
    const engine = createDfsEngine({ bookPolicies: [singleLegBook], statProviders: [provider] });

    const batch = await engine.settleEntries(
      [
        entry({ entryId: 'flight-a', legs: [leg({ legId: 'a-1' })] }),
        entry({ entryId: 'flight-b', legs: [leg({ legId: 'b-1' })] }),
      ],
      { concurrency: 2 },
    );

    expect(calls).toBe(1);
    expect(batch.cache).toEqual({ providerCalls: 1, cacheHits: 1 });
  });

  test('rejects invalid concurrency values', async () => {
    const engine = createDfsEngine({ bookPolicies: [singleLegBook] });

    await expect(engine.settleEntries([entry()], { concurrency: 0 })).rejects.toBeInstanceOf(
      DfsEngineInvariantError,
    );
    await expect(engine.settleEntries([entry()], { concurrency: 1.5 })).rejects.toBeInstanceOf(
      DfsEngineInvariantError,
    );
  });

  test('handles an empty batch', async () => {
    const engine = createDfsEngine();

    const batch = await engine.settleEntries([]);

    expect(batch.results).toEqual([]);
    expect(batch.failures).toEqual([]);
    expect(batch.summary).toEqual({ total: 0, settled: 0, pending: 0, failed: 0 });
    expect(batch.cache).toEqual({ providerCalls: 0, cacheHits: 0 });
  });

  test('leaves settleEntry single-entry behavior untouched (no cache, no batch codes)', async () => {
    let calls = 0;
    const provider = defineStatProvider({
      id: 'counting-log',
      getGameLog() {
        calls += 1;
        return [gameLogRow()];
      },
    });
    const engine = createDfsEngine({ bookPolicies: [singleLegBook], statProviders: [provider] });

    const first = await engine.settleEntry(entry({ entryId: 'solo-1', legs: [leg({ legId: 'a-1' })] }));
    const second = await engine.settleEntry(entry({ entryId: 'solo-2', legs: [leg({ legId: 'b-1' })] }));

    expect(calls).toBe(2);
    expect(first.explanationCodes).not.toContain('batch_cache_hit');
    expect(second.explanationCodes).not.toContain('batch_cache_hit');
  });
});
