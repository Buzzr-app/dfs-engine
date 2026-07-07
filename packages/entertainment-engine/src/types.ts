export type BuzzModelSource = 'engine' | 'lite' | 'ml' | null;

export type BuzzFactorContribution = {
  id: string;
  label: string;
  impact: number;
};

export type BuzzScoreDiagnostics = {
  kind: 'predicted' | 'completed';
  score: number;
  baseline: number;
  confidence: number;
  factors: BuzzFactorContribution[];
  modelVersion?: string;
  signals?: MLPredictionSignal[];
  featureValues?: MLFeatureValue[];
};

export type ResolvedBuzzScores = {
  entertainmentScore: number | null;
  predictedEntertainmentScore: number | null;
  source: BuzzModelSource;
  modelLabel: string | null;
  diagnostics: BuzzScoreDiagnostics | null;
};

export type BuzzGameLeague =
  | 'NBA'
  | 'WNBA'
  | 'NCAAM'
  | 'NFL'
  | 'MLB'
  | 'NHL'
  | 'MLS'
  | 'EPL'
  | 'WC'
  | 'LALIGA'
  | 'BUND'
  | 'SERIEA'
  | 'LIGUE1'
  | 'UCL'
  | 'LIGAMX'
  | 'NWSL'
  | 'UFC'
  | (string & {});

export type BuzzGameStatus =
  | 'scheduled'
  | 'in_progress'
  | 'final'
  | 'postponed'
  | 'cancelled'
  | (string & {});

export type EntertainmentGameInput = {
  entertainmentScore?: number | null;
  predictedEntertainmentScore?: number | null;
  league?: BuzzGameLeague;
  status?: BuzzGameStatus;
  startsAt?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  gameType?: 'regular' | 'playin' | 'playoff' | (string & {}) | null;
  narratives?: BuzzNarrativeFlags;
  /**
   * Explicit venue UTC offset in minutes (e.g. -240 for EDT). When present it
   * overrides the default US Eastern local-time derivation for primetime and
   * weekend detection.
   */
  venueUtcOffsetMinutes?: number | null;
  /**
   * Explicit local start hour (0-23) at the venue. Takes precedence over any
   * offset-based derivation when present.
   */
  localStartHour?: number | null;
};

export type BuzzScoreInput = EntertainmentGameInput;

export type BuzzNarrativeFlags = {
  isRivalry?: boolean;
  rivalryIntensity?: 1 | 2 | 3;
  playerVsFormerTeam?: boolean;
  hasDebut?: boolean;
};

export type BuzzGameRowInput = {
  entertainment_score?: number | null;
  predicted_entertainment_score?: number | null;
  league?: BuzzGameLeague;
  status?: BuzzGameStatus;
  starts_at?: string;
  home_team?: string;
  away_team?: string;
  home_score?: number | null;
  away_score?: number | null;
  game_type?: EntertainmentGameInput['gameType'];
  venue_utc_offset_minutes?: number | null;
  local_start_hour?: number | null;
};

/** Options accepted by resolveBuzzScores. */
export type BuzzScoreResolveOptions = {
  upcomingLike: boolean;
  /**
   * Reference clock used for hours-until-start and upcoming checks.
   * Defaults to Date.now() when omitted so existing callers are unaffected.
   */
  now?: number | Date;
};

/** Options accepted by enrichGameRowWithBuzzScores. */
export type EnrichGameRowOptions = {
  /** Reference clock; defaults to Date.now() when omitted. */
  now?: number | Date;
};

export type GameOddsContext = {
  spread?: number | null;
  overUnder?: number | null;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
};

export type TeamPowerContext = {
  home?: number | null;
  away?: number | null;
};

export type InjuryImpactContext = {
  home?: number | null;
  away?: number | null;
};

