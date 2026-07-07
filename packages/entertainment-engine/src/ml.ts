import { normalizeTeamName, resolveBuzzScores, resolveNowMs } from './buzz-model-core';
import type {
  BuzzFactorContribution,
  ConfidenceCalibrationPoint,
  EntertainmentGameInput,
  GameFeatureVector,
  MLFeatureValue,
  MLPredictionDiagnostics,
  MLPredictionSignal,
  ModelWeights,
  PredictionContext,
  TrainingExample,
  TrainingOpts,
  ValidationReport,
} from './types';

export const ML_MODEL_VERSION = 'ml-v1-transparent';
export const ML_MODEL_VERSION_V5 = 'ml-v5';
/** Feature count used by v1 weights; kept for backward compatibility. */
export const LEGACY_FEATURE_COUNT = 20;

export const FEATURE_NAMES = [
  'baselineBuzz',
  'marqueeSignal',
  'rivalryHeat',
  'stakes',
  'isPlayoff',
  'teamQuality',
  'powerBalance',
  'primeTimeSignal',
  'weekendSignal',
  'oddsBalance',
  'totalExpectation',
  'recentBuzzForm',
  'recentPerformanceLevel',
  'recentPerformanceBalance',
  'restFreshness',
  'restBalance',
  'rematchHeat',
  'injuryAvailability',
  'underdogIntrigue',
  'engagementSignal',
  // v5 additions - appended so v1 weight arrays keep their meaning.
  'searchHeat',
  'starPower',
] as const;

const FEATURE_LABELS: Record<string, string> = {
  baselineBuzz: 'Transparent baseline',
  marqueeSignal: 'Marquee draw',
  rivalryHeat: 'Rivalry heat',
  stakes: 'Game stakes',
  isPlayoff: 'Playoff context',
  teamQuality: 'Team quality',
  powerBalance: 'Competitive balance',
  primeTimeSignal: 'Prime window',
  weekendSignal: 'Weekend audience',
  oddsBalance: 'Market uncertainty',
  totalExpectation: 'Scoring expectation',
  recentBuzzForm: 'Recent game buzz',
  recentPerformanceLevel: 'Recent team form',
  recentPerformanceBalance: 'Form balance',
  restFreshness: 'Rest freshness',
  restBalance: 'Rest parity',
  rematchHeat: 'Recent meeting heat',
  injuryAvailability: 'Availability',
  underdogIntrigue: 'Upset intrigue',
  engagementSignal: 'Audience signal',
  searchHeat: 'Search heat',
  starPower: 'Star power',
};

const MARQUEE_TEAMS = new Set([
  'boston celtics',
  'los angeles lakers',
  'golden state warriors',
  'new york knicks',
  'dallas cowboys',
  'kansas city chiefs',
  'new york yankees',
  'los angeles dodgers',
  'real madrid',
  'barcelona',
  'manchester city',
  'liverpool',
]);

const RIVALRY_KEYS = new Set([
  'boston celtics::los angeles lakers',
  'duke blue devils::north carolina tar heels',
  'chicago bears::green bay packers',
  'new york yankees::boston red sox',
  'barcelona::real madrid',
  'liverpool::manchester united',
]);

/**
 * Published v1 weights. Intentionally 20 entries long: the two v5 features
 * contribute nothing under these weights, so predictions made with them are
 * bit-identical to pre-v5 releases.
 */
export const INITIAL_WEIGHTS: ModelWeights = {
  bias: 1.05,
  weights: [
    4.2, 0.42, 0.38, 0.46, 0.52, 0.52, 0.3, 0.16, 0.12, 0.34, 0.2, 0.42, 0.2, 0.14, 0.08, 0.08,
    0.34, 0.2, 0.2, 0.46,
  ],
};

/** Prior weight applied to features absent from the v1 weight vector. */
const NEW_FEATURE_INITIAL_WEIGHT = 0.2;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Number(value.toFixed(2))));
}

