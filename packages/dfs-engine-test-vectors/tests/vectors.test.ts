import { describe, expect, test } from 'vitest';
import {
  createDfsEngine,
  defineStatProvider,
  type PlayerGameLogEntryShape,
  type StatProvider,
} from '@buzzr/dfs-engine';
import { TEST_VECTORS } from '../src';

function providerFromMap(map: Record<string, PlayerGameLogEntryShape[]>): StatProvider {
  return defineStatProvider({
    id: 'vector-provider',
    getGameLog({ leg }) {
      return map[leg.legId] ?? [];
    },
  });
}

describe('@buzzr/dfs-engine-test-vectors', () => {
  test('every vector replays through @buzzr/dfs-engine and matches its expected outcome', async () => {
    for (const vector of TEST_VECTORS) {
      const provider = providerFromMap(vector.gameLogsByLegId);
      const engine = createDfsEngine({ statProviders: [provider] });
      const result = await engine.settleEntry(vector.entry, {
        statProviderId: provider.id,
      });

      expect(result.status, `${vector.name} bet status`).toBe(vector.expected.status);
      expect(result.legs.length, `${vector.name} leg count`).toBe(vector.expected.legs.length);

      for (const expectedLeg of vector.expected.legs) {
        const actualLeg = result.legs.find((leg) => leg.legId === expectedLeg.legId);
        expect(actualLeg, `${vector.name} leg ${expectedLeg.legId} present`).toBeTruthy();
        expect(actualLeg?.status, `${vector.name} leg ${expectedLeg.legId} status`).toBe(
          expectedLeg.status,
        );
        expect(actualLeg?.actual, `${vector.name} leg ${expectedLeg.legId} actual`).toBe(
          expectedLeg.actual,
        );
      }
    }
  });

  test('TEST_VECTORS is non-empty and every vector has a unique name', () => {
    expect(TEST_VECTORS.length).toBeGreaterThan(0);
    const names = new Set(TEST_VECTORS.map((v) => v.name));
    expect(names.size).toBe(TEST_VECTORS.length);
  });
});
