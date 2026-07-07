import {
  FEATURE_NAMES,
  INITIAL_WEIGHTS,
  LEGACY_FEATURE_COUNT,
  ML_MODEL_VERSION,
  ML_MODEL_VERSION_V5,
  applyConfidenceCalibration,
  extractFeatures,
  predictFromFeatures,
  predictGame,
  predictGameWithDiagnostics,
  trainSGD,
  type EntertainmentGameInput,
  type ModelWeights,
  type PredictionContext,
  type TrainingExample,
} from '../src/index';
import { describe, expect, it } from 'vitest';

const FIXED_NOW = Date.UTC(2026, 4, 1, 0, 0, 0);

const game: EntertainmentGameInput = {
  league: 'NBA',
  status: 'scheduled',
  startsAt: '2026-06-12T01:00:00Z',
  homeTeam: 'Boston Celtics',
  awayTeam: 'Los Angeles Lakers',
};

const richContext: PredictionContext = {
  now: FIXED_NOW,
  odds: { spread: -1.5, overUnder: 226.5, homeMoneyline: -120, awayMoneyline: 105 },
  teamPower: { home: 9.2, away: 8.7 },
};

/** Frozen copy of the published v1 weights (20 features, no v5 metadata). */
const OLD_V1_WEIGHTS: ModelWeights = {
  bias: 1.05,
  weights: [
    4.2, 0.42, 0.38, 0.46, 0.52, 0.52, 0.3, 0.16, 0.12, 0.34, 0.2, 0.42, 0.2, 0.14, 0.08, 0.08,
    0.34, 0.2, 0.2, 0.46,
  ],
};

function heatExample(heat: number, label: number, index: number): TrainingExample {
  return {
    gameId: `heat-${index}`,
    label,
    features: extractFeatures(game, {
      now: FIXED_NOW,
      searchHeat: { home: heat, away: heat },
      starPower: (heat + 1) / 2,
    }),
  };
}

// Chronologically ordered synthetic set where search heat tracks the label.
const heatExamples: TrainingExample[] = Array.from({ length: 12 }, (_, index) =>
  heatExample(index % 2 === 0 ? -1 : 1, index % 2 === 0 ? 3 : 9, index),
);

describe('v5 feature vector', () => {
  it('appends searchHeat and starPower as features 21 and 22', () => {
    expect(FEATURE_NAMES.length).toBe(22);
    expect(FEATURE_NAMES[20]).toBe('searchHeat');
    expect(FEATURE_NAMES[21]).toBe('starPower');

    const hot = extractFeatures(game, {
      now: FIXED_NOW,
      searchHeat: { home: 1, away: 1 },
      starPower: 0.9,
    });
    expect(hot).toHaveLength(22);
    expect(hot[20]).toBe(1); // +1 heat normalized to 1
    expect(hot[21]).toBe(0.9);

    const cold = extractFeatures(game, {
      now: FIXED_NOW,
      searchHeat: { home: -1, away: -1 },
    });
    expect(cold[20]).toBe(0); // -1 heat normalized to 0
    expect(cold[21]).toBe(0.5); // starPower absent → neutral

    const neutral = extractFeatures(game, { now: FIXED_NOW });
    expect(neutral[20]).toBe(0.5); // searchHeat absent → neutral
    expect(neutral[21]).toBe(0.5);
  });

  it('clamps out-of-range searchHeat inputs into [-1, 1]', () => {
    const clamped = extractFeatures(game, {
      now: FIXED_NOW,
      searchHeat: { home: 5, away: 5 },
    });
    expect(clamped[20]).toBe(1);
  });
});

describe('v1 weight backward compatibility', () => {
  it('keeps INITIAL_WEIGHTS at the legacy 20-feature shape', () => {
    expect(INITIAL_WEIGHTS.weights).toHaveLength(LEGACY_FEATURE_COUNT);
    expect(INITIAL_WEIGHTS.modelVersion).toBeUndefined();
  });

  it('predicts identically to pre-v5 releases with old v1 weights', () => {
    const features = extractFeatures(game, richContext);
    expect(features).toHaveLength(22);

    // The pre-v5 prediction is bias + dot(weights, first 20 features), clamped.
    const legacySum = OLD_V1_WEIGHTS.weights.reduce(
      (sum, weight, index) => sum + weight * (features[index] ?? 0),
      OLD_V1_WEIGHTS.bias,
    );
    const legacyPrediction = Math.max(1, Math.min(10, Number(legacySum.toFixed(2))));

    expect(predictFromFeatures(features, OLD_V1_WEIGHTS)).toBe(legacyPrediction);
  });

  it('ignores the new context signals entirely under old v1 weights', () => {
    const withNewSignals = predictGame(
      game,
      { ...richContext, searchHeat: { home: 1, away: 1 }, starPower: 1 },
      OLD_V1_WEIGHTS,
    );
    const withoutNewSignals = predictGame(game, richContext, OLD_V1_WEIGHTS);

    expect(withNewSignals).toBe(withoutNewSignals);
  });

  it('reports the v1 model version for weights without version metadata', () => {
    const diagnostics = predictGameWithDiagnostics(game, richContext, OLD_V1_WEIGHTS);
    expect(diagnostics?.modelVersion).toBe(ML_MODEL_VERSION);
  });
});