export function dotProduct(weights: readonly number[], features: readonly number[]): number {
  return features.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function matchupKey(game: EntertainmentGameInput): string {
  return [normalizeTeamName(game.homeTeam), normalizeTeamName(game.awayTeam)].sort().join('::');
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const filtered = values.filter(finiteNumber);
  if (filtered.length === 0) return fallback;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function normalizeScore01(score: number | null | undefined, fallback = 0.5): number {
  if (!finiteNumber(score)) return fallback;
  return clamp01(score / 10);
}

function normalizeContext01(value: number | null | undefined, fallback = 0.5): number {
  if (!finiteNumber(value)) return fallback;
  if (value >= 0 && value <= 1) return clamp01(value);
  return normalizeScore01(value, fallback);
}

function hoursUntilStart(startsAt: string | null | undefined, now?: number | Date): number | null {
  const timestamp = Date.parse(String(startsAt ?? ''));
  if (Number.isNaN(timestamp)) return null;
  return (timestamp - resolveNowMs(now)) / (60 * 60 * 1000);
}

function getPrimeTimeSignal(startsAt: string | null | undefined): number {
  const timestamp = Date.parse(String(startsAt ?? ''));
  if (Number.isNaN(timestamp)) return 0.5;
  const hour = new Date(timestamp).getUTCHours();
  return hour >= 0 && hour <= 4 ? 1 : hour >= 18 && hour <= 23 ? 0.72 : 0.35;
}

function getWeekendSignal(startsAt: string | null | undefined): number {
  const timestamp = Date.parse(String(startsAt ?? ''));
  if (Number.isNaN(timestamp)) return 0.5;
  const day = new Date(timestamp).getUTCDay();
  return day === 0 || day === 6 ? 1 : day === 5 ? 0.72 : 0.36;
}

function getStakes(game: EntertainmentGameInput): number {
  if (game.gameType === 'playoff') return 1;
  if (game.gameType === 'playin') return 0.78;
  const month = finiteNumber(Date.parse(String(game.startsAt ?? '')))
    ? new Date(String(game.startsAt)).getUTCMonth() + 1
    : null;
  if (game.league === 'NCAAM' && (month === 3 || month === 4)) return 0.82;
  if (game.league === 'NFL' && (month === 1 || month === 2)) return 0.75;
  return 0.45;
}

function getMarqueeSignal(game: EntertainmentGameInput): number {
  const home = MARQUEE_TEAMS.has(normalizeTeamName(game.homeTeam)) ? 1 : 0;
  const away = MARQUEE_TEAMS.has(normalizeTeamName(game.awayTeam)) ? 1 : 0;
  return clamp01((home + away) / 2);
}

function getRivalryHeat(game: EntertainmentGameInput): number {
  if (RIVALRY_KEYS.has(matchupKey(game))) return 1;
  return getMarqueeSignal(game) > 0.75 ? 0.52 : 0.22;
}

function getOddsBalance(context: PredictionContext | null | undefined): number {
  const spread = Math.abs(context?.odds?.spread ?? Number.NaN);
  if (!finiteNumber(spread)) return 0.5;
  return clamp01(1 - Math.min(1, spread / 18));
}

function getTotalExpectation(
  game: EntertainmentGameInput,
  context: PredictionContext | null | undefined,
): number {
  const total = context?.odds?.overUnder;
  if (finiteNumber(total)) {
    if (game.league === 'MLB') return clamp01(total / 12);
    if (game.league === 'NHL') return clamp01(total / 7);
    if (game.league === 'NFL') return clamp01(total / 60);
    return clamp01(total / 245);
  }
  return normalizeScore01(
    resolveBuzzScores(game, { upcomingLike: true, now: context?.now }).predictedEntertainmentScore,
    0.55,
  );
}

function getUnderdogIntrigue(context: PredictionContext | null | undefined): number {
  const home = context?.odds?.homeMoneyline;
  const away = context?.odds?.awayMoneyline;
  if (!finiteNumber(home) || !finiteNumber(away)) return 0.35;
  const underdog = Math.max(home, away);
  return underdog > 0 ? clamp01(Math.min(underdog, 500) / 500) : 0.2;
}

function getEngagementSignal(context: PredictionContext | null | undefined): number {
  const fire = context?.engagement?.fireCount;
  const skip = context?.engagement?.skipCount;
  if (finiteNumber(fire) && finiteNumber(skip) && fire + skip > 0) {
    return clamp01(fire / (fire + skip));
  }
  const rating = context?.engagement?.averageRating;
  return normalizeScore01(rating, 0.5);
}

function getSearchHeatSignal(context: PredictionContext | null | undefined): number {
  const raw = [context?.searchHeat?.home, context?.searchHeat?.away]
    .filter(finiteNumber)
    .map((value) => Math.max(-1, Math.min(1, value)));
  if (raw.length === 0) return 0.5;
  const combined = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  return clamp01((combined + 1) / 2);
}

function getStarPowerSignal(context: PredictionContext | null | undefined): number {
  const value = context?.starPower;
  if (!finiteNumber(value)) return 0.5;
  return clamp01(value);
}

export function extractFeatures(
  game: EntertainmentGameInput,
  context: PredictionContext | null | undefined = {},
): GameFeatureVector {
  const transparent = resolveBuzzScores(game, {
    upcomingLike: game.status !== 'final',
    now: context?.now,
  });
  const baselineBuzz = normalizeScore01(
    transparent.predictedEntertainmentScore ?? transparent.entertainmentScore,
    0.55,
  );
  const homePower = normalizeScore01(context?.teamPower?.home, 0.5);
  const awayPower = normalizeScore01(context?.teamPower?.away, 0.5);
  const teamQuality = average([homePower, awayPower], 0.5);
  const powerBalance = clamp01(1 - Math.abs(homePower - awayPower));
  const homeInjury = normalizeContext01(context?.injuries?.home, 0);
  const awayInjury = normalizeContext01(context?.injuries?.away, 0);
  const injuryAvailability = clamp01(1 - Math.min(1, (homeInjury + awayInjury) / 2));

  return [
    baselineBuzz,
    getMarqueeSignal(game),
    getRivalryHeat(game),
    getStakes(game),
    game.gameType === 'playoff' ? 1 : 0,
    teamQuality,
    powerBalance,
    getPrimeTimeSignal(game.startsAt),
    getWeekendSignal(game.startsAt),
    getOddsBalance(context),
    getTotalExpectation(game, context),
    normalizeContext01(context?.matchupContext?.recentBuzzForm, 0.5),
    normalizeContext01(context?.matchupContext?.recentPerformanceLevel, 0.5),
    normalizeContext01(context?.matchupContext?.recentPerformanceBalance, 0.5),
    normalizeContext01(context?.matchupContext?.restFreshness, 0.5),
    normalizeContext01(context?.matchupContext?.restBalance, 0.5),
    normalizeContext01(context?.matchupContext?.rematchHeat, 0),
    injuryAvailability,
    getUnderdogIntrigue(context),
    getEngagementSignal(context),
    getSearchHeatSignal(context),
    getStarPowerSignal(context),
  ];
}

function standardizeFeatures(
  features: readonly number[],
  modelWeights: ModelWeights,
): readonly number[] {
  const means = modelWeights.featureMeans;
  const stds = modelWeights.featureStds;
  if (!means || !stds) return features;
  return features.map((value, index) => {
    const mean = means[index] ?? 0;
    const std = stds[index] ?? 1;
    return std > 1e-6 ? (value - mean) / std : value - mean;
  });
}

export function predictFromFeatures(
  features: readonly number[],
  modelWeights: ModelWeights = INITIAL_WEIGHTS,
): number {
  // Old weight vectors (e.g. 20-long v1 arrays) skip the newer appended
  // features entirely so their predictions stay identical to prior releases.
  const usableFeatures =
    modelWeights.weights.length < features.length
      ? features.slice(0, modelWeights.weights.length)
      : features;
  const standardized = standardizeFeatures(usableFeatures, modelWeights);
  return clampScore(modelWeights.bias + dotProduct(modelWeights.weights, standardized));
}

export function predictGame(
  game: EntertainmentGameInput,
  context: PredictionContext | null | undefined = {},
  modelWeights: ModelWeights = INITIAL_WEIGHTS,
): number | null {
  if (game.status === 'in_progress') return null;
  return predictFromFeatures(extractFeatures(game, context), modelWeights);
}

function signal(id: string, label: string, present: boolean, detail?: string): MLPredictionSignal {
  return {
    id,
    label,
    status: present ? 'present' : 'missing',
    detail: detail ?? (present ? 'Available' : 'Not available'),
  };
}

function formatFeatureValue(id: string, value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildFeatureValues(
  features: readonly number[],
  modelWeights: ModelWeights,
): MLFeatureValue[] {
  const standardized = standardizeFeatures(features, modelWeights);
  return FEATURE_NAMES.map((id, index) => {
    const value = features[index] ?? 0;
    return {
      id,
      label: FEATURE_LABELS[id] ?? id,
      value: Number(value.toFixed(4)),
      displayValue: formatFeatureValue(id, value),
      impact: Number(((modelWeights.weights[index] ?? 0) * (standardized[index] ?? 0)).toFixed(2)),
    };
  }).sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact));
}

function buildFactors(featureValues: MLFeatureValue[]): BuzzFactorContribution[] {
  return featureValues
    .filter((feature) => Math.abs(feature.impact) >= 0.08)
    .slice(0, 8)
    .map(({ id, label, impact }) => ({ id, label, impact }));
}

function buildSignals(
  game: EntertainmentGameInput,
  context: PredictionContext | null | undefined,
): MLPredictionSignal[] {
  const leadHours = hoursUntilStart(game.startsAt, context?.now);
  return [
    signal('odds', 'Pregame odds', context?.odds != null),
    signal('teamPower', 'Team power', context?.teamPower != null),
    signal('injuries', 'Availability', context?.injuries != null),
    signal('matchupHistory', 'Matchup history', context?.matchupContext != null),
    signal('engagement', 'Audience feedback', context?.engagement != null),
    signal('searchHeat', 'Search heat', context?.searchHeat != null),
    signal('starPower', 'Star power', finiteNumber(context?.starPower)),
    signal(
      'leadTime',
      'Lead time',
      leadHours != null,
      leadHours == null ? undefined : `${Math.round(leadHours)}h`,
    ),
  ];
}

function buildConfidence(context: PredictionContext | null | undefined): number {
  let confidence = 0.48;
  if (context?.odds) confidence += 0.1;
  if (context?.teamPower) confidence += 0.1;
  if (context?.matchupContext) confidence += 0.12;
  if (context?.injuries) confidence += 0.08;
  if (context?.engagement) confidence += 0.08;
  return clamp01(confidence);
}

/**
 * Piecewise-linear interpolation over calibration control points. Returns the
 * raw confidence unchanged when no calibration data is available.
 */
export function applyConfidenceCalibration(
  confidence: number,
  calibration: readonly ConfidenceCalibrationPoint[] | null | undefined,
): number {
  if (!calibration || calibration.length === 0) return clamp01(confidence);
  const points = [...calibration].sort((left, right) => left.raw - right.raw);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return clamp01(confidence);
  if (confidence <= first.raw) return clamp01(first.calibrated);
  if (confidence >= last.raw) return clamp01(last.calibrated);
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (!left || !right) continue;
    if (confidence <= right.raw) {
      const span = right.raw - left.raw;
      const t = span > 0 ? (confidence - left.raw) / span : 0;
      return clamp01(left.calibrated + t * (right.calibrated - left.calibrated));
    }
  }
  return clamp01(last.calibrated);
}

