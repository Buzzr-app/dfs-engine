import { describe, expect, it } from 'vitest';

import { gradeDfsEntryTool, listBookPoliciesTool, validateDfsEntryTool } from '../src/tools/dfs';
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

  it('rejects schema-invalid input without touching the engine', async () => {
    const result = await gradeDfsEntryTool.handler({ bookId: 'prizepicks' });

    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect((parsed.error as Record<string, unknown>).code).toBe('invalid_input');
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
});

describe('list_book_policies', () => {
  it('lists built-in books and draft fixtures with play types', async () => {
    const result = await listBookPoliciesTool.handler({});

    expect(result.isError).toBeUndefined();
    const listing = parseResult(result);
    const books = listing.books as Array<Record<string, unknown>>;
    expect(listing.count).toBe(books.length);

    const prizepicks = books.find((book) => book.id === 'prizepicks');
    expect(prizepicks).toBeDefined();
    expect(prizepicks?.source).toBe('built_in');
    const playTypeIds = (prizepicks?.playTypes as Array<Record<string, unknown>>).map(
      (playType) => playType.id,
    );
    expect(playTypeIds).toEqual(expect.arrayContaining(['power', 'flex']));

    const sleeper = books.find((book) => book.id === 'sleeper');
    expect(sleeper).toBeDefined();
    expect(sleeper?.status).toBe('draft');
    expect(sleeper?.source).toBe('draft_fixture');
  });
});
