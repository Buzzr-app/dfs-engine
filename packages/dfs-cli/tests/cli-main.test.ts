import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { main } from '../src/cli';

const entry = {
  entryId: 'cli-main-entry',
  bookId: 'prizepicks',
  playTypeId: 'power',
  stake: 10,
  displayedMultiplier: 3,
  legs: [
    {
      legId: 'leg-1',
      playerName: 'Main Tester A',
      playerId: 'athlete-a',
      league: 'NBA',
      propType: 'Points',
      line: 20.5,
      direction: 'over' as const,
      actual: null,
      status: 'pending' as const,
      gameDate: '2026-05-07T00:00:00.000Z',
    },
    {
      legId: 'leg-2',
      playerName: 'Main Tester B',
      playerId: 'athlete-b',
      league: 'NBA',
      propType: 'Rebounds',
      line: 7.5,
      direction: 'over' as const,
      actual: null,
      status: 'pending' as const,
      gameDate: '2026-05-07T00:00:00.000Z',
    },
  ],
};

const gameLogs = {
  'leg-1': [
    {
      date: '2026-05-07T00:00:00.000Z',
      minutes: '34:00',
      points: '28',
      rebounds: '6',
      assists: '5',
      steals: '1',
      blocks: '0',
      turnovers: '2',
      threeP: '3',
    },
  ],
  'leg-2': [
    {
      date: '2026-05-07T00:00:00.000Z',
      minutes: '34:00',
      points: '14',
      rebounds: '9',
      assists: '5',
      steals: '1',
      blocks: '0',
      turnovers: '2',
      threeP: '3',
    },
  ],
};

describe('@buzzr/dfs-cli main()', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test('exits 0 and prints settlement JSON on the happy path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dfs-cli-main-'));
    const entryPath = join(dir, 'entry.json');
    const gameLogsPath = join(dir, 'gamelogs.json');
    writeFileSync(entryPath, JSON.stringify(entry));
    writeFileSync(gameLogsPath, JSON.stringify(gameLogs));

    const code = await main([entryPath, '--gamelogs', gameLogsPath]);
    expect(code).toBe(0);
    expect(stdoutSpy).toHaveBeenCalled();
    const printed = (stdoutSpy.mock.calls[0]?.[0] as string) ?? '';
    expect(printed).toContain('"status"');
  });

  test('accepts -g as a short alias for --gamelogs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dfs-cli-main-'));
    const entryPath = join(dir, 'entry.json');
    const gameLogsPath = join(dir, 'gamelogs.json');
    writeFileSync(entryPath, JSON.stringify(entry));
    writeFileSync(gameLogsPath, JSON.stringify(gameLogs));

    const code = await main([entryPath, '-g', gameLogsPath]);
    expect(code).toBe(0);
  });

  test('exits 0 and prints help with -h', async () => {
    const code = await main(['-h']);
    expect(code).toBe(0);
    expect((stdoutSpy.mock.calls[0]?.[0] as string) ?? '').toContain('dfs-grade');
  });

  test('exits 0 and prints help with --help', async () => {
    const code = await main(['--help']);
    expect(code).toBe(0);
  });

  test('exits 1 and prints help when no args are given', async () => {
    const code = await main([]);
    expect(code).toBe(1);
  });

  test('exits 1 and prints help when only an entry path is given (no --gamelogs)', async () => {
    const code = await main(['./entry.json']);
    expect(code).toBe(1);
  });

  test('exits 1 and writes to stderr when the entry file does not exist', async () => {
    const code = await main(['/nonexistent/entry.json', '--gamelogs', '/nonexistent/logs.json']);
    expect(code).toBe(1);
    expect(stderrSpy).toHaveBeenCalled();
    expect((stderrSpy.mock.calls[0]?.[0] as string) ?? '').toMatch(/dfs-grade:/);
  });

  test('ignores unknown flags rather than crashing', async () => {
    const code = await main(['--unknown', '-x']);
    expect(code).toBe(1);
  });
});
