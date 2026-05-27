import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { runGrade, runGradeFromFiles } from '../src';

const baseLeg = {
  playerId: null as string | null,
  league: 'NBA',
  direction: 'over' as const,
  actual: null,
  status: 'pending' as const,
  gameDate: '2026-05-07T00:00:00.000Z',
};

const entry = {
  entryId: 'cli-entry-1',
  bookId: 'prizepicks',
  playTypeId: 'power',
  stake: 10,
  displayedMultiplier: 3,
  legs: [
    {
      ...baseLeg,
      legId: 'leg-1',
      playerName: 'CLI Tester A',
      playerId: 'athlete-a',
      propType: 'Points',
      line: 20.5,
    },
    {
      ...baseLeg,
      legId: 'leg-2',
      playerName: 'CLI Tester B',
      playerId: 'athlete-b',
      propType: 'Rebounds',
      line: 7.5,
    },
  ],
};

const baseRow = {
  date: '2026-05-07T00:00:00.000Z',
  minutes: '34:00',
  assists: '5',
  steals: '1',
  blocks: '0',
  turnovers: '2',
  threeP: '3',
};

const gameLogs = {
  'leg-1': [{ ...baseRow, points: '28', rebounds: '6' }],
  'leg-2': [{ ...baseRow, points: '14', rebounds: '9' }],
};

describe('@buzzr/dfs-cli', () => {
  test('runGrade settles an entry from in-memory inputs', async () => {
    const result = await runGrade({ entry, gameLogsByLegId: gameLogs });
    expect(result.status).toBe('won');
    expect(result.legs[0]?.actual).toBe(28);
  });

  test('runGradeFromFiles reads entry + gamelogs from disk and settles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dfs-cli-'));
    const entryPath = join(dir, 'entry.json');
    const gameLogsPath = join(dir, 'gamelogs.json');
    writeFileSync(entryPath, JSON.stringify(entry));
    writeFileSync(gameLogsPath, JSON.stringify(gameLogs));

    const result = await runGradeFromFiles({ entryPath, gameLogsPath });
    expect(result.status).toBe('won');
    expect(result.legs[0]?.status).toBe('won');
  });
});
