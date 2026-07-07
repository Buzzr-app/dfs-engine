import { predictGameWithDiagnostics, resolveBuzzScores } from '@buzzr/entertainment-engine';
import { describe, expect, it } from 'vitest';

import { createPredictGameBuzzTool, createRankGamesTool, rankGamesTool } from '../src/tools/buzz';
import type { EntertainmentEngineModule } from '../src/tools/buzz';
import type { ToolResult } from '../src/tools/shared';

function parseResult(result: ToolResult): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

const baseEngineModule: EntertainmentEngineModule = {
  predictGameWithDiagnostics,
  resolveBuzzScores,
};

const nbaGame = {
  league: 'NBA',
  homeTeam: 'Lakers',
  awayTeam: 'Celtics',
  startsAt: '2026-07-10T19:30:00-04:00',
  odds: { spread: -1.5, overUnder: 228.5 },
  narratives: { isRivalry: true, rivalryIntensity: 3 as const },
};

describe('predict_game_buzz', () => {
  const tool = createPredictGameBuzzTool(baseEngineModule);

  it('predicts a scheduled game and returns score, confidence, and factors', async () => {
    const result = await tool.handler(nbaGame);

    expect(result.isError).toBeUndefined();
    const prediction = parseResult(result);
    expect(typeof prediction.score).toBe('number');
    expect(prediction.score as number).toBeGreaterThanOrEqual(1);
    expect(prediction.score as number).toBeLessThanOrEqual(10);
    expect(prediction.confidence as number).toBeGreaterThan(0);
    expect(prediction.confidence as number).toBeLessThanOrEqual(1);
    expect(Array.isArray(prediction.factors)).toBe(true);
    expect((prediction.factors as unknown[]).length).toBeGreaterThan(0);
    expect(typeof prediction.modelVersion).toBe('string');
    expect(prediction.usedOddsData).toBe(true);

    const resolved = prediction.resolved as Record<string, unknown>;
    expect(typeof resolved.predictedEntertainmentScore).toBe('number');
  });

  it('returns an error result for in-progress games instead of throwing', async () => {
    const result = await tool.handler({ ...nbaGame, status: 'in_progress' });

    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect((parsed.error as Record<string, unknown>).code).toBe('prediction_unavailable');
  });

  it('rejects input missing required fields', async () => {
    const result = await tool.handler({ league: 'NBA' });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});

describe('rank_games', () => {
  const rankInput = {
    games: [
      { ...nbaGame, id: 'game-1', baseScore: 7.5 },
      {
        id: 'game-2',
        league: 'MLB',
        homeTeam: 'Yankees',
        awayTeam: 'Red Sox',
        startsAt: '2026-07-10T19:05:00-04:00',
      },
    ],
    profile: { favoriteTeams: ['Lakers'], leagueAffinity: { NBA: 0.8 } },
  };

  it('returns engine_capability_missing when rankGamesForUser is not exported', async () => {
    const tool = createRankGamesTool(baseEngineModule);
    const result = await tool.handler(rankInput);

    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect((parsed.error as Record<string, unknown>).code).toBe('engine_capability_missing');
  });

  it('ranks via the engine export and attaches explanations when available', async () => {
    const seen: { games?: readonly unknown[]; profile?: unknown; options?: unknown } = {};
    const stubModule: EntertainmentEngineModule = {
      ...baseEngineModule,
      rankGamesForUser: (games: readonly unknown[], profile: unknown, options?: unknown) => {
        seen.games = games;
        seen.profile = profile;
        seen.options = options;
        return games.map((entry, index) => ({
          id: (entry as Record<string, unknown>).id,
          totalScore: 9 - index,
          factors: [],
        }));
      },
      explainRecommendation: (ranked: unknown) => ({
        totalScore: (ranked as Record<string, unknown>).totalScore,
      }),
    };

    const tool = createRankGamesTool(stubModule);
    const result = await tool.handler({ ...rankInput, limit: 2 });

    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    expect(parsed.count).toBe(2);
    const rankedGames = parsed.rankedGames as Array<Record<string, unknown>>;
    expect(rankedGames[0].id).toBe('game-1');
    expect(rankedGames[0].explanation).toEqual({ totalScore: 9 });

    expect(seen.options).toEqual({ limit: 2 });
    expect(seen.profile).toEqual(rankInput.profile);
    const entries = seen.games as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0].baseScore).toBe(7.5);
    expect((entries[0].game as Record<string, unknown>).homeTeam).toBe('Lakers');
    expect((entries[1].context as Record<string, unknown>).odds).toBeNull();
  });

  it('default tool either ranks games or degrades with engine_capability_missing', async () => {
    // The live engine build may or may not export rankGamesForUser yet
    // (v5 recommendation API). Both behaviors are contractually valid here.
    const result = await rankGamesTool.handler(rankInput);
    const parsed = parseResult(result);

    if (result.isError) {
      expect((parsed.error as Record<string, unknown>).code).toBe('engine_capability_missing');
    } else {
      expect(Array.isArray(parsed.rankedGames)).toBe(true);
    }
  });

  it('rejects an empty games array', async () => {
    const tool = createRankGamesTool(baseEngineModule);
    const result = await tool.handler({ games: [] });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});
