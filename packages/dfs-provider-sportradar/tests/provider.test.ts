import { describe, expect, test } from 'vitest';
import { createDfsEngine } from '@buzzr/dfs-engine';
import {
  createSportradarStatProvider,
  sportradarRowToGameLog,
  type SportradarBasketballStatLine,
} from '../src';

const row: SportradarBasketballStatLine = {
  game_id: 'sr:game-1',
  scheduled: '2026-05-07T00:00:00.000Z',
  minutes: '36:00',
  points: 31,
  rebounds: 4,
  assists: 8,
  steals: 2,
  blocks: 1,
  turnovers: 3,
  three_points_made: 5,
};

describe('@buzzr/dfs-provider-sportradar', () => {
  test('sportradarRowToGameLog normalizes numeric fields to strings on PlayerGameLogEntryShape', () => {
    const log = sportradarRowToGameLog(row);
    expect(log.date).toBe('2026-05-07T00:00:00.000Z');
    expect(log.points).toBe('31');
    expect(log.threeP).toBe('5');
    expect(log.minutes).toBe('36:00');
  });

  test('createSportradarStatProvider wraps caller-supplied loader and grades through the engine', async () => {
    const provider = createSportradarStatProvider({
      getGameLog: async ({ league, playerName }) => {
        expect(league).toBe('NBA');
        expect(playerName).toBe('SR Player');
        return [row];
      },
    });
    const engine = createDfsEngine({ statProviders: [provider] });

    const result = await engine.extractLegStat(
      {
        legId: 'leg-1',
        playerName: 'SR Player',
        playerId: 'sr:athlete-1',
        league: 'NBA',
        propType: 'Points',
        line: 25.5,
        direction: 'over',
        gameDate: '2026-05-07T00:00:00.000Z',
      },
      { statProviderId: 'sportradar' },
      {
        entryId: 'entry-1',
        bookId: 'prizepicks',
        playTypeId: 'power',
        stake: 10,
        displayedMultiplier: 3,
        legs: [],
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: 31,
      provenance: { source: 'stat-provider', providerId: 'sportradar' },
    });
  });

  test('coerces missing numeric fields to empty strings without throwing', () => {
    const partial: SportradarBasketballStatLine = { scheduled: '2026-05-07T00:00:00.000Z' };
    const log = sportradarRowToGameLog(partial);
    expect(log.points).toBe('');
    expect(log.rebounds).toBe('');
  });
});
