import { describe, expect, it } from 'vitest';

import { createDfsEngine, DRAFT_BOOK_POLICY_FIXTURES } from '@buzzr/dfs-engine';

import {
  gradeDfsEntriesTool,
  gradeDfsEntryTool,
  listBookPoliciesTool,
  serializeBatchFailure,
  validateDfsEntryTool,
} from '../src/tools/dfs';
import type { ToolResult } from '../src/tools/shared';

function parseResult(result: ToolResult): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function buildEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entryId: 'entry-1',
    bookId: 'prizepicks',
    playTypeId: 'power',
    stake: 10,
    displayedMultiplier: 3,
    legs: [
      {
        legId: 'leg-1',
        playerName: 'LeBron James',
        league: 'NBA',
        propType: 'points',
        line: 25.5,
        direction: 'over',
        actual: 31,
      },
      {
        legId: 'leg-2',
        playerName: 'Stephen Curry',
        league: 'NBA',
        propType: 'points',
        line: 27.5,
        direction: 'over',
        actual: 33,
      },
    ],
    ...overrides,
  };
}

describe('grade_dfs_entry', () => {
  it('settles a winning PrizePicks power entry with the fixed-table payout', async () => {
    const result = await gradeDfsEntryTool.handler(buildEntry());

    expect(result.isError).toBeUndefined();
    const settlement = parseResult(result);
    expect(settlement.status).toBe('won');
    expect(settlement.multiplier).toBe(3);
    expect(settlement.payout).toEqual({ total: 30, withdrawable: 30, bonus: 0 });
    const legs = settlement.legs as Array<Record<string, unknown>>;
    expect(legs).toHaveLength(2);
    expect(legs.every((leg) => leg.status === 'won')).toBe(true);
    expect(Array.isArray(settlement.explanationCodes)).toBe(true);
  });

  it('preserves the complete settlement contract and adds a human explanation', async () => {
    const settlement = parseResult(await gradeDfsEntryTool.handler(buildEntry()));

    expect(settlement).toMatchObject({
      entryId: 'entry-1',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      baseMultiplier: 3,
      profitBoostPct: null,
      validation: { ok: true, errors: [], warnings: [] },
    });
    expect(settlement.sourceRefs).toEqual(expect.any(Array));
    expect(settlement.provenance).toMatchObject({ providers: expect.any(Array) });
    expect(settlement.auditTrail).toEqual(expect.any(Array));
    expect(settlement.explanation).toContain('entry-1 settled as won');
  });

  it('grades a losing leg as a lost all-or-nothing entry', async () => {
    const entry = buildEntry();
    (entry.legs as Array<Record<string, unknown>>)[1].actual = 12;

    const settlement = parseResult(await gradeDfsEntryTool.handler(entry));
    expect(settlement.status).toBe('lost');
    expect((settlement.payout as Record<string, unknown>).total).toBe(0);
  });

  it('merges actualsByLegId from the settlement context', async () => {
    const entry = buildEntry();
    for (const leg of entry.legs as Array<Record<string, unknown>>) {
      delete leg.actual;
    }
    entry.actualsByLegId = { 'leg-1': 31, 'leg-2': 33 };

    const settlement = parseResult(await gradeDfsEntryTool.handler(entry));
    expect(settlement.status).toBe('won');
    expect((settlement.payout as Record<string, unknown>).total).toBe(30);
  });

  it('honors authoritative pre-graded leg statuses without stat values', async () => {
    const input = buildEntry();
    for (const leg of input.legs as Array<Record<string, unknown>>) {
      delete leg.actual;
      leg.status = 'won';
    }

    const settlement = parseResult(await gradeDfsEntryTool.handler(input));
    expect(settlement.status).toBe('won');
    expect(settlement.multiplier).toBe(3);
    expect(settlement.legs).toEqual([
      expect.objectContaining({ status: 'won', actual: null }),
      expect.objectContaining({ status: 'won', actual: null }),
    ]);
  });

  it('rejects schema-invalid input without touching the engine', async () => {
    const result = await gradeDfsEntryTool.handler({ bookId: 'prizepicks' });

    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect((parsed.error as Record<string, unknown>).code).toBe('invalid_input');
  });

  it.each([
    ['non-finite numbers', { stake: Number.POSITIVE_INFINITY }],
    ['invalid placedAt', { placedAt: 'July 16 sometime' }],
    [
      'duplicate leg ids',
      {
        legs: [
          (buildEntry().legs as Array<Record<string, unknown>>)[0],
          (buildEntry().legs as Array<Record<string, unknown>>)[0],
        ],
      },
    ],
    [
      'more than 12 legs',
      {
        legs: Array.from({ length: 13 }, (_, index) => ({
          ...(buildEntry().legs as Array<Record<string, unknown>>)[0],
          legId: `leg-${index}`,
        })),
      },
    ],
  ])('rejects %s at the MCP boundary', async (_label, overrides) => {
    const result = await gradeDfsEntryTool.handler(buildEntry(overrides));

    expect(result.isError).toBe(true);
    expect(parseResult(result).error as Record<string, unknown>).toMatchObject({
      code: 'invalid_input',
    });
  });

  it('does not execute published draft policy fixtures', async () => {
    const result = parseResult(
      await gradeDfsEntryTool.handler(buildEntry({ bookId: 'sleeper', playTypeId: 'over_under' })),
    );

    expect(result.status).toBe('pending');
    expect(result.pendingReasons).toContain('validation_failed');
    expect(result.explanationCodes).toContain('validation.unknown_book_or_play_type');
  });
});

