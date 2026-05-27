import { readFile } from 'node:fs/promises';
import {
  createDfsEngine,
  createMockStatProviderFromMap,
  type DfsEntryInput,
  type DfsSettlementResult,
  type PlayerGameLogEntryShape,
  type StatProvider,
} from './engine-shim';

export type GameLogsByLegId = Record<string, PlayerGameLogEntryShape[]>;

export type RunGradeInput = {
  entry: DfsEntryInput;
  gameLogsByLegId: GameLogsByLegId;
};

export type RunGradeFileInput = {
  entryPath: string;
  gameLogsPath: string;
};

export async function runGrade(input: RunGradeInput): Promise<DfsSettlementResult> {
  const provider: StatProvider = createMockStatProviderFromMap(input.gameLogsByLegId);
  const engine = createDfsEngine({ statProviders: [provider] });
  return engine.settleEntry(input.entry, { statProviderId: provider.id });
}

export async function runGradeFromFiles(input: RunGradeFileInput): Promise<DfsSettlementResult> {
  const [entryRaw, gameLogsRaw] = await Promise.all([
    readFile(input.entryPath, 'utf8'),
    readFile(input.gameLogsPath, 'utf8'),
  ]);
  return runGrade({
    entry: JSON.parse(entryRaw) as DfsEntryInput,
    gameLogsByLegId: JSON.parse(gameLogsRaw) as GameLogsByLegId,
  });
}
