import * as entertainmentEngine from '@buzzr/entertainment-engine';
import type { EntertainmentGameInput, PredictionContext } from '@buzzr/entertainment-engine';
import { z } from 'zod';

import {
  boundedArray,
  boundedIdentifier,
  boundedLabel,
  boundedRecord,
  finiteNumber,
  isoTimestamp,
  nonNegativeFiniteNumber,
} from './schemas';
import { defineTool, errorResult, jsonResult } from './shared';
import type { BuzzrToolDefinition } from './shared';

/**
 * The slice of @buzzr/entertainment-engine this module consumes. The v5
 * recommendation exports (rankGamesForUser / explainRecommendation) are
 * feature-detected at call time so this package degrades gracefully when
 * running against a pre-v5 build of the engine.
 */
export type EntertainmentEngineModule = {
  predictGameWithDiagnostics: typeof entertainmentEngine.predictGameWithDiagnostics;
  resolveBuzzScores: typeof entertainmentEngine.resolveBuzzScores;
  rankGamesForUser?: unknown;
  explainRecommendation?: unknown;
};

const defaultEngineModule = entertainmentEngine as unknown as EntertainmentEngineModule;

type RankGamesFn = (
  games: readonly unknown[],
  profile: unknown,
  options?: { limit?: number },
) => unknown;

type ExplainFn = (rankedGame: unknown) => unknown;

const statusSchema = z
  .enum(['scheduled', 'in_progress', 'final', 'postponed', 'cancelled'])
  .describe('Game status. The model only predicts games that are not in progress.');

const oddsSchema = z
  .object({
    spread: finiteNumber.nullish().describe('Point spread relative to the home team.'),
    overUnder: finiteNumber.nullish(),
    homeMoneyline: finiteNumber.nullish(),
    awayMoneyline: finiteNumber.nullish(),
  })
  .describe('Betting-market context for the game.');

const teamPairSchema = z.object({
  home: finiteNumber.nullish(),
  away: finiteNumber.nullish(),
});

const narrativesSchema = z
  .object({
    isRivalry: z.boolean().optional(),
    rivalryIntensity: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    playerVsFormerTeam: z.boolean().optional(),
    hasDebut: z.boolean().optional(),
  })
  .describe('Narrative flags that boost buzz (rivalries, debuts, revenge games).');

const engagementSchema = z.object({
  fireCount: nonNegativeFiniteNumber.nullish(),
  skipCount: nonNegativeFiniteNumber.nullish(),
  averageRating: finiteNumber.nullish(),
  ratingCount: nonNegativeFiniteNumber.nullish(),
});

const searchHeatSchema = z
  .object({
    home: finiteNumber.min(-1).max(1).nullish(),
    away: finiteNumber.min(-1).max(1).nullish(),
  })
  .describe('Per-team search interest in [-1, 1].');

const gameFieldsSchema = z.object({
  league: boundedIdentifier.describe('League code, e.g. "NBA", "NFL", "EPL", "WC".'),
  homeTeam: boundedLabel,
  awayTeam: boundedLabel,
  startsAt: isoTimestamp.describe('ISO 8601 kickoff/tip-off time, e.g. "2026-07-06T19:30:00Z".'),
  status: statusSchema.optional(),
  gameType: z
    .enum(['regular', 'playin', 'playoff'])
    .nullish()
    .describe('Regular season, play-in, or playoff.'),
  odds: oddsSchema.optional(),
  teamPower: teamPairSchema.optional().describe('Team power ratings.'),
  injuries: teamPairSchema.optional().describe('Injury impact per team.'),
  narratives: narrativesSchema.optional(),
  engagement: engagementSchema.optional().describe('Fan engagement signals for the matchup.'),
  searchHeat: searchHeatSchema.optional(),
  starPower: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .nullish()
    .describe('Marquee player availability / skill density in [0, 1].'),
});

type GameFields = z.output<typeof gameFieldsSchema>;

function toGameInput(fields: GameFields): EntertainmentGameInput {
  return {
    league: fields.league,
    homeTeam: fields.homeTeam,
    awayTeam: fields.awayTeam,
    startsAt: fields.startsAt,
    status: fields.status ?? 'scheduled',
    gameType: fields.gameType ?? null,
    narratives: fields.narratives,
  };
}

function toPredictionContext(fields: GameFields): PredictionContext {
  return {
    odds: fields.odds ?? null,
    teamPower: fields.teamPower ?? null,
    injuries: fields.injuries ?? null,
    engagement: fields.engagement ?? null,
    searchHeat: fields.searchHeat ?? null,
    starPower: fields.starPower ?? null,
  };
}

