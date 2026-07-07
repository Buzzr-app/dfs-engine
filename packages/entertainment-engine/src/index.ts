import {
  easternUtcOffsetMinutes,
  enrichGameRowWithBuzzScores as enrichRow,
  isMustWatch as isMustWatchCore,
  MUST_WATCH_THRESHOLD,
  normalizeTeamName,
  resolveBuzzScores as resolveScores,
  resolveNowMs,
} from './buzz-model-core';
import type { BuzzGameRowInput, BuzzScoreInput } from './public-core-types';
import type { BuzzScoreResolveOptions, EnrichGameRowOptions, ResolvedBuzzScores } from './types';

export type {
  BuzzFactorContribution,
  BuzzGameLeague,
  BuzzGameRowInput,
  BuzzGameStatus,
  BuzzModelSource,
  BuzzNarrativeFlags,
  BuzzScoreInput,
  BuzzScoreDiagnostics,
  BuzzScoreResolveOptions,
  ConfidenceCalibrationPoint,
  EnrichGameRowOptions,
  EntertainmentGameInput,
  GameFeatureVector,
  GameOddsContext,
  InjuryImpactContext,
  MatchupHistoryContext,
  MLFeatureValue,
  MLPredictionDiagnostics,
  MLPredictionSignal,
  AccuracyReport,
  ConfidenceCalibrationBucket,
  FactorImpactSummary,
  LabelSourceSummary,
  ModelDriftReport,
  ModelReportExample,
  ModelRunReport,
  ModelRunReportStatus,
  ModelWeights,
  PredictionSampleReport,
  PredictionContext,
  RankGamesOptions,
  RankedGame,
  RecommendationExplanation,
  RecommendationFactor,
  RecommendationGameEntry,
  ResolvedBuzzScores,
  SearchHeatContext,
  TeamPowerContext,
  TrainingExample,
  TrainingLabelSource,
  TrainingOpts,
  UserAffinityProfile,
  UserEngagementContext,
  ValidationReport,
} from './types';

export {
  FEATURE_NAMES,
  INITIAL_WEIGHTS,
  LEGACY_FEATURE_COUNT,
  ML_MODEL_VERSION,
  ML_MODEL_VERSION_V5,
  applyConfidenceCalibration,
  clamp01,
  clampScore,
  dotProduct,
  extractFeatures,
  predictFromFeatures,
  predictGame,
  predictGameWithDiagnostics,
  trainSGD,
  validateModel,
} from './ml';

export { buildModelRunReport } from './reporting';

export {
  MAX_AFFINITY_ADJUSTMENT,
  MAX_SOCIAL_ADJUSTMENT,
  explainRecommendation,
  rankGamesForUser,
} from './recommendations';

export { easternUtcOffsetMinutes, normalizeTeamName, resolveNowMs };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export const ENGINE_PACKAGE_VERSION = '5.0.0';

export { MUST_WATCH_THRESHOLD };

export function resolveBuzzScores(
  game: BuzzScoreInput,
  options: BuzzScoreResolveOptions = { upcomingLike: false },
): ResolvedBuzzScores {
  return resolveScores(game, options);
}

export function enrichGameRowWithBuzzScores<
  TRow extends BuzzGameRowInput & Record<string, unknown>,
>(
  row: TRow,
  options: EnrichGameRowOptions = {},
): TRow & {
  entertainment_score: number | null;
  predicted_entertainment_score: number | null;
} {
  return enrichRow(row, options);
}

export function isMustWatch(score: number | null | undefined, threshold?: number): boolean {
  return isMustWatchCore(score, threshold);
}
