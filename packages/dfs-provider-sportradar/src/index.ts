import {
  defineStatProvider,
  type DfsEntryInput,
  type DfsLegInput,
  type PlayerGameLogEntryShape,
  type StatProvider,
} from '@buzzr/dfs-engine';

export type SportradarBasketballStatLine = {
  game_id?: string | null;
  scheduled?: string | null;
  minutes?: string | number | null;
  points?: number | null;
  rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  three_points_made?: number | null;
};

export type SportradarGameLogLoaderInput = {
  playerId: string | null;
  playerName: string;
  league: string;
  gameId: string | null;
  gameDate: string | null;
  leg: DfsLegInput;
  entry: DfsEntryInput;
  context: Record<string, unknown>;
};

export type SportradarStatProviderOptions = {
  id?: string;
  getGameLog: (
    input: SportradarGameLogLoaderInput,
  ) => SportradarBasketballStatLine[] | Promise<SportradarBasketballStatLine[]>;
};

function toStringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function sportradarRowToGameLog(row: SportradarBasketballStatLine): PlayerGameLogEntryShape {
  return {
    date: row.scheduled ?? '',
    minutes: toStringOrEmpty(row.minutes),
    points: toStringOrEmpty(row.points),
    rebounds: toStringOrEmpty(row.rebounds),
    assists: toStringOrEmpty(row.assists),
    steals: toStringOrEmpty(row.steals),
    blocks: toStringOrEmpty(row.blocks),
    turnovers: toStringOrEmpty(row.turnovers),
    threeP: toStringOrEmpty(row.three_points_made),
  };
}

export function createSportradarStatProvider(options: SportradarStatProviderOptions): StatProvider {
  return defineStatProvider({
    id: options.id ?? 'sportradar',
    async getGameLog({ leg, entry, context }) {
      const rows = await options.getGameLog({
        playerId: leg.playerId ?? null,
        playerName: leg.playerName,
        league: leg.league,
        gameId: leg.gameId ?? null,
        gameDate: leg.gameDate ?? null,
        leg,
        entry,
        context: (context.metadata as Record<string, unknown> | undefined) ?? {},
      });
      return rows.map(sportradarRowToGameLog);
    },
  });
}
