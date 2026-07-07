import { normalizeTeamName, resolveBuzzScores, resolveNowMs } from './buzz-model-core';
import type {
  RankGamesOptions,
  RankedGame,
  RecommendationExplanation,
  RecommendationFactor,
  RecommendationGameEntry,
  UserAffinityProfile,
} from './types';

/** Maximum absolute personal-affinity adjustment applied to a base score. */
export const MAX_AFFINITY_ADJUSTMENT = 1.5;
/** Maximum absolute social adjustment applied to a base score. */
export const MAX_SOCIAL_ADJUSTMENT = 0.75;

const FAVORITE_TEAM_DELTA = 0.75;
const FAVORITE_LEAGUE_DELTA = 0.4;
const TEAM_AFFINITY_SCALE = 0.5;
const LEAGUE_AFFINITY_SCALE = 0.4;
const DEFAULT_BASE_SCORE = 5.5;

type NormalizedProfile = {
  favoriteTeams: Set<string>;
  favoriteLeagues: Set<string>;
  teamAffinity: Map<string, number>;
  leagueAffinity: Map<string, number>;
  socialSignal: Map<string, number>;
};

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeLeagueKey(league: unknown): string {
  return String(league ?? '')
    .trim()
    .toUpperCase();
}

function normalizeProfile(profile: UserAffinityProfile): NormalizedProfile {
  const favoriteTeams = new Set(
    (profile.favoriteTeams ?? []).map(normalizeTeamName).filter(Boolean),
  );
  const favoriteLeagues = new Set(
    (profile.favoriteLeagues ?? []).map(normalizeLeagueKey).filter(Boolean),
  );
  const teamAffinity = new Map<string, number>();
  for (const [team, value] of Object.entries(profile.teamAffinity ?? {})) {
    const key = normalizeTeamName(team);
    if (key && finiteNumber(value)) teamAffinity.set(key, value);
  }
  const leagueAffinity = new Map<string, number>();
  for (const [league, value] of Object.entries(profile.leagueAffinity ?? {})) {
    const key = normalizeLeagueKey(league);
    if (key && finiteNumber(value)) leagueAffinity.set(key, value);
  }
  const socialSignal = new Map<string, number>();
  for (const [gameId, value] of Object.entries(profile.socialSignal ?? {})) {
    if (gameId && finiteNumber(value)) socialSignal.set(gameId, value);
  }
  return { favoriteTeams, favoriteLeagues, teamAffinity, leagueAffinity, socialSignal };
}

function resolveBaseScore(entry: RecommendationGameEntry, nowMs: number): number {
  if (finiteNumber(entry.baseScore)) {
    return round2(clampRange(entry.baseScore, 1, 10));
  }
  const resolved = resolveBuzzScores(entry.game, {
    upcomingLike: entry.game.status !== 'final',
    now: nowMs,
  });
  return resolved.predictedEntertainmentScore ?? resolved.entertainmentScore ?? DEFAULT_BASE_SCORE;
}

