import {
  createDfsEngine,
  defineStatProvider,
  type DfsEntryInput,
  type DfsSettlementResult,
  type PlayerGameLogEntryShape,
  type StatProvider,
} from '@buzzr/dfs-engine';

export {
  createDfsEngine,
  type DfsEntryInput,
  type DfsSettlementResult,
  type PlayerGameLogEntryShape,
  type StatProvider,
};

export function createMockStatProviderFromMap(
  rowsByLegId: Record<string, PlayerGameLogEntryShape[]>,
  id = 'dfs-cli-mock',
): StatProvider {
  return defineStatProvider({
    id,
    getGameLog({ leg }) {
      return rowsByLegId[leg.legId] ?? [];
    },
  });
}
