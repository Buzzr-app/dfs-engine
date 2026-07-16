# @buzzr/dfs-engine-test-vectors

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-engine-test-vectors)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Versioned engine regression fixtures for [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine).** Each vector is an `{ entry, gameLogsByLegId, expected }` triple: a synthetic entry, deterministic provider rows, and the detailed outcome produced by the matching engine version.

Replay these fixtures when wiring stat providers, persistence, or settlement orchestration to detect drift from that engine contract. They are not official operator conformance, do not certify current PrizePicks or Underdog rules, and do not replace the displayed entry terms or an operator ruling.

## Install

```bash
npm install --save-dev @buzzr/dfs-engine-test-vectors @buzzr/dfs-engine
```

## 30-second quick start

```ts
import { describe, expect, test } from 'vitest';
import { createDfsEngine, defineStatProvider } from '@buzzr/dfs-engine';
import { TEST_VECTORS } from '@buzzr/dfs-engine-test-vectors';

describe('my-integration engine regression vectors', () => {
  test.each(TEST_VECTORS.map((v) => [v.name, v] as const))('%s', async (_name, v) => {
    const provider = defineStatProvider({
      id: 'mine',
      getGameLog: ({ leg }) => v.gameLogsByLegId[leg.legId] ?? [],
    });
    const engine = createDfsEngine({ statProviders: [provider] });

    const result = await engine.settleEntry(v.entry, { statProviderId: 'mine' });

    expect(result).toMatchObject({
      status: v.expected.status,
      multiplier: v.expected.multiplier,
      payout: v.expected.payout,
      pendingReasons: v.expected.pendingReasons,
      policyVersion: v.expected.policyVersion,
      policyStatus: v.expected.policyStatus,
      payoutTable: v.expected.payoutTable,
      confidence: v.expected.confidence,
      explanationCodes: v.expected.explanationCodes,
    });
    for (const expectedLeg of v.expected.legs) {
      const leg = result.legs.find((l) => l.legId === expectedLeg.legId);
      expect(leg?.status).toBe(expectedLeg.status);
      expect(leg?.actual).toBe(expectedLeg.actual);
    }
  });
});
```

## What's inside

| Vector                                              | Engine behavior pinned                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `prizepicks_power_2leg_all_win`                     | Two NBA overs win under the PrizePicks compatibility profile                           |
| `prizepicks_power_2leg_one_loss`                    | One missed leg loses an all-or-nothing compatibility entry                             |
| `underdog_standard_2leg_under_hits`                 | Two unders win under the unverified Underdog compatibility profile                     |
| `prizepicks_power_all_push_refund`                  | All exact-line pushes remove every leg and return the stake                            |
| `prizepicks_power_dnp_reprices_survivors`           | An explicit DNP removes a leg and reprices the surviving entry                         |
| `prizepicks_power_missing_supported_stat_pending`   | A supported prop with a missing value remains pending as `missing_stat`                 |
| `prizepicks_power_unsupported_prop_pending`         | An unsupported prop remains pending distinctly from missing data                       |
| `prizepicks_flex_duplicate_player_warning`          | Duplicate-player validation warning survives a completed settlement                    |
| `prizepicks_power_wrong_date_provider_row_pending`  | A provider row outside the game-date window is not silently selected                   |
| `prizepicks_power_ambiguous_same_day_rows_pending`  | Two plausible same-day rows remain pending instead of being chosen arbitrarily         |
| `prizepicks_power_current_3leg_payout`              | The reviewed standard table effective 2026-07-02 resolves a three-pick Power entry at 6× |

| Export               | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `TEST_VECTORS`       | Readonly array of engine-verified `TestVector` triples                  |
| `TestVector`         | Type: `{ name, description, entry, gameLogsByLegId, expected }`         |
| `ExpectedSettlement` | Expected payout, policy, verification, provenance, validation, and audit contract |
| `ExpectedLegOutcome` | Expected per-leg status, actual, pending reason, and provider source    |

## When to use this vs siblings

| You want to…                                       | Reach for                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Detect drift from a matching engine version         | **this package**                                                          |
| Build custom fixtures for your own test scenarios  | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit) |
| Grade entries in production code                   | [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)   |
| Spot-check a single entry from the command line    | [`@buzzr/dfs-cli`](https://www.npmjs.com/package/@buzzr/dfs-cli)         |

## Links

- [Engine API docs](https://buzzr-app.github.io/dfs-engine/)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## License

MIT
