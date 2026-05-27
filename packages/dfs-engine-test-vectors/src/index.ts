import type { DfsEntryInput, DfsLegOutcome, PlayerGameLogEntryShape } from '@buzzr/dfs-engine';

export type ExpectedLegOutcome = {
  legId: string;
  status: DfsLegOutcome;
  actual: number | null;
};

export type TestVector = {
  name: string;
  description: string;
  entry: DfsEntryInput;
  gameLogsByLegId: Record<string, PlayerGameLogEntryShape[]>;
  expected: {
    status: 'won' | 'lost' | 'pushed' | 'pending' | 'void';
    legs: ExpectedLegOutcome[];
  };
};

const NBA_GAME_DATE = '2026-05-07T00:00:00.000Z';

function nbaRow(overrides: Partial<PlayerGameLogEntryShape>): PlayerGameLogEntryShape {
  return {
    date: NBA_GAME_DATE,
    minutes: '34:00',
    points: '0',
    rebounds: '0',
    assists: '0',
    steals: '0',
    blocks: '0',
    turnovers: '0',
    threeP: '0',
    ...overrides,
  };
}

export const TEST_VECTORS: readonly TestVector[] = [
  {
    name: 'prizepicks_power_2leg_all_win',
    description: 'PrizePicks Power, two NBA Points overs both clear the line — should settle won.',
    entry: {
      entryId: 'tv-power-2leg-won',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      legs: [
        {
          legId: 'leg-1',
          playerName: 'Vector Player A',
          playerId: 'athlete-a',
          league: 'NBA',
          propType: 'Points',
          line: 20.5,
          direction: 'over',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
        {
          legId: 'leg-2',
          playerName: 'Vector Player B',
          playerId: 'athlete-b',
          league: 'NBA',
          propType: 'Points',
          line: 15.5,
          direction: 'over',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
      ],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '28' })],
      'leg-2': [nbaRow({ points: '22' })],
    },
    expected: {
      status: 'won',
      legs: [
        { legId: 'leg-1', status: 'won', actual: 28 },
        { legId: 'leg-2', status: 'won', actual: 22 },
      ],
    },
  },
  {
    name: 'prizepicks_power_2leg_one_loss',
    description: 'PrizePicks Power loses entirely when a single leg misses (all-or-nothing).',
    entry: {
      entryId: 'tv-power-2leg-lost',
      bookId: 'prizepicks',
      playTypeId: 'power',
      stake: 10,
      displayedMultiplier: 3,
      legs: [
        {
          legId: 'leg-1',
          playerName: 'Vector Player A',
          playerId: 'athlete-a',
          league: 'NBA',
          propType: 'Points',
          line: 20.5,
          direction: 'over',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
        {
          legId: 'leg-2',
          playerName: 'Vector Player B',
          playerId: 'athlete-b',
          league: 'NBA',
          propType: 'Rebounds',
          line: 7.5,
          direction: 'over',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
      ],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ points: '28' })],
      'leg-2': [nbaRow({ rebounds: '4' })],
    },
    expected: {
      status: 'lost',
      legs: [
        { legId: 'leg-1', status: 'won', actual: 28 },
        { legId: 'leg-2', status: 'lost', actual: 4 },
      ],
    },
  },
  {
    name: 'underdog_standard_2leg_under_hits',
    description: 'Underdog Standard two-leg slate with both unders clearing — wins.',
    entry: {
      entryId: 'tv-underdog-2leg-won',
      bookId: 'underdog',
      playTypeId: 'underdog_standard',
      stake: 5,
      displayedMultiplier: 3,
      legs: [
        {
          legId: 'leg-1',
          playerName: 'Vector Player C',
          playerId: 'athlete-c',
          league: 'NBA',
          propType: 'Turnovers',
          line: 3.5,
          direction: 'under',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
        {
          legId: 'leg-2',
          playerName: 'Vector Player D',
          playerId: 'athlete-d',
          league: 'NBA',
          propType: 'Assists',
          line: 8.5,
          direction: 'under',
          actual: null,
          status: 'pending',
          gameDate: NBA_GAME_DATE,
        },
      ],
    },
    gameLogsByLegId: {
      'leg-1': [nbaRow({ turnovers: '2' })],
      'leg-2': [nbaRow({ assists: '6' })],
    },
    expected: {
      status: 'won',
      legs: [
        { legId: 'leg-1', status: 'won', actual: 2 },
        { legId: 'leg-2', status: 'won', actual: 6 },
      ],
    },
  },
];