function scoreEntry(
  entry: RecommendationGameEntry,
  profile: NormalizedProfile,
  nowMs: number,
): RankedGame {
  const game = entry.game;
  const baseScore = resolveBaseScore(entry, nowMs);
  const factors: RecommendationFactor[] = [];
  let affinityTotal = 0;

  const sides = [
    { name: game.homeTeam, suffix: 'home' },
    { name: game.awayTeam, suffix: 'away' },
  ];
  for (const side of sides) {
    const key = normalizeTeamName(side.name);
    if (!key) continue;
    if (profile.favoriteTeams.has(key)) {
      affinityTotal += FAVORITE_TEAM_DELTA;
      factors.push({
        id: `favorite_team_${side.suffix}`,
        label: `Favorite team: ${side.name ?? ''}`,
        delta: FAVORITE_TEAM_DELTA,
      });
    }
    const affinity = profile.teamAffinity.get(key);
    if (finiteNumber(affinity)) {
      const delta = round2(clampRange(affinity, -1, 1) * TEAM_AFFINITY_SCALE);
      if (Math.abs(delta) >= 0.01) {
        affinityTotal += delta;
        factors.push({
          id: `team_affinity_${side.suffix}`,
          label: `Team affinity: ${side.name ?? ''}`,
          delta,
        });
      }
    }
  }

  const leagueKey = normalizeLeagueKey(game.league);
  if (leagueKey) {
    if (profile.favoriteLeagues.has(leagueKey)) {
      affinityTotal += FAVORITE_LEAGUE_DELTA;
      factors.push({
        id: 'favorite_league',
        label: `Favorite league: ${leagueKey}`,
        delta: FAVORITE_LEAGUE_DELTA,
      });
    }
    const leagueAffinity = profile.leagueAffinity.get(leagueKey);
    if (finiteNumber(leagueAffinity)) {
      const delta = round2(clampRange(leagueAffinity, -1, 1) * LEAGUE_AFFINITY_SCALE);
      if (Math.abs(delta) >= 0.01) {
        affinityTotal += delta;
        factors.push({
          id: 'league_affinity',
          label: `League affinity: ${leagueKey}`,
          delta,
        });
      }
    }
  }

  const affinityAdjustment = round2(
    clampRange(affinityTotal, -MAX_AFFINITY_ADJUSTMENT, MAX_AFFINITY_ADJUSTMENT),
  );

  let socialAdjustment = 0;
  const id = entry.id ?? null;
  if (id != null) {
    const fireRatio = profile.socialSignal.get(id);
    if (finiteNumber(fireRatio)) {
      socialAdjustment = round2(
        clampRange(
          clampRange(fireRatio, -1, 1) * MAX_SOCIAL_ADJUSTMENT,
          -MAX_SOCIAL_ADJUSTMENT,
          MAX_SOCIAL_ADJUSTMENT,
        ),
      );
      if (Math.abs(socialAdjustment) >= 0.01) {
        factors.push({
          id: 'social_signal',
          label: socialAdjustment >= 0 ? 'Friends are hyped' : 'Friends passed on it',
          delta: socialAdjustment,
        });
      }
    }
  }

  return {
    id,
    game,
    context: entry.context ?? null,
    baseScore,
    affinityAdjustment,
    socialAdjustment,
    totalScore: round2(baseScore + affinityAdjustment + socialAdjustment),
    factors,
  };
}

function compareRanked(left: RankedGame, right: RankedGame): number {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }
  const leftStart = Date.parse(String(left.game.startsAt ?? ''));
  const rightStart = Date.parse(String(right.game.startsAt ?? ''));
  const leftMs = Number.isNaN(leftStart) ? Number.POSITIVE_INFINITY : leftStart;
  const rightMs = Number.isNaN(rightStart) ? Number.POSITIVE_INFINITY : rightStart;
  if (leftMs !== rightMs) {
    return leftMs < rightMs ? -1 : 1;
  }
  return (left.id ?? '').localeCompare(right.id ?? '');
}

/**
 * Rank candidate games for a user: base entertainment score (provided or
 * transparent estimate) plus a bounded personal-affinity adjustment (+/-1.5)
 * and a bounded social adjustment (+/-0.75). Ordering is deterministic - ties
 * break by earliest start time, then by id.
 */
export function rankGamesForUser(
  games: RecommendationGameEntry[],
  profile: UserAffinityProfile,
  options: RankGamesOptions = {},
): RankedGame[] {
  const nowMs = resolveNowMs(options.now);
  const normalized = normalizeProfile(profile ?? {});
  const ranked = games.map((entry) => scoreEntry(entry, normalized, nowMs));
  ranked.sort(compareRanked);
  if (finiteNumber(options.limit) && options.limit >= 0) {
    return ranked.slice(0, Math.floor(options.limit));
  }
  return ranked;
}

/**
 * Expand a ranked entry into the shape the app's BuzzBreakdownSheet renders:
 * base score, personal adjustment, social adjustment, and the individual
 * factor list with labels and signed deltas.
 */
export function explainRecommendation(entry: RankedGame): RecommendationExplanation {
  return {
    baseScore: entry.baseScore,
    personalAdjustment: entry.affinityAdjustment,
    socialAdjustment: entry.socialAdjustment,
    totalScore: entry.totalScore,
    factors: [
      {
        id: 'base_score',
        label: 'Base entertainment score',
        delta: entry.baseScore,
      },
      ...entry.factors,
    ],
  };
}