describe('trainSGD v5', () => {
  it('emits ml-v5 weights with standardization statistics', () => {
    const trained = trainSGD(heatExamples, { epochs: 50 });

    expect(trained.modelVersion).toBe(ML_MODEL_VERSION_V5);
    expect(trained.weights).toHaveLength(22);
    expect(trained.featureMeans).toHaveLength(22);
    expect(trained.featureStds).toHaveLength(22);
  });

  it('skips standardization statistics when standardize is false', () => {
    const trained = trainSGD(heatExamples, { epochs: 20, standardize: false });
    expect(trained.featureMeans).toBeUndefined();
    expect(trained.featureStds).toBeUndefined();
  });

  it('is deterministic under seeded shuffle with momentum', () => {
    const opts = { epochs: 60, shuffle: true, seed: 42, momentum: 0.9 };
    const first = trainSGD(heatExamples, opts);
    const second = trainSGD(heatExamples, opts);

    expect(first).toEqual(second);
  });

  it('momentum changes the optimization trajectory', () => {
    const plain = trainSGD(heatExamples, { epochs: 25, convergenceThreshold: 0 });
    const withMomentum = trainSGD(heatExamples, {
      epochs: 25,
      convergenceThreshold: 0,
      momentum: 0.9,
    });

    expect(withMomentum.weights).not.toEqual(plain.weights);
  });

  it('stops early on validation MAE plateau and stores calibration bins', () => {
    const trained = trainSGD(heatExamples, {
      epochs: 4000,
      convergenceThreshold: 0,
      validationSplit: 0.25,
      earlyStopping: true,
      patience: 3,
    });

    expect(trained.trainedEpochs).toBeLessThan(4000);
    expect(trained.confidenceCalibration).toBeDefined();
    expect(trained.confidenceCalibration).toHaveLength(5);
    for (const point of trained.confidenceCalibration ?? []) {
      expect(point.raw).toBeGreaterThanOrEqual(0);
      expect(point.raw).toBeLessThanOrEqual(1);
      expect(point.calibrated).toBeGreaterThanOrEqual(0);
      expect(point.calibrated).toBeLessThanOrEqual(1);
    }
  });

  it('learns from the searchHeat feature in trained v5 weights', () => {
    const trained = trainSGD(heatExamples, { epochs: 120, seed: 7 });

    const hot = predictGame(
      game,
      { now: FIXED_NOW, searchHeat: { home: 1, away: 1 }, starPower: 1 },
      trained,
    );
    const cold = predictGame(
      game,
      { now: FIXED_NOW, searchHeat: { home: -1, away: -1 }, starPower: 0 },
      trained,
    );

    expect(hot).not.toBeNull();
    expect(cold).not.toBeNull();
    expect(hot!).toBeGreaterThan(cold!);
  });
});

describe('confidence calibration', () => {
  it('interpolates piecewise-linearly between control points', () => {
    const bins = [
      { raw: 0, calibrated: 0 },
      { raw: 0.5, calibrated: 0.2 },
      { raw: 1, calibrated: 1 },
    ];
    expect(applyConfidenceCalibration(0, bins)).toBe(0);
    expect(applyConfidenceCalibration(0.25, bins)).toBeCloseTo(0.1, 6);
    expect(applyConfidenceCalibration(0.5, bins)).toBeCloseTo(0.2, 6);
    expect(applyConfidenceCalibration(0.75, bins)).toBeCloseTo(0.6, 6);
    expect(applyConfidenceCalibration(1, bins)).toBe(1);
    // Without bins the raw confidence passes through.
    expect(applyConfidenceCalibration(0.66, undefined)).toBeCloseTo(0.66, 6);
  });

  it('is applied by predictGameWithDiagnostics when present in the weights', () => {
    const halved: ModelWeights = {
      ...OLD_V1_WEIGHTS,
      confidenceCalibration: [
        { raw: 0, calibrated: 0 },
        { raw: 1, calibrated: 0.5 },
      ],
    };

    const withCalibration = predictGameWithDiagnostics(game, richContext, halved);
    const withoutCalibration = predictGameWithDiagnostics(game, richContext, OLD_V1_WEIGHTS);

    expect(withCalibration?.score).toBe(withoutCalibration?.score);
    expect(withCalibration?.confidence).toBeCloseTo((withoutCalibration?.confidence ?? 0) * 0.5, 3);
  });

  it('reports ml-v5 as the model version of freshly trained weights', () => {
    const trained = trainSGD(heatExamples, { epochs: 30 });
    const diagnostics = predictGameWithDiagnostics(game, richContext, trained);
    expect(diagnostics?.modelVersion).toBe(ML_MODEL_VERSION_V5);
  });
});
