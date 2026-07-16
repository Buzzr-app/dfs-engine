import { describe, expect, it } from 'vitest';

import {
  closingLineValueTool,
  fairLineTool,
  kellyStakeTool,
  parlayValueTool,
} from '../src/tools/odds';
import type { ToolResult } from '../src/tools/shared';

function parseResult(result: ToolResult): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe('fair_line', () => {
  it('splits a symmetric -110/-110 market at 50%', async () => {
    const result = await fairLineTool.handler({ selected: -110, opposite: -110 });

    expect(result.isError).toBeUndefined();
    const fair = parseResult(result);
    expect(fair.fairProbability).toBe(0.5);
    expect(fair.fairAmericanOdds).toBe(-100);
    expect(fair.overround as number).toBeCloseTo(0.0476, 3);
    expect(fair.edgePercent).toBe(-2.38);
  });

  it('labels the selected side when provided', async () => {
    const fair = parseResult(
      await fairLineTool.handler({ selected: 145, opposite: -170, selectedSide: 'Knicks ML' }),
    );

    expect(fair.selectedSide).toBe('Knicks ML');
    expect(fair.fairProbability as number).toBeGreaterThan(0);
    expect(fair.fairProbability as number).toBeLessThan(0.5);
  });

  it('rejects zero American odds via schema validation', async () => {
    const result = await fairLineTool.handler({ selected: 0, opposite: -110 });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });

  it('rejects an oversized selected-side label', async () => {
    const result = await fairLineTool.handler({
      selected: -110,
      opposite: -110,
      selectedSide: 'L'.repeat(201),
    });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});

describe('closing_line_value', () => {
  it('computes a versioned implied-probability delta', async () => {
    const result = await closingLineValueTool.handler({
      placedAmericanOdds: 110,
      closingAmericanOdds: -105,
    });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toEqual({
      contractVersion: '1',
      clvPercent: 3.6,
      beatClosingLine: true,
    });
  });

  it.each([
    ['zero odds', { placedAmericanOdds: 0, closingAmericanOdds: -110 }],
    ['positive odds below +100', { placedAmericanOdds: 99, closingAmericanOdds: -110 }],
    ['negative odds above -100', { placedAmericanOdds: -99, closingAmericanOdds: -110 }],
    ['positive odds above +100000', { placedAmericanOdds: 100_001, closingAmericanOdds: -110 }],
    ['negative odds below -100000', { placedAmericanOdds: -100_001, closingAmericanOdds: -110 }],
    [
      'non-finite odds',
      { placedAmericanOdds: Number.NEGATIVE_INFINITY, closingAmericanOdds: -110 },
    ],
  ])('rejects %s', async (_label, input) => {
    const result = await closingLineValueTool.handler(input);

    expect(result.isError).toBe(true);
    expect(parseResult(result).error as Record<string, unknown>).toMatchObject({
      code: 'invalid_input',
    });
  });

  it.each([-100_000, -100, 100, 100_000])('accepts boundary American odds %d', async (odds) => {
    const result = await closingLineValueTool.handler({
      placedAmericanOdds: odds,
      closingAmericanOdds: -110,
    });

    expect(result.isError).toBeUndefined();
  });
});

describe('parlay_value', () => {
  it('prices a two-leg -110/-110 parlay against its fair probability', async () => {
    const legs = [
      { selected: -110, opposite: -110 },
      { selected: -110, opposite: -110 },
    ];
    const value = parseResult(await parlayValueTool.handler({ legs }));

    expect(value.fairProbability).toBe(0.25);
    expect(value.fairAmericanOdds).toBe(300);
    expect(value.combinedLegOdds).toBe(264);
    expect(value.offeredAmericanOdds).toBe(264);
    expect(value.edgePercent as number).toBeLessThan(0);
    expect(value.legFairProbabilities).toEqual([0.5, 0.5]);
    expect(value.expectedValue).toBeUndefined();
  });

  it('computes expected value at a fair offered price', async () => {
    const legs = [
      { selected: -110, opposite: -110 },
      { selected: -110, opposite: -110 },
    ];
    const value = parseResult(
      await parlayValueTool.handler({ legs, offeredAmericanOdds: 300, stake: 100 }),
    );

    expect(value.offeredAmericanOdds).toBe(300);
    expect(value.edgePercent).toBe(0);
    expect(value.expectedValue).toEqual({ expectedValue: 0, expectedRoiPercent: 0 });
  });

  it('rejects an empty legs array', async () => {
    const result = await parlayValueTool.handler({ legs: [] });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });

  it('rejects more than 50 parlay legs', async () => {
    const result = await parlayValueTool.handler({
      legs: Array.from({ length: 51 }, () => ({ selected: -110, opposite: -110 })),
    });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});

describe('kelly_stake', () => {
  it('computes half-Kelly for a +100 coin flip with 55% win probability', async () => {
    const stake = parseResult(
      await kellyStakeTool.handler({
        bankroll: 1000,
        americanOdds: 100,
        winProbability: 0.55,
        fraction: 0.5,
      }),
    );

    expect(stake.fullKellyFraction).toBe(0.1);
    expect(stake.recommendedFraction).toBe(0.05);
    expect(stake.recommendedStake).toBe(50);
  });

  it('defaults to quarter-Kelly', async () => {
    const stake = parseResult(
      await kellyStakeTool.handler({ bankroll: 1000, americanOdds: 100, winProbability: 0.55 }),
    );

    expect(stake.recommendedFraction).toBe(0.025);
    expect(stake.recommendedStake).toBe(25);
  });

  it('clamps -EV bets to a zero stake', async () => {
    const stake = parseResult(
      await kellyStakeTool.handler({ bankroll: 1000, americanOdds: -200, winProbability: 0.55 }),
    );

    expect(stake.fullKellyFraction).toBe(0);
    expect(stake.recommendedStake).toBe(0);
  });

  it('rejects out-of-range win probabilities', async () => {
    const result = await kellyStakeTool.handler({
      bankroll: 1000,
      americanOdds: 100,
      winProbability: 1.2,
    });

    expect(result.isError).toBe(true);
    expect((parseResult(result).error as Record<string, unknown>).code).toBe('invalid_input');
  });
});