export function predictGameWithDiagnostics(
  game: EntertainmentGameInput,
  context: PredictionContext | null | undefined = {},
  modelWeights: ModelWeights = INITIAL_WEIGHTS,
): MLPredictionDiagnostics | null {
  const score = predictGame(game, context, modelWeights);
  if (score == null) return null;

  const features = extractFeatures(game, context);
  const featureValues = buildFeatureValues(features, modelWeights);
  const rawConfidence = buildConfidence(context);
  return {
    score,
    confidence: modelWeights.confidenceCalibration
      ? applyConfidenceCalibration(rawConfidence, modelWeights.confidenceCalibration)
      : rawConfidence,
    factors: buildFactors(featureValues),
    modelVersion: modelWeights.modelVersion ?? ML_MODEL_VERSION,
    usedInjuryData: context?.injuries != null,
    usedOddsData: context?.odds != null,
    signals: buildSignals(game, context),
    featureValues,
  };
}

function inactiveFeatureIndexes(examples: TrainingExample[]): Set<number> {
  const inactive = new Set<number>();
  for (let index = 0; index < FEATURE_NAMES.length; index += 1) {
    if (examples.every(({ features }) => Math.abs(features[index] ?? 0) < 0.0001)) {
      inactive.add(index);
    }
  }
  return inactive;
}

