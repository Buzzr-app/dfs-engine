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
        settledAt: '2026-07-16T12:00:00.000Z',
      });

      expect(result, `${vector.name} top-level contract`).toMatchObject({
        status: vector.expected.status,
        multiplier: vector.expected.multiplier,
        effectiveMultiplier: vector.expected.effectiveMultiplier,
        payout: vector.expected.payout,
        pendingReasons: vector.expected.pendingReasons,
        policyVersion: vector.expected.policyVersion,
        payoutTable: vector.expected.payoutTable,
        confidence: vector.expected.confidence,
        explanationCodes: vector.expected.explanationCodes,
      });
      expect(
        result.validation.errors.map((issue) => issue.code),
        `${vector.name} validation errors`,
      ).toEqual(vector.expected.validation.errorCodes);
      expect(
        result.validation.warnings.map((issue) => issue.code),
        `${vector.name} validation warnings`,
      ).toEqual(vector.expected.validation.warningCodes);
      expect(
        result.sourceRefs.map((source) => source.label),
        `${vector.name} policy sources`,
      ).toEqual(vector.expected.sourceLabels);
      expect(
        result.provenance.providers.map((provider) => provider.source),
        `${vector.name} provider provenance`,
      ).toEqual(vector.expected.providerSources);
      expect(
        result.auditTrail.map((event) => event.code),
        `${vector.name} audit trail`,
      ).toEqual(vector.expected.auditCodes);
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

  test('publishes adversarial settlement vectors, not only happy-path examples', () => {
    const names = new Set(TEST_VECTORS.map((vector) => vector.name));

    expect(names).toEqual(
      new Set([
        'prizepicks_power_2leg_all_win',
        'prizepicks_power_2leg_one_loss',
        'underdog_standard_2leg_under_hits',
        'prizepicks_power_all_push_refund',
        'prizepicks_power_dnp_reprices_survivors',
        'prizepicks_power_missing_supported_stat_pending',
        'prizepicks_power_unsupported_prop_pending',
        'prizepicks_flex_duplicate_player_warning',
        'prizepicks_power_wrong_date_provider_row_pending',
        'prizepicks_power_ambiguous_same_day_rows_pending',
        'prizepicks_power_current_3leg_payout',
      ]),
    );
  });
});
