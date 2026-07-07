import {
  FEATURE_NAMES,
  INITIAL_WEIGHTS,
  ML_MODEL_VERSION,
  predictFromFeatures,
  predictGameWithDiagnostics,
  validateModel,
} from './ml';
import type {
  AccuracyReport,
  ConfidenceCalibrationBucket,
  FactorImpactSummary,
  LabelSourceSummary,
  MLFeatureValue,
  ModelDriftReport,
  ModelReportExample,
  ModelRunReport,
  ModelWeights,
  PredictionSampleReport,
  TrainingLabelSource,
} from './types';

type ModelRunReportInput = {
  trainExamples: ModelReportExample[];
  testExamples: ModelReportExample[];
  baselineWeights?: ModelWeights;
  trainedWeights?: ModelWeights;
  minExamples?: number;
  highDriftThreshold?: number;
  packageVersion?: string | null;
  modelVersion?: string;
  generatedAt?: string;
};

const LABEL_ORDER: TrainingLabelSource[] = ['rating', 'swipe', 'score'];

function round(value: number | null | undefined, digits = 4): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function average(values: number[], digits = 4): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, digits);
}

function absoluteError(prediction: number, label: number): number {
  return Number(Math.abs(prediction - label).toFixed(4));
}

function buildAccuracyReport(
  examples: ModelReportExample[],
  weights: ModelWeights,
): AccuracyReport {
  const metrics = validateModel(examples, weights);
  const predictions = examples.map((example) => predictFromFeatures(example.features, weights));
  const topWatchPredictions = predictions
    .map((prediction, index) => ({ prediction, label: examples[index]!.label }))
    .filter((sample) => sample.prediction >= 8);
  return {
    ...metrics,
    averagePrediction: average(predictions),
    averageLabel: average(examples.map((example) => example.label)),
    topWatchPrecision:
      topWatchPredictions.length === 0
        ? null
        : round(
            topWatchPredictions.filter((sample) => sample.label >= 8).length /
              topWatchPredictions.length,
          ),
  };
}

function labelMix(examples: ModelReportExample[]): LabelSourceSummary[] {
  return LABEL_ORDER.map((source) => {
    const matching = examples.filter((example) => example.labelSource === source);
    return {
      source,
      count: matching.length,
      averageLabel: average(matching.map((example) => example.label)),
    };
  }).filter((entry) => entry.count > 0);
}

function bucketConfidence(confidence: number): string {
  if (confidence < 0.4) return 'low';
  if (confidence < 0.7) return 'medium';
  return 'high';
}

function getFeatureValues(example: ModelReportExample, weights: ModelWeights): MLFeatureValue[] {
  if (example.game) {
    const diagnostics = predictGameWithDiagnostics(example.game, example.context, weights);
    if (diagnostics) return diagnostics.featureValues;
  }
  return FEATURE_NAMES.map((id, index) => {
    const value = example.features[index] ?? 0;
    const impact = (weights.weights[index] ?? 0) * value;
    return {
      id,
      label: id,
      value: round(value) ?? 0,
      displayValue: `${Math.round(value * 100)}%`,
      impact: round(impact, 2) ?? 0,
    };
  }).sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact));
}

function getConfidence(example: ModelReportExample, weights: ModelWeights): number {
  if (example.game) {
    return predictGameWithDiagnostics(example.game, example.context, weights)?.confidence ?? 0.5;
  }
  return 0.5;
}

function getMissingSignals(example: ModelReportExample, weights: ModelWeights): string[] {
  if (!example.game) return [];
  const diagnostics = predictGameWithDiagnostics(example.game, example.context, weights);
  return (
    diagnostics?.signals
      .filter((signal) => signal.status === 'missing')
      .map((signal) => signal.id) ?? []
  );
}

function buildSample(
  example: ModelReportExample,
  baselineWeights: ModelWeights,
  trainedWeights: ModelWeights,
): PredictionSampleReport {
  const baselinePrediction = predictFromFeatures(example.features, baselineWeights);
  const trainedPrediction = predictFromFeatures(example.features, trainedWeights);
  const topFactors = getFeatureValues(example, trainedWeights)
    .filter((feature) => Math.abs(feature.impact) >= 0.08)
    .slice(0, 6)
    .map((feature) => ({
      id: feature.id,
      label: feature.label,
      impact: feature.impact,
    }));
  return {
    gameId: example.gameId,
    league: example.league ?? example.game?.league,
    startsAt: example.startsAt ?? example.game?.startsAt,
    labelSource: example.labelSource,
    label: round(example.label) ?? example.label,
    baselinePrediction,
    trainedPrediction,
    baselineError: absoluteError(baselinePrediction, example.label),
    trainedError: absoluteError(trainedPrediction, example.label),
    driftDelta: round(trainedPrediction - baselinePrediction) ?? 0,
    confidence: getConfidence(example, trainedWeights),
    topFactors,
    missingSignals: getMissingSignals(example, trainedWeights),
  };
}