/** Deterministic 32-bit PRNG (mulberry32) - no dependencies. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(items: number[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const held = items[index] ?? 0;
    items[index] = items[swapIndex] ?? 0;
    items[swapIndex] = held;
  }
}

function padFeatures(features: readonly number[], length: number): number[] {
  return Array.from({ length }, (_, index) => features[index] ?? 0);
}

type FeatureStats = {
  means: number[];
  stds: number[];
};

function computeFeatureStats(rows: number[][], featureCount: number): FeatureStats {
  const means = new Array<number>(featureCount).fill(0);
  const stds = new Array<number>(featureCount).fill(0);
  if (rows.length === 0) return { means, stds: stds.fill(1) };
  for (const row of rows) {
    for (let index = 0; index < featureCount; index += 1) {
      means[index] = (means[index] ?? 0) + (row[index] ?? 0);
    }
  }
  for (let index = 0; index < featureCount; index += 1) {
    means[index] = (means[index] ?? 0) / rows.length;
  }
  for (const row of rows) {
    for (let index = 0; index < featureCount; index += 1) {
      const deviation = (row[index] ?? 0) - (means[index] ?? 0);
      stds[index] = (stds[index] ?? 0) + deviation ** 2;
    }
  }
  for (let index = 0; index < featureCount; index += 1) {
    stds[index] = Math.sqrt((stds[index] ?? 0) / rows.length);
  }
  return { means, stds };
}

function applyStats(row: number[], stats: FeatureStats | null): number[] {
  if (!stats) return row;
  return row.map((value, index) => {
    const mean = stats.means[index] ?? 0;
    const std = stats.stds[index] ?? 1;
    return std > 1e-6 ? (value - mean) / std : value - mean;
  });
}

function quantile(sortedValues: readonly number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * Math.max(0, Math.min(1, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

const CALIBRATION_KNOTS = [0, 0.25, 0.5, 0.75, 1] as const;

function buildCalibrationPoints(residuals: readonly number[]): ConfidenceCalibrationPoint[] {
  const sorted = [...residuals].sort((left, right) => left - right);
  let previous = 0;
  return CALIBRATION_KNOTS.map((knot) => {
    const residualAtKnot = quantile(sorted, knot);
    const reliability = clamp01(1 - residualAtKnot / 5);
    const calibrated = Math.max(previous, clamp01(Number((knot * reliability).toFixed(4))));
    previous = calibrated;
    return { raw: knot, calibrated };
  });
}

export function trainSGD(examples: TrainingExample[], opts: TrainingOpts = {}): ModelWeights {
  if (examples.length === 0) return INITIAL_WEIGHTS;
  const lr = opts.lr ?? 0.01;
  const epochs = opts.epochs ?? 300;
  const lambda = opts.lambda ?? 0.02;
  const convergenceThreshold = opts.convergenceThreshold ?? 0.0001;
  const momentum = opts.momentum ?? 0;
  const validationSplit = opts.validationSplit ?? 0;
  const earlyStopping = opts.earlyStopping ?? false;
  const patience = opts.patience ?? 10;
  const shuffle = opts.shuffle ?? false;
  const seed = opts.seed ?? 1337;
  const standardize = opts.standardize ?? true;
  const featureCount = FEATURE_NAMES.length;

  // Chronological tail split: examples are assumed oldest-first, so the
  // validation window is the most recent slice.
  const validationSize =
    validationSplit > 0
      ? Math.min(examples.length - 1, Math.max(1, Math.floor(examples.length * validationSplit)))
      : 0;
  const trainExamples =
    validationSize > 0 ? examples.slice(0, examples.length - validationSize) : examples;
  const validationExamples =
    validationSize > 0 ? examples.slice(examples.length - validationSize) : [];

  const inactive = inactiveFeatureIndexes(trainExamples);
  const trainRows = trainExamples.map((example) => padFeatures(example.features, featureCount));
  const stats = standardize ? computeFeatureStats(trainRows, featureCount) : null;
  const trainSet = trainExamples.map((example, index) => ({
    features: applyStats(trainRows[index] ?? [], stats),
    label: example.label,
  }));
  const validationSet = validationExamples.map((example) => ({
    features: applyStats(padFeatures(example.features, featureCount), stats),
    label: example.label,
  }));

  let bias = INITIAL_WEIGHTS.bias;
  const weights = Array.from(
    { length: featureCount },
    (_, index) => INITIAL_WEIGHTS.weights[index] ?? NEW_FEATURE_INITIAL_WEIGHT,
  );
  let biasVelocity = 0;
  const velocities = new Array<number>(featureCount).fill(0);
  const random = mulberry32(seed);
  const order = trainSet.map((_, index) => index);
  let lastLoss = Number.POSITIVE_INFINITY;
  let bestValidationMae = Number.POSITIVE_INFINITY;
  let bestBias = bias;
  let bestWeights = [...weights];
  let epochsWithoutImprovement = 0;
  let trainedEpochs = 0;

  const currentValidationMae = (): number => {
    if (validationSet.length === 0) return Number.POSITIVE_INFINITY;
    const total = validationSet.reduce(
      (sum, example) =>
        sum + Math.abs(clampScore(bias + dotProduct(weights, example.features)) - example.label),
      0,
    );
    return total / validationSet.length;
  };

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    trainedEpochs = epoch + 1;
    if (shuffle) shuffleInPlace(order, random);
    let loss = 0;
    for (const exampleIndex of order) {
      const example = trainSet[exampleIndex];
      if (!example) continue;
      const predicted = bias + dotProduct(weights, example.features);
      const error = predicted - example.label;
      loss += error ** 2;
      if (momentum > 0) {
        biasVelocity = momentum * biasVelocity - lr * error;
        bias += biasVelocity;
      } else {
        bias -= lr * error;
      }
      for (let index = 0; index < weights.length; index += 1) {
        if (inactive.has(index)) continue;
        const gradient = error * (example.features[index] ?? 0) + lambda * (weights[index] ?? 0);
        if (momentum > 0) {
          velocities[index] = momentum * (velocities[index] ?? 0) - lr * gradient;
          weights[index] = (weights[index] ?? 0) + (velocities[index] ?? 0);
        } else {
          weights[index] = (weights[index] ?? 0) - lr * gradient;
        }
      }
    }
    loss /= trainSet.length;

    if (earlyStopping && validationSet.length > 0) {
      const validationMae = currentValidationMae();
      if (validationMae < bestValidationMae - 1e-9) {
        bestValidationMae = validationMae;
        bestBias = bias;
        bestWeights = [...weights];
        epochsWithoutImprovement = 0;
      } else {
        epochsWithoutImprovement += 1;
        if (epochsWithoutImprovement >= patience) break;
      }
    }

    if (Math.abs(lastLoss - loss) < convergenceThreshold) break;
    lastLoss = loss;
  }

  if (earlyStopping && validationSet.length > 0 && Number.isFinite(bestValidationMae)) {
    bias = bestBias;
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] = bestWeights[index] ?? 0;
    }
  }

  const residuals = validationSet.map((example) =>
    Math.abs(clampScore(bias + dotProduct(weights, example.features)) - example.label),
  );

  const trained: ModelWeights = {
    bias: Number(bias.toFixed(4)),
    weights: weights.map((weight) => Number(weight.toFixed(4))),
    modelVersion: ML_MODEL_VERSION_V5,
    trainedEpochs,
  };
  if (stats) {
    trained.featureMeans = stats.means.map((mean) => Number(mean.toFixed(6)));
    trained.featureStds = stats.stds.map((std) => Number(std.toFixed(6)));
  }
  if (residuals.length > 0) {
    trained.confidenceCalibration = buildCalibrationPoints(residuals);
  }
  return trained;
}

function pearsonR(actuals: readonly number[], predictions: readonly number[]): number {
  if (actuals.length < 2 || predictions.length < 2) return 0;
  const avgActual = actuals.reduce((sum, value) => sum + value, 0) / actuals.length;
  const avgPred = predictions.reduce((sum, value) => sum + value, 0) / predictions.length;
  let numerator = 0;
  let denomActual = 0;
  let denomPred = 0;
  for (let index = 0; index < actuals.length; index += 1) {
    const a = actuals[index]! - avgActual;
    const p = predictions[index]! - avgPred;
    numerator += a * p;
    denomActual += a ** 2;
    denomPred += p ** 2;
  }
  const denominator = Math.sqrt(denomActual * denomPred);
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

export function validateModel(
  examples: TrainingExample[],
  modelWeights: ModelWeights = INITIAL_WEIGHTS,
): ValidationReport {
  if (examples.length === 0) {
    return { mae: 0, rmse: 0, pearsonR: 0, sampleSize: 0 };
  }

  const predictions = examples.map((example) =>
    predictFromFeatures(example.features, modelWeights),
  );
  const actuals = examples.map((example) => example.label);
  const errors = predictions.map((prediction, index) => prediction - actuals[index]!);
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length);

  return {
    mae: Number(mae.toFixed(4)),
    rmse: Number(rmse.toFixed(4)),
    pearsonR: pearsonR(actuals, predictions),
    sampleSize: examples.length,
  };
}
