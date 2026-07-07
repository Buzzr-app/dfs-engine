import {
  INITIAL_WEIGHTS,
  buildModelRunReport,
  extractFeatures,
  trainSGD,
  type ModelReportExample,
} from '../src/index';
import { describe, expect, it } from 'vitest';

const game = {
  league: 'NBA',
  status: 'final',
  startsAt: '2026-04-01T00:00:00Z',
  homeTeam: 'Boston Celtics',
  awayTeam: 'Los Angeles Lakers',
  homeScore: 111,
  awayScore: 109,
  entertainmentScore: 8.8,
};

function example(overrides: Partial<ModelReportExample>): ModelReportExample {
  const nextGame = {
    ...game,
    homeTeam: overrides.game?.homeTeam ?? game.homeTeam,
    awayTeam: overrides.game?.awayTeam ?? game.awayTeam,
    entertainmentScore: overrides.game?.entertainmentScore ?? game.entertainmentScore,
  };
  return {
    gameId: overrides.gameId ?? nextGame.homeTeam,
    league: overrides.league ?? 'NBA',
    startsAt: overrides.startsAt ?? nextGame.startsAt,
    label: overrides.label ?? 8,
    labelSource: overrides.labelSource ?? 'rating',
    features: overrides.features ?? extractFeatures(nextGame, overrides.context),
    game: nextGame,
    context: overrides.context ?? {
      odds: { spread: -2.5, overUnder: 224.5 },
      engagement: { averageRating: overrides.label ?? 8, ratingCount: 4 },
    },
  };
}

describe('model reporting', () => {
  it('builds deterministic model run reports with accuracy, drift, confidence, labels, and factor impact', () => {
    const trainExamples = [
      example({ gameId: 'train-1', label: 8.7, labelSource: 'rating' }),
      example({
        gameId: 'train-2',
        label: 7.9,
        labelSource: 'swipe',
        game: { ...game, homeTeam: 'New York Knicks' },
      }),
      example({
        gameId: 'train-3',
        label: 5.2,
        labelSource: 'score',
        game: {
          ...game,
          homeTeam: 'Utah Jazz',
          awayTeam: 'Washington Wizards',
          entertainmentScore: 5.2,
        },
      }),
    ];
    const testExamples = [
      example({ gameId: 'test-1', label: 8.4, labelSource: 'rating' }),
      example({
        gameId: 'test-2',
        label: 3.4,
        labelSource: 'swipe',
        game: {
          ...game,
          homeTeam: 'Charlotte Hornets',
          awayTeam: 'Portland Trail Blazers',
          entertainmentScore: 3.4,
        },
      }),
      example({
        gameId: 'test-3',
        label: 6.2,
        labelSource: 'score',
        game: {
          ...game,
          homeTeam: 'Sacramento Kings',
          awayTeam: 'Atlanta Hawks',
          entertainmentScore: 6.2,
        },
      }),
    ];
    const trainedWeights = trainSGD(trainExamples, { epochs: 20, lr: 0.005 });

    const report = buildModelRunReport({
      trainExamples,
      testExamples,
      baselineWeights: INITIAL_WEIGHTS,
      trainedWeights,
      packageVersion: '0.2.0',
      generatedAt: '2026-05-13T06:00:00.000Z',
      minExamples: 3,
    });

    expect(report.status).toBe('ok');
    expect(report.packageVersion).toBe('0.2.0');
    expect(report.sampleSize).toBe(6);
    expect(report.trainSize).toBe(3);
    expect(report.testSize).toBe(3);
    expect(report.labelMix.map((entry) => entry.source).sort()).toEqual([
      'rating',
      'score',
      'swipe',
    ]);
    expect(report.baselineMetrics?.sampleSize).toBe(3);
    expect(report.trainedMetrics?.topWatchPrecision).not.toBeUndefined();
    expect(report.drift.averageAbsoluteDelta).toEqual(expect.any(Number));
    expect(report.confidenceCalibration.length).toBeGreaterThan(0);
    expect(report.factorImpact.length).toBeGreaterThan(0);
    expect(report.samples).toHaveLength(3);
    expect(report.samples[0]).toMatchObject({
      gameId: expect.any(String),
      labelSource: expect.stringMatching(/rating|swipe|score/),
      baselinePrediction: expect.any(Number),
      trainedPrediction: expect.any(Number),
      confidence: expect.any(Number),
    });
  });

  it('returns an insufficient-data report without throwing on sparse runs', () => {
    const report = buildModelRunReport({
      trainExamples: [],
      testExamples: [],
      minExamples: 10,
    });

    expect(report.status).toBe('insufficient_data');
    expect(report.baselineMetrics).toBeNull();
    expect(report.trainedMetrics).toBeNull();
    expect(report.samples).toEqual([]);
    expect(report.labelMix).toEqual([]);
  });

  it('carries the trained model version through to the report', () => {
    const trainExamples = [
      example({ gameId: 'train-1', label: 8.7, labelSource: 'rating' }),
      example({
        gameId: 'train-2',
        label: 7.9,
        labelSource: 'swipe',
        game: { ...game, homeTeam: 'New York Knicks' },
      }),
    ];
    const testExamples = [example({ gameId: 'test-1', label: 8.4, labelSource: 'rating' })];
    const trainedWeights = trainSGD(trainExamples, { epochs: 10, lr: 0.005 });

    const report = buildModelRunReport({
      trainExamples,
      testExamples,
      baselineWeights: INITIAL_WEIGHTS,
      trainedWeights,
      generatedAt: '2026-07-06T06:00:00.000Z',
      minExamples: 3,
    });
    expect(report.modelVersion).toBe('ml-v5');

    const baselineOnly = buildModelRunReport({
      trainExamples,
      testExamples,
      generatedAt: '2026-07-06T06:00:00.000Z',
      minExamples: 3,
    });
    expect(baselineOnly.modelVersion).toBe('ml-v1-transparent');
  });
});
