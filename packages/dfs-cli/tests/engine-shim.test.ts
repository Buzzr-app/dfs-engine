import { describe, expect, test } from 'vitest';
import { createMockStatProviderFromMap } from '../src/engine-shim';

describe('@buzzr/dfs-cli engine-shim', () => {
  test('returns an empty array when a leg has no game-log entry in the map', async () => {
    const provider = createMockStatProviderFromMap({}, 'shim-test');
    expect(provider.id).toBe('shim-test');
    const rows = await provider.getGameLog!({
      leg: {
        legId: 'missing-leg',
        playerName: 'Nobody',
        playerId: null,
        league: 'NBA',
        propType: 'Points',
        line: 10,
        direction: 'over',
        actual: null,
        status: 'pending',
        gameDate: '2026-05-07T00:00:00.000Z',
      },
      entry: {
        entryId: 'shim-entry',
        bookId: 'prizepicks',
        playTypeId: 'power',
        stake: 10,
        displayedMultiplier: 3,
        legs: [],
      },
      context: {},
    });
    expect(rows).toEqual([]);
  });
});
