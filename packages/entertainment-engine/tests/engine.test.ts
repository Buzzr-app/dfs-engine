import {
  ENGINE_PACKAGE_VERSION,
  easternUtcOffsetMinutes,
  enrichGameRowWithBuzzScores,
  extractFeatures,
  normalizeTeamName,
  predictGame,
  predictGameWithDiagnostics,
  resolveBuzzScores,
  trainSGD,
  validateModel,
  type EntertainmentGameInput,
  type TrainingExample,
} from '../src/index';
import { describe, expect, it } from 'vitest';

// A fixed clock earlier than every fixture start date keeps these tests
// stable forever, regardless of when they run.
const FIXED_NOW = Date.UTC(2026, 4, 1, 0, 0, 0);

const marqueeGame: EntertainmentGameInput = {
  league: 'NBA',
  status: 'scheduled',
  startsAt: '2026-06-12T01:00:00Z',
  homeTeam: 'Boston Celtics',
  awayTeam: 'Los Angeles Lakers',
};

describe('@buzzr/entertainment-engine transparent scoring', () => {
  it('exposes the 5.0.0 package version', () => {
    expect(ENGINE_PACKAGE_VERSION).toBe('5.0.0');
  });

  it('returns deterministic predicted scores with explainable factors', () => {
    const first = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: FIXED_NOW });
    const second = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: FIXED_NOW });

    expect(first).toEqual(second);
    expect(first.predictedEntertainmentScore).toBeGreaterThanOrEqual(1);
    expect(first.predictedEntertainmentScore).toBeLessThanOrEqual(10);
    expect(first.diagnostics?.kind).toBe('predicted');
    expect(first.diagnostics?.factors.length).toBeGreaterThan(0);
  });

  it('enriches database-style rows without mutating the original row', () => {
    const row = {
      id: 'game-1',
      league: 'NBA',
      status: 'scheduled',
      starts_at: '2026-06-12T01:00:00Z',
      home_team: 'Boston Celtics',
      away_team: 'Los Angeles Lakers',
      entertainment_score: null,
      predicted_entertainment_score: null,
    };

    const enriched = enrichGameRowWithBuzzScores(row, { now: FIXED_NOW });

    expect(enriched).not.toBe(row);
    expect(row.predicted_entertainment_score).toBeNull();
    expect(enriched.predicted_entertainment_score).toEqual(expect.any(Number));
  });
});

describe('injectable clock', () => {
  it('accepts now as a number or a Date and produces identical results', () => {
    const fromNumber = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: FIXED_NOW });
    const fromDate = resolveBuzzScores(marqueeGame, {
      upcomingLike: true,
      now: new Date(FIXED_NOW),
    });

    expect(fromNumber).toEqual(fromDate);
  });

  it('threads now through the countdown-urgency factor', () => {
    const twoHoursBefore = Date.UTC(2026, 5, 11, 23, 0, 0); // 2h before tipoff
    const elevenDaysBefore = Date.UTC(2026, 5, 1, 0, 0, 0); // >168h before tipoff

    const imminent = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: twoHoursBefore });
    const distant = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: elevenDaysBefore });

    const imminentLeadup = imminent.diagnostics?.factors.find((f) => f.id === 'leadup');
    const distantLeadup = distant.diagnostics?.factors.find((f) => f.id === 'leadup');
    expect(imminentLeadup?.impact).toBe(0.34);
    expect(distantLeadup?.impact).toBe(-0.28);
  });

  it('treats rows in the future of the injected clock as upcoming', () => {
    const row = {
      id: 'game-2',
      league: 'NBA',
      status: 'scheduled',
      starts_at: '2026-06-12T01:00:00Z',
      home_team: 'Sacramento Kings',
      away_team: 'Utah Jazz',
      entertainment_score: null,
      predicted_entertainment_score: null,
    };

    const beforeStart = enrichGameRowWithBuzzScores(row, { now: FIXED_NOW });
    const afterStart = enrichGameRowWithBuzzScores(row, { now: Date.UTC(2026, 6, 1) });

    expect(beforeStart.predicted_entertainment_score).toEqual(expect.any(Number));
    expect(afterStart.predicted_entertainment_score).toBeNull();
  });
});

