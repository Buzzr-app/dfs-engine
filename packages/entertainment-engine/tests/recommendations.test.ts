import {
  MAX_AFFINITY_ADJUSTMENT,
  MAX_SOCIAL_ADJUSTMENT,
  explainRecommendation,
  rankGamesForUser,
  type EntertainmentGameInput,
  type RecommendationGameEntry,
  type UserAffinityProfile,
} from '../src/index';
import { describe, expect, it } from 'vitest';

const FIXED_NOW = Date.UTC(2026, 4, 1, 0, 0, 0);

function upcomingGame(overrides: Partial<EntertainmentGameInput> = {}): EntertainmentGameInput {
  return {
    league: 'NBA',
    status: 'scheduled',
    startsAt: '2026-06-12T01:00:00Z',
    homeTeam: 'Sacramento Kings',
    awayTeam: 'Utah Jazz',
    ...overrides,
  };
}

describe('rankGamesForUser', () => {
  it('ranks by base score plus bounded affinity and social adjustments', () => {
    const entries: RecommendationGameEntry[] = [
      {
        id: 'a',
        game: upcomingGame({ homeTeam: 'Boston Celtics', awayTeam: 'Utah Jazz' }),
        baseScore: 7,
      },
      {
        id: 'b',
        game: upcomingGame({
          league: 'NFL',
          startsAt: '2026-06-13T01:00:00Z',
          homeTeam: 'Dallas Cowboys',
          awayTeam: 'New York Giants',
        }),
        baseScore: 7,
      },
      {
        id: 'c',
        game: upcomingGame({
          league: 'NHL',
          startsAt: '2026-06-14T01:00:00Z',
          homeTeam: 'Boston Bruins',
          awayTeam: 'Ottawa Senators',
        }),
        baseScore: 7,
      },
    ];
    const profile: UserAffinityProfile = {
      favoriteTeams: ['  boston   CELTICS '], // exercises normalization
      socialSignal: { b: 1 },
    };

    const ranked = rankGamesForUser(entries, profile, { now: FIXED_NOW });

    // a: 7 + 0.75 favorite team; b: 7 + 0.75 social → tie at 7.75, a starts
    // earlier so it wins the tie-break; c stays at 7.
    expect(ranked.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(ranked[0]?.affinityAdjustment).toBe(0.75);
    expect(ranked[0]?.socialAdjustment).toBe(0);
    expect(ranked[1]?.socialAdjustment).toBe(MAX_SOCIAL_ADJUSTMENT);
    expect(ranked[0]?.totalScore).toBe(7.75);
    expect(ranked[2]?.totalScore).toBe(7);
  });

  it('bounds the affinity adjustment at +/-1.5', () => {
    const entry: RecommendationGameEntry = {
      id: 'stacked',
      game: upcomingGame({ homeTeam: 'Boston Celtics', awayTeam: 'Los Angeles Lakers' }),
      baseScore: 6,
    };
    const profile: UserAffinityProfile = {
      favoriteTeams: ['Boston Celtics', 'Los Angeles Lakers'],
      favoriteLeagues: ['nba'],
      teamAffinity: { 'boston celtics': 1, 'los angeles lakers': 1 },
      leagueAffinity: { NBA: 1 },
    };

    const [ranked] = rankGamesForUser([entry], profile, { now: FIXED_NOW });

    expect(ranked?.affinityAdjustment).toBe(MAX_AFFINITY_ADJUSTMENT);
    expect(ranked?.totalScore).toBe(7.5);
  });

  it('bounds the social adjustment at +/-0.75 and clamps the fire ratio', () => {
    const entries: RecommendationGameEntry[] = [
      { id: 'hyped', game: upcomingGame(), baseScore: 6 },
      {
        id: 'skipped',
        game: upcomingGame({ startsAt: '2026-06-13T01:00:00Z' }),
        baseScore: 6,
      },
    ];
    const profile: UserAffinityProfile = {
      socialSignal: { hyped: 5, skipped: -1 }, // 5 is out of range → clamped to 1
    };

    const ranked = rankGamesForUser(entries, profile, { now: FIXED_NOW });

    expect(ranked[0]?.id).toBe('hyped');
    expect(ranked[0]?.socialAdjustment).toBe(MAX_SOCIAL_ADJUSTMENT);
    expect(ranked[1]?.socialAdjustment).toBe(-MAX_SOCIAL_ADJUSTMENT);
  });

  it('breaks exact ties by start time, then id', () => {
    const sameStart = '2026-06-12T01:00:00Z';
    const entries: RecommendationGameEntry[] = [
      { id: 'z', game: upcomingGame({ startsAt: sameStart }), baseScore: 6 },
      { id: 'a', game: upcomingGame({ startsAt: sameStart }), baseScore: 6 },
      { id: 'later', game: upcomingGame({ startsAt: '2026-06-13T01:00:00Z' }), baseScore: 6 },
      { id: 'earlier', game: upcomingGame({ startsAt: '2026-06-11T01:00:00Z' }), baseScore: 6 },
    ];

    const ranked = rankGamesForUser(entries, {}, { now: FIXED_NOW });

    expect(ranked.map((entry) => entry.id)).toEqual(['earlier', 'a', 'z', 'later']);
  });

  it('estimates the base score deterministically when none is provided', () => {
    const entry: RecommendationGameEntry = { id: 'est', game: upcomingGame() };

    const first = rankGamesForUser([entry], {}, { now: FIXED_NOW });
    const second = rankGamesForUser([entry], {}, { now: FIXED_NOW });

    expect(first[0]?.baseScore).toBeGreaterThanOrEqual(1);
    expect(first[0]?.baseScore).toBeLessThanOrEqual(10);
    expect(first).toEqual(second);
  });

  it('applies the limit option after ranking', () => {
    const entries: RecommendationGameEntry[] = [
      { id: 'low', game: upcomingGame(), baseScore: 4 },
      { id: 'high', game: upcomingGame(), baseScore: 9 },
      { id: 'mid', game: upcomingGame(), baseScore: 6 },
    ];

    const ranked = rankGamesForUser(entries, {}, { now: FIXED_NOW, limit: 2 });

    expect(ranked.map((entry) => entry.id)).toEqual(['high', 'mid']);
  });
});

describe('explainRecommendation', () => {
  it('mirrors the breakdown-sheet shape with base, personal, and social parts', () => {
    const entry: RecommendationGameEntry = {
      id: 'exp',
      game: upcomingGame({ homeTeam: 'Boston Celtics', awayTeam: 'Utah Jazz' }),
      baseScore: 7,
    };
    const profile: UserAffinityProfile = {
      favoriteTeams: ['Boston Celtics'],
      socialSignal: { exp: -0.4 },
    };

    const [ranked] = rankGamesForUser([entry], profile, { now: FIXED_NOW });
    const explanation = explainRecommendation(ranked!);

    expect(explanation.baseScore).toBe(7);
    expect(explanation.personalAdjustment).toBe(0.75);
    expect(explanation.socialAdjustment).toBe(-0.3);
    expect(explanation.totalScore).toBe(7.45);

    const factorIds = explanation.factors.map((factor) => factor.id);
    expect(factorIds[0]).toBe('base_score');
    expect(factorIds).toContain('favorite_team_home');
    expect(factorIds).toContain('social_signal');

    const base = explanation.factors.find((factor) => factor.id === 'base_score');
    expect(base?.delta).toBe(7);
    const social = explanation.factors.find((factor) => factor.id === 'social_signal');
    expect(social?.delta).toBe(-0.3);
  });
});