function buildDriftReport(samples: PredictionSampleReport[], threshold: number): ModelDriftReport {
  const deltas = samples.map((sample) => sample.driftDelta);
  return {
    averageDelta: average(deltas),
    averageAbsoluteDelta: average(deltas.map((delta) => Math.abs(delta))),
    highDriftCount: deltas.filter((delta) => Math.abs(delta) >= threshold).length,
    threshold,
  };
}

function buildConfidenceCalibration(
  samples: PredictionSampleReport[],
): ConfidenceCalibrationBucket[] {
  return ['low', 'medium', 'high']
    .map((bucket) => {
      const matching = samples.filter((sample) => bucketConfidence(sample.confidence) === bucket);
      return {
        bucket,
        count: matching.length,
        averageConfidence: average(matching.map((sample) => sample.confidence)),
        averageError: average(matching.map((sample) => sample.trainedError)),
        averageLabel: average(matching.map((sample) => sample.label)),
        averagePrediction: average(matching.map((sample) => sample.trainedPrediction)),
      };
    })
    .filter((entry) => entry.count > 0);
}

function buildFactorImpact(
  examples: ModelReportExample[],
  trainedWeights: ModelWeights,
): FactorImpactSummary[] {
  const buckets = new Map<
    string,
    {
      label: string;
      impacts: number[];
      positiveCount: number;
      negativeCount: number;
    }
  >();
  for (const example of examples) {
    for (const feature of getFeatureValues(example, trainedWeights)) {
      const existing = buckets.get(feature.id) ?? {
        label: feature.label,
        impacts: [],
        positiveCount: 0,
        negativeCount: 0,
      };
      existing.impacts.push(feature.impact);
      if (feature.impact > 0) existing.positiveCount += 1;
      if (feature.impact < 0) existing.negativeCount += 1;
      buckets.set(feature.id, existing);
    }
  }
  return [...buckets.entries()]
    .map(([id, bucket]) => ({
      id,
      label: bucket.label,
      averageImpact: average(bucket.impacts, 2) ?? 0,
      averageAbsoluteImpact:
        average(
          bucket.impacts.map((impact) => Math.abs(impact)),
          2,
        ) ?? 0,
      positiveCount: bucket.positiveCount,
      negativeCount: bucket.negativeCount,
      sampleCount: bucket.impacts.length,
    }))
    .sort((left, right) => right.averageAbsoluteImpact - left.averageAbsoluteImpact)
    .slice(0, 12);
}

function emptyDrift(threshold: number): ModelDriftReport {
  return {
    averageDelta: null,
    averageAbsoluteDelta: null,
    highDriftCount: 0,
    threshold,
  };
}

export function buildModelRunReport(input: ModelRunReportInput): ModelRunReport {
  const minExamples = input.minExamples ?? 10;
  const highDriftThreshold = input.highDriftThreshold ?? 0.5;
  const baselineWeights = input.baselineWeights ?? INITIAL_WEIGHTS;
  const trainedWeights = input.trainedWeights ?? baselineWeights;
  const allExamples = [...input.trainExamples, ...input.testExamples];
  const base = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    packageVersion: input.packageVersion ?? null,
    // Carry the trained model's version through when the caller didn't pin one.
    modelVersion: input.modelVersion ?? trainedWeights.modelVersion ?? ML_MODEL_VERSION,
    minExamples,
    sampleSize: allExamples.length,
    trainSize: input.trainExamples.length,
    testSize: input.testExamples.length,
    labelMix: labelMix(allExamples),
  };

  if (allExamples.length < minExamples) {
    return {
      ...base,
      status: 'insufficient_data',
      baselineMetrics: null,
      trainedMetrics: null,
      improved: false,
      promotionReady: false,
      drift: emptyDrift(highDriftThreshold),
      confidenceCalibration: [],
      factorImpact: [],
      samples: [],
      weights: null,
    };
  }

  if (input.testExamples.length === 0) {
    return {
      ...base,
      status: 'insufficient_test_data',
      baselineMetrics: null,
      trainedMetrics: null,
      improved: false,
      promotionReady: false,
      drift: emptyDrift(highDriftThreshold),
      confidenceCalibration: [],
      factorImpact: [],
      samples: [],
      weights: null,
    };
  }

  const samples = input.testExamples.map((example) =>
    buildSample(example, baselineWeights, trainedWeights),
  );
  const baselineMetrics = buildAccuracyReport(input.testExamples, baselineWeights);
  const trainedMetrics = buildAccuracyReport(input.testExamples, trainedWeights);
  const improved =
    trainedMetrics.mae < baselineMetrics.mae && trainedMetrics.rmse < baselineMetrics.rmse;
  const drift = buildDriftReport(samples, highDriftThreshold);

  return {
    ...base,
    status: 'ok',
    baselineMetrics,
    trainedMetrics,
    improved,
    promotionReady: improved && drift.highDriftCount === 0,
    drift,
    confidenceCalibration: buildConfidenceCalibration(samples),
    factorImpact: buildFactorImpact(input.testExamples, trainedWeights),
    samples,
    weights: trainedWeights,
  };
}