describe('team name normalization', () => {
  it('lowercases, trims, collapses whitespace, and strips diacritics', () => {
    expect(normalizeTeamName('  BOSTON   CELTICS  ')).toBe('boston celtics');
    expect(normalizeTeamName('Los Ángeles Lakers')).toBe('los angeles lakers');
    expect(normalizeTeamName('Club América')).toBe('club america');
    expect(normalizeTeamName(null)).toBe('');
  });

  it('matches rivalries case- and diacritic-insensitively', () => {
    const messy = resolveBuzzScores(
      { ...marqueeGame, homeTeam: 'BOSTON  CELTICS ', awayTeam: 'Los Ángeles Lakers' },
      { upcomingLike: true, now: FIXED_NOW },
    );
    const clean = resolveBuzzScores(marqueeGame, { upcomingLike: true, now: FIXED_NOW });

    expect(messy.diagnostics?.factors.some((f) => f.id === 'rivalry')).toBe(true);
    expect(messy.predictedEntertainmentScore).toBe(clean.predictedEntertainmentScore);
  });
});

describe('NFL rivalry expansion', () => {
  it('detects Bills-Bengals as a rivalry', () => {
    const result = resolveBuzzScores(
      {
        league: 'NFL',
        status: 'scheduled',
        startsAt: '2026-11-15T01:20:00Z',
        homeTeam: 'Buffalo Bills',
        awayTeam: 'Cincinnati Bengals',
      },
      { upcomingLike: true, now: Date.UTC(2026, 10, 14) },
    );

    const rivalry = result.diagnostics?.factors.find((f) => f.id === 'rivalry');
    expect(rivalry?.impact).toBe(0.57); // 0.52 * NFL rivalryWeight 1.1
  });

  it('detects other modern NFL rivalries', () => {
    for (const [home, away] of [
      ['Baltimore Ravens', 'Pittsburgh Steelers'],
      ['Kansas City Chiefs', 'Las Vegas Raiders'],
      ['Dallas Cowboys', 'San Francisco 49ers'],
    ]) {
      const result = resolveBuzzScores(
        {
          league: 'NFL',
          status: 'scheduled',
          startsAt: '2026-11-15T01:20:00Z',
          homeTeam: home,
          awayTeam: away,
        },
        { upcomingLike: true, now: Date.UTC(2026, 10, 14) },
      );
      expect(
        result.diagnostics?.factors.some((f) => f.id === 'rivalry'),
        `${home} vs ${away}`,
      ).toBe(true);
    }
  });
});

describe('timezone-safe primetime detection', () => {
  it('computes the US Eastern DST boundary from the statutory rule', () => {
    // DST starts 2026-03-08 07:00 UTC (second Sunday in March, 2 AM EST).
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 2, 8, 6, 59))).toBe(-300);
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 2, 8, 7, 0))).toBe(-240);
    // DST ends 2026-11-01 06:00 UTC (first Sunday in November, 2 AM EDT).
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 10, 1, 5, 59))).toBe(-240);
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 10, 1, 6, 0))).toBe(-300);
    // Mid-season sanity checks.
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 6, 4, 12, 0))).toBe(-240);
    expect(easternUtcOffsetMinutes(Date.UTC(2026, 0, 15, 12, 0))).toBe(-300);
  });

  it('does not drift across the March DST boundary', () => {
    const kings = {
      league: 'NBA',
      status: 'scheduled',
      homeTeam: 'Sacramento Kings',
      awayTeam: 'Utah Jazz',
    };
    const now = Date.UTC(2026, 2, 1);
    // Same 23:00 UTC clock time on both sides of the boundary:
    // EST → 18:00 local (early window), EDT → 19:00 local (primetime).
    const beforeDst = resolveBuzzScores(
      { ...kings, startsAt: '2026-03-07T23:00:00Z' },
      { upcomingLike: true, now },
    );
    const afterDst = resolveBuzzScores(
      { ...kings, startsAt: '2026-03-14T23:00:00Z' },
      { upcomingLike: true, now },
    );

    const beforeWindow = beforeDst.diagnostics?.factors.find((f) => f.id === 'time_window');
    const afterWindow = afterDst.diagnostics?.factors.find((f) => f.id === 'time_window');
    expect(beforeWindow?.impact).toBe(0.22); // 0.20 * NBA primeTimeWeight 1.08
    expect(afterWindow?.impact).toBe(0.41); // 0.38 * NBA primeTimeWeight 1.08
  });

  it('honors an explicit venueUtcOffsetMinutes', () => {
    const pacificAfternoon = resolveBuzzScores(
      {
        league: 'NBA',
        status: 'scheduled',
        startsAt: '2026-03-14T23:00:00Z',
        homeTeam: 'Sacramento Kings',
        awayTeam: 'Utah Jazz',
        venueUtcOffsetMinutes: -480, // 15:00 local - outside every boost window
      },
      { upcomingLike: true, now: Date.UTC(2026, 2, 1) },
    );

    expect(pacificAfternoon.diagnostics?.factors.some((f) => f.id === 'time_window')).toBe(false);
  });

  it('honors an explicit localStartHour above all derivations', () => {
    const morning = resolveBuzzScores(
      {
        league: 'NBA',
        status: 'scheduled',
        startsAt: '2026-03-14T23:00:00Z',
        homeTeam: 'Sacramento Kings',
        awayTeam: 'Utah Jazz',
        localStartHour: 9,
      },
      { upcomingLike: true, now: Date.UTC(2026, 2, 1) },
    );

    const window = morning.diagnostics?.factors.find((f) => f.id === 'time_window');
    expect(window?.impact).toBe(-0.24); // -0.22 * NBA primeTimeWeight 1.08
  });
});