describe('grade_dfs_entries', () => {
  it('settles a bounded batch and returns a versioned, serializable contract', async () => {
    const result = await gradeDfsEntriesTool.handler({
      entries: [buildEntry(), buildEntry({ entryId: 'entry-2' })],
      concurrency: 2,
    });

    expect(result.isError).toBeUndefined();
    const batch = parseResult(result);
    expect(batch).toMatchObject({
      contractVersion: '1',
      summary: { total: 2, settled: 2, pending: 0, failed: 0 },
      failures: [],
      cache: { providerCalls: 0, cacheHits: 0 },
    });
    expect(batch.results).toEqual([
      expect.objectContaining({ entryId: 'entry-1', explanation: expect.any(String) }),
      expect.objectContaining({ entryId: 'entry-2', explanation: expect.any(String) }),
    ]);
  });

  it.each([
    [
      'more than 25 entries',
      {
        entries: Array.from({ length: 26 }, (_, index) =>
          buildEntry({ entryId: `entry-${index}` }),
        ),
      },
    ],
    ['concurrency below 1', { entries: [buildEntry()], concurrency: 0 }],
    ['concurrency above 8', { entries: [buildEntry()], concurrency: 9 }],
    ['duplicate entry ids', { entries: [buildEntry(), buildEntry()] }],
  ])('rejects %s', async (_label, input) => {
    const result = await gradeDfsEntriesTool.handler(input);

    expect(result.isError).toBe(true);
    expect(parseResult(result).error as Record<string, unknown>).toMatchObject({
      code: 'invalid_input',
    });
  });

  it('caps the advertised batch size at 25 entries so valid output remains deliverable', () => {
    const input = {
      entries: Array.from({ length: 26 }, (_, index) => buildEntry({ entryId: `entry-${index}` })),
    };

    expect(gradeDfsEntriesTool.inputSchema.safeParse(input).success).toBe(false);
  });

  it('delivers the maximum valid 25-entry Underdog batch under the result cap', async () => {
    const baseLeg = (buildEntry().legs as Array<Record<string, unknown>>)[0];
    const entries = Array.from({ length: 25 }, (_, entryIndex) =>
      buildEntry({
        entryId: `max-entry-${entryIndex}`,
        bookId: 'underdog',
        playTypeId: 'underdog_standard',
        displayedMultiplier: 100,
        legs: Array.from({ length: 8 }, (_, legIndex) => ({
          ...baseLeg,
          legId: `leg-${entryIndex}-${legIndex}`,
          playerName: `Bounded player ${entryIndex}-${legIndex}`,
          actual: 31,
        })),
      }),
    );

    const result = await gradeDfsEntriesTool.handler({ entries, concurrency: 8 });

    expect(result.isError).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(1_048_576);
    expect(parseResult(result)).toMatchObject({
      summary: { total: 25, settled: 25, pending: 0, failed: 0 },
    });
  });

  it('serializes failures without exposing thrown names, messages, or stacks', () => {
    const serialized = serializeBatchFailure({
      entryId: 'entry-failed',
      index: 3,
      error: new TypeError('policy resolver failed'),
    });

    expect(serialized).toEqual({
      entryId: 'entry-failed',
      index: 3,
      error: {
        code: 'entry_settlement_failed',
        message: 'Entry settlement failed.',
      },
    });
    expect(JSON.stringify(serialized)).not.toContain('stack');
    expect(JSON.stringify(serialized)).not.toContain('policy resolver failed');
    expect(JSON.stringify(serialized)).not.toContain('TypeError');
  });
});