export function createPredictGameBuzzTool(
  engineModule: EntertainmentEngineModule = defaultEngineModule,
): BuzzrToolDefinition {
  return defineTool({
    name: 'predict_game_buzz',
    title: 'Predict game buzz',
    description:
      'Predict how entertaining a game will be (1-10 buzz score) with the ' +
      '@buzzr/entertainment-engine ML model. Returns the score, model confidence, and ' +
      'the weighted factors behind the prediction. Odds, team power, injuries, and ' +
      'narrative context sharpen the estimate.',
    inputSchema: gameFieldsSchema,
    run: (args) => {
      const game = toGameInput(args);
      const context = toPredictionContext(args);
      const diagnostics = engineModule.predictGameWithDiagnostics(game, context);
      if (!diagnostics) {
        return errorResult(
          'prediction_unavailable',
          'The model does not predict games that are in progress. ' +
            'Use status "scheduled" (default) or "final".',
        );
      }
      const resolved = engineModule.resolveBuzzScores(
        { ...game, predictedEntertainmentScore: diagnostics.score },
        { upcomingLike: (args.status ?? 'scheduled') === 'scheduled' },
      );
      return jsonResult({
        score: diagnostics.score,
        confidence: diagnostics.confidence,
        factors: diagnostics.factors,
        modelVersion: diagnostics.modelVersion,
        usedOddsData: diagnostics.usedOddsData,
        usedInjuryData: diagnostics.usedInjuryData,
        resolved: {
          entertainmentScore: resolved.entertainmentScore,
          predictedEntertainmentScore: resolved.predictedEntertainmentScore,
          source: resolved.source,
          modelLabel: resolved.modelLabel,
        },
      });
    },
  });
}

const profileSchema = z
  .object({
    favoriteTeams: boundedArray(boundedLabel, 50).optional(),
    favoriteLeagues: boundedArray(boundedIdentifier, 50).optional(),
    teamAffinity: boundedRecord(boundedLabel, finiteNumber.min(-1).max(1), 100, 'teamAffinity')
      .optional()
      .describe('Per-team affinity in [-1, 1], keyed by team name.'),
    leagueAffinity: boundedRecord(
      boundedIdentifier,
      finiteNumber.min(-1).max(1),
      100,
      'leagueAffinity',
    )
      .optional()
      .describe('Per-league affinity in [-1, 1], keyed by league code.'),
    socialSignal: boundedRecord(boundedIdentifier, finiteNumber.min(-1).max(1), 100, 'socialSignal')
      .optional()
      .describe('Fire-ratio in [-1, 1], keyed by game id.'),
  })
  .describe('The user taste profile used to personalize the ranking.');

const rankGamesSchema = z.object({
  games: boundedArray(
    gameFieldsSchema.extend({
      id: boundedIdentifier.nullish().describe('Stable game id, used for social signals.'),
      baseScore: z
        .number()
        .min(0)
        .max(10)
        .nullish()
        .describe('Precomputed base entertainment score (1-10). Estimated when absent.'),
    }),
    100,
    1,
  ),
  profile: profileSchema.default({}),
  limit: z.number().int().positive().max(100).optional().describe('Return only the top N games.'),
});

export function createRankGamesTool(
  engineModule: EntertainmentEngineModule = defaultEngineModule,
): BuzzrToolDefinition {
  return defineTool({
    name: 'rank_games',
    title: 'Rank games for a user',
    description:
      'Rank candidate games for a specific user with @buzzr/entertainment-engine v5: ' +
      'base entertainment score plus bounded personal-affinity and social adjustments. ' +
      'Returns the ranked list with per-game factor breakdowns.',
    inputSchema: rankGamesSchema,
    run: (args) => {
      const rankGamesForUser = engineModule.rankGamesForUser;
      if (typeof rankGamesForUser !== 'function') {
        return errorResult(
          'engine_capability_missing',
          'rank_games requires rankGamesForUser from @buzzr/entertainment-engine v5, ' +
            'which the installed engine build does not export yet. Rebuild or upgrade ' +
            '@buzzr/entertainment-engine to enable this tool.',
        );
      }

      const entries = args.games.map((gameFields) => ({
        id: gameFields.id ?? null,
        game: toGameInput(gameFields),
        context: toPredictionContext(gameFields),
        baseScore: gameFields.baseScore ?? null,
      }));
      const ranked = (rankGamesForUser as RankGamesFn)(
        entries,
        args.profile,
        args.limit === undefined ? undefined : { limit: args.limit },
      );

      const explainRecommendation = engineModule.explainRecommendation;
      const rankedGames =
        Array.isArray(ranked) && typeof explainRecommendation === 'function'
          ? ranked.map((rankedGame) => {
              try {
                return {
                  ...(rankedGame as Record<string, unknown>),
                  explanation: (explainRecommendation as ExplainFn)(rankedGame),
                };
              } catch {
                return rankedGame as Record<string, unknown>;
              }
            })
          : ranked;

      return jsonResult({
        count: Array.isArray(rankedGames) ? rankedGames.length : args.games.length,
        rankedGames,
      });
    },
  });
}

export const predictGameBuzzTool = createPredictGameBuzzTool();
export const rankGamesTool = createRankGamesTool();

export const buzzTools: readonly BuzzrToolDefinition[] = [predictGameBuzzTool, rankGamesTool];