describe('@buzzr/entertainment-engine hybrid ML', () => {
  it('extracts stable transparent feature vectors from optional context', () => {
    const features = extractFeatures(marqueeGame, {
      now: FIXED_NOW,
      odds: { spread: -1.5, overUnder: 226.5, homeMoneyline: -120, awayMoneyline: 105 },
      teamPower: { home: 9.2, away: 8.7 },
      matchupContext: {
        recentBuzzForm: 0.82,
        recentPerformanceLevel: 0.78,
        recentPerformanceBalance: 0.91,
        restFreshness: 0.8,
        restBalance: 1,
        rematchHeat: 0.6,
      },
    });

    expect(features.length).toBeGreaterThan(10);
    expect(features.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('returns prediction diagnostics with sorted factors and input signals', () => {
    const prediction = predictGameWithDiagnostics(marqueeGame, {
      now: FIXED_NOW,
      odds: { spread: -1.5, overUnder: 226.5 },
      teamPower: { home: 9.2, away: 8.7 },
    });

    expect(prediction?.score).toBeGreaterThanOrEqual(1);
    expect(prediction?.score).toBeLessThanOrEqual(10);
    expect(prediction?.modelVersion).toMatch(/^ml-/);
    expect(prediction?.factors.length).toBeGreaterThan(0);
    expect(prediction?.signals.some((signal) => signal.id === 'odds')).toBe(true);
  });

  it('validates trained weights without look-ahead metadata requirements', () => {
    const examples: TrainingExample[] = [
      {
        features: extractFeatures(
          { ...marqueeGame, homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' },
          { now: FIXED_NOW },
        ),
        label: 8.8,
        gameId: 'old-1',
      },
      {
        features: extractFeatures(
          { ...marqueeGame, homeTeam: 'Washington Wizards', awayTeam: 'Utah Jazz' },
          { now: FIXED_NOW },
        ),
        label: 3.2,
        gameId: 'old-2',
      },
      {
        features: extractFeatures(
          { ...marqueeGame, homeTeam: 'Denver Nuggets', awayTeam: 'Minnesota Timberwolves' },
          { now: FIXED_NOW },
        ),
        label: 8.1,
        gameId: 'new-1',
      },
      {
        features: extractFeatures(
          { ...marqueeGame, homeTeam: 'Portland Trail Blazers', awayTeam: 'Charlotte Hornets' },
          { now: FIXED_NOW },
        ),
        label: 3.8,
        gameId: 'new-2',
      },
    ];

    const weights = trainSGD(examples.slice(0, 2), { epochs: 40, lr: 0.01 });
    const report = validateModel(examples.slice(2), weights);

    expect(predictGame(marqueeGame, { now: FIXED_NOW }, weights)).toEqual(expect.any(Number));
    expect(report.sampleSize).toBe(2);
    expect(report.mae).toBeGreaterThanOrEqual(0);
    expect(report.rmse).toBeGreaterThanOrEqual(report.mae);
  });
});