describe('validate_dfs_entry', () => {
  it('reports ok for a well-formed entry', async () => {
    const result = await validateDfsEntryTool.handler({ entry: buildEntry() });

    expect(result.isError).toBeUndefined();
    const validation = parseResult(result);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('returns structured issues for a malformed entry', async () => {
    const validation = parseResult(await validateDfsEntryTool.handler({ entry: { stake: -5 } }));

    expect(validation.ok).toBe(false);
    const errors = validation.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((issue) => typeof issue.code === 'string')).toBe(true);
  });

  it('rejects candidate payloads larger than 64 KiB', async () => {
    const result = await validateDfsEntryTool.handler({
      entry: { entryId: 'entry-1', metadata: 'x'.repeat(70_000) },
    });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});

describe('list_book_policies', () => {
  it('lists executable policies from the engine authoritative snapshots', async () => {
    const result = await listBookPoliciesTool.handler({});

    expect(result.isError).toBeUndefined();
    const listing = parseResult(result);
    const books = listing.books as Array<Record<string, unknown>>;
    expect(listing.count).toBe(books.length);

    const snapshots = createDfsEngine().getBookPolicies();
    const executableBooks = books.filter((book) => book.executable === true);
    expect(executableBooks).toHaveLength(snapshots.length);

    for (const snapshot of snapshots) {
      expect(executableBooks.find((book) => book.id === snapshot.id)).toEqual({
        ...snapshot,
        executable: true,
        source: 'built_in',
      });
    }

    expect(executableBooks.find((book) => book.id === 'prizepicks')).toMatchObject({
      version: '2026-05',
      effectiveFrom: '2026-05-01',
      status: 'experimental',
      verification: { status: 'partial', reviewedAt: '2026-07-16' },
      sources: [
        expect.objectContaining({
          label: expect.any(String),
          url: expect.stringMatching(/^https:\/\/www\.prizepicks\.com\//),
          retrievedAt: '2026-07-16',
        }),
        expect.any(Object),
      ],
      playTypes: [
        expect.objectContaining({
          id: 'power',
          payoutModel: 'fixed-table',
          pickCount: { min: 2, max: 6 },
          allOrNothing: true,
          scaleDisplayedMultiplier: true,
        }),
        expect.objectContaining({
          id: 'flex',
          payoutModel: 'fixed-table',
          pickCount: { min: 3, max: 6 },
          flex: true,
          scaleDisplayedMultiplier: true,
        }),
      ],
    });

    expect(executableBooks.find((book) => book.id === 'underdog')).toMatchObject({
      version: '2026-05',
      effectiveFrom: '2026-05-01',
      status: 'experimental',
      verification: { status: 'unverified', reviewedAt: '2026-07-16' },
      sources: [
        expect.objectContaining({
          label: expect.any(String),
          url: 'https://legal.underdogsports.com/',
          retrievedAt: '2026-07-16',
        }),
      ],
      playTypes: [
        expect.objectContaining({
          id: 'underdog_standard',
          payoutModel: 'fixed-table',
          pickCount: { min: 2, max: 8 },
          allOrNothing: true,
          scaleDisplayedMultiplier: true,
        }),
        expect.objectContaining({
          id: 'underdog_flex',
          payoutModel: 'fixed-table',
          pickCount: { min: 3, max: 8 },
          flex: true,
          scaleDisplayedMultiplier: true,
        }),
      ],
    });
  });

  it('keeps every draft fixture complete and explicitly metadata-only', async () => {
    const listing = parseResult(await listBookPoliciesTool.handler({}));
    const books = listing.books as Array<Record<string, unknown>>;
    const draftBooks = books.filter((book) => book.source === 'draft_fixture');

    expect(draftBooks).toHaveLength(DRAFT_BOOK_POLICY_FIXTURES.length);
    for (const fixture of DRAFT_BOOK_POLICY_FIXTURES) {
      expect(draftBooks.find((book) => book.id === fixture.id)).toEqual({
        id: fixture.id,
        displayName: fixture.displayName,
        version: fixture.version,
        effectiveFrom: fixture.effectiveFrom,
        status: fixture.status,
        verification: fixture.verification ?? null,
        sources: fixture.sources,
        playTypes: fixture.playTypes,
        executable: false,
        source: 'draft_fixture',
      });
    }

    const sleeper = books.find((book) => book.id === 'sleeper');
    expect(sleeper).toBeDefined();
    expect(sleeper?.status).toBe('draft');
    expect(sleeper?.source).toBe('draft_fixture');
    expect(sleeper?.executable).toBe(false);
  });
});