export type MatchupHistoryContext = {
  recentBuzzForm?: number | null;
  recentPerformanceLevel?: number | null;
  recentPerformanceBalance?: number | null;
  restFreshness?: number | null;
  restBalance?: number | null;
  rematchHeat?: number | null;
  homeRecentGameCount?: number | null;
  awayRecentGameCount?: number | null;
  homeWinPct?: number | null;
  awayWinPct?: number | null;
  homeRecentBuzz?: number | null;
  awayRecentBuzz?: number | null;
  homeRestDays?: number | null;
  awayRestDays?: number | null;
  lastMeetingDays?: number | null;
  lastMeetingBuzz?: number | null;
  lastMeetingMargin?: number | null;
};

export type UserEngagementContext = {
  fireCount?: number | null;
  skipCount?: number | null;
  averageRating?: number | null;
  ratingCount?: number | null;
};

/** Per-team search interest, each value in [-1, 1]. */
export type SearchHeatContext = {
  home?: number | null;
  away?: number | null;
};

export type PredictionContext = {
  odds?: GameOddsContext | null;
  teamPower?: TeamPowerContext | null;
  injuries?: InjuryImpactContext | null;
  matchupContext?: MatchupHistoryContext | null;
  engagement?: UserEngagementContext | null;
  /** Per-team search interest in [-1, 1]; feeds the v5 searchHeat feature. */
  searchHeat?: SearchHeatContext | null;
  /** Marquee player availability / skill density in [0, 1]; v5 feature. */
  starPower?: number | null;
  /** Reference clock for time-sensitive signals; defaults to Date.now(). */
  now?: number | Date;
};

export type GameFeatureVector = number[];

/** Control point for piecewise-linear confidence calibration. */
export type ConfidenceCalibrationPoint = {
  raw: number;
  calibrated: number;
};

export type ModelWeights = {
  bias: number;
  weights: readonly number[];
  /** 'ml-v5' for weights produced by trainSGD >= v5; absent for v1 weights. */
  modelVersion?: string;
  /** Per-feature means captured during training (v5 standardization). */
  featureMeans?: readonly number[];
  /** Per-feature standard deviations captured during training. */
  featureStds?: readonly number[];
  /** Piecewise-linear confidence calibration from validation residuals. */
  confidenceCalibration?: readonly ConfidenceCalibrationPoint[];
  /** Number of epochs actually run (early stopping may end training sooner). */
  trainedEpochs?: number;
};

export type TrainingExample = {
  features: GameFeatureVector;
  label: number;
  gameId?: string;
};

export type TrainingLabelSource = 'rating' | 'swipe' | 'score';

export type TrainingOpts = {
  lr?: number;
  epochs?: number;
  lambda?: number;
  convergenceThreshold?: number;
  /** Classical momentum coefficient in [0, 1). Defaults to 0 (plain SGD). */
  momentum?: number;
  /**
   * Fraction of examples held out as a chronological tail for validation.
   * Defaults to 0 (no split, matching pre-v5 behavior).
   */
  validationSplit?: number;
  /** Enable early stopping on validation MAE. Requires validationSplit > 0. */
  earlyStopping?: boolean;
  /** Early-stopping patience in epochs. Defaults to 10. */
  patience?: number;
  /** Shuffle training order each epoch with a seeded RNG. Defaults to false. */
  shuffle?: boolean;
  /** Seed for the deterministic mulberry32 RNG used by shuffle. */
  seed?: number;
  /** Standardize features during training. Defaults to true in v5. */
  standardize?: boolean;
};

export type ValidationReport = {
  mae: number;
  rmse: number;
  pearsonR: number;
  sampleSize: number;
};

export type AccuracyReport = ValidationReport & {
  averagePrediction: number | null;
  averageLabel: number | null;
  topWatchPrecision: number | null;
};

export type ConfidenceCalibrationBucket = {
  bucket: string;
  count: number;
  averageConfidence: number | null;
  averageError: number | null;
  averageLabel: number | null;
  averagePrediction: number | null;
};

export type FactorImpactSummary = {
  id: string;
  label: string;
  averageImpact: number;
  averageAbsoluteImpact: number;
  positiveCount: number;
  negativeCount: number;
  sampleCount: number;
};

export type LabelSourceSummary = {
  source: TrainingLabelSource;
  count: number;
  averageLabel: number | null;
};

export type PredictionSampleReport = {
  gameId?: string;
  league?: string;
  startsAt?: string;
  labelSource: TrainingLabelSource;
  label: number;
  baselinePrediction: number;
  trainedPrediction: number;
  baselineError: number;
  trainedError: number;
  driftDelta: number;
  confidence: number;
  topFactors: BuzzFactorContribution[];
  missingSignals: string[];
};

export type ModelReportExample = TrainingExample & {
  labelSource: TrainingLabelSource;
  game?: EntertainmentGameInput;
  context?: PredictionContext | null;
  league?: string;
  startsAt?: string;
};

export type ModelDriftReport = {
  averageDelta: number | null;
  averageAbsoluteDelta: number | null;
  highDriftCount: number;
  threshold: number;
};

export type ModelRunReportStatus = 'ok' | 'insufficient_data' | 'insufficient_test_data';

export type ModelRunReport = {
  status: ModelRunReportStatus;
  generatedAt: string;
  packageVersion: string | null;
  modelVersion: string;
  minExamples: number;
  sampleSize: number;
  trainSize: number;
  testSize: number;
  baselineMetrics: AccuracyReport | null;
  trainedMetrics: AccuracyReport | null;
  improved: boolean;
  promotionReady: boolean;
  labelMix: LabelSourceSummary[];
  drift: ModelDriftReport;
  confidenceCalibration: ConfidenceCalibrationBucket[];
  factorImpact: FactorImpactSummary[];
  samples: PredictionSampleReport[];
  weights: ModelWeights | null;
};

export type MLFeatureValue = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  impact: number;
};

export type MLPredictionSignal = {
  id: string;
  label: string;
  status: 'present' | 'missing' | 'derived';
  detail: string;
};

export type MLPredictionDiagnostics = {
  score: number;
  confidence: number;
  factors: BuzzFactorContribution[];
  modelVersion: string;
  usedInjuryData: boolean;
  usedOddsData: boolean;
  signals: MLPredictionSignal[];
  featureValues: MLFeatureValue[];
};

/** User taste profile consumed by rankGamesForUser. */
export type UserAffinityProfile = {
  favoriteTeams?: string[];
  favoriteLeagues?: string[];
  /** Per-team affinity in [-1, 1], keyed by team name (normalized on use). */
  teamAffinity?: Record<string, number>;
  /** Per-league affinity in [-1, 1], keyed by league code. */
  leagueAffinity?: Record<string, number>;
  /** Fire-ratio in [-1, 1] keyed by game id. */
  socialSignal?: Record<string, number>;
};

/** One candidate game handed to rankGamesForUser. */
export type RecommendationGameEntry = {
  /** Stable game id; used for socialSignal lookup and tie-breaking. */
  id?: string | null;
  game: EntertainmentGameInput;
  context?: PredictionContext | null;
  /** Precomputed base entertainment score (1-10). Estimated when absent. */
  baseScore?: number | null;
};

export type RecommendationFactor = {
  id: string;
  label: string;
  delta: number;
};

export type RankedGame = {
  id: string | null;
  game: EntertainmentGameInput;
  context: PredictionContext | null;
  baseScore: number;
  /** Bounded personal-affinity adjustment (max +/-1.5). */
  affinityAdjustment: number;
  /** Bounded social adjustment (max +/-0.75). */
  socialAdjustment: number;
  totalScore: number;
  factors: RecommendationFactor[];
};

export type RecommendationExplanation = {
  baseScore: number;
  personalAdjustment: number;
  socialAdjustment: number;
  totalScore: number;
  factors: RecommendationFactor[];
};

export type RankGamesOptions = {
  /** Reference clock for base-score estimation; defaults to Date.now(). */
  now?: number | Date;
  /** Return only the top N entries. */
  limit?: number;
};
