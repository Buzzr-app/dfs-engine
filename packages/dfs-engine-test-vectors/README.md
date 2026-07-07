# @buzzr/dfs-engine-test-vectors

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-engine-test-vectors)](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-engine-test-vectors)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Golden fixtures that prove your [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) integration grades identically to Buzzr's production pipeline.** Each vector is an `{ entry, gameLogsByLegId, expected }` triple — a real slip shape, the boxscore rows that settle it, and the exact settlement outcome — verified against the engine in this package's own test suite.

If you wire your own stat providers, persistence, or settlement orchestration around the engine, replaying these vectors in your CI turns "we think our wiring is right" into a passing conformance test.

## Install

```bash
npm install --save-dev @buzzr/dfs-engine-test-vectors @buzzr/dfs-engine
```

## 30-second quick start

```ts
import { describe, expect, test } from 'vitest';
import { createDfsEngine, defineStatProvider } from '@buzzr/dfs-engine';
import { TEST_VECTORS } from '@buzzr/dfs-engine-test-vectors';

describe('my-integration conformance', () => {
  test.each(TEST_VECTORS.map((v) => [v.name, v] as const))('%s', async (_name, v) => {
    const provider = defineStatProvider({
      id: 'mine',
      getGameLog: ({ leg }) => v.gameLogsByLegId[leg.legId] ?? [],
    });
    const engine = createDfsEngine({ statProviders: [provider] });

    const result = await engine.settleEntry(v.entry, { statProviderId: 'mine' });

    expect(result.status).toBe(v.expected.status);
    for (const expectedLeg of v.expected.legs) {
      const leg = result.legs.find((l) => l.legId === expectedLeg.legId);
      expect(leg?.status).toBe(expectedLeg.status);
      expect(leg?.actual).toBe(expectedLeg.actual);
    }
  });
});
```

## What's inside

| Vector                            | Covers                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `prizepicks_power_2leg_all_win`   | PrizePicks Power, both NBA overs clear the line — settles `won`     |
| `prizepicks_power_2leg_one_loss`  | All-or-nothing: one missed leg loses the whole Power entry          |
| `underdog_standard_2leg_under_hits` | Underdog Standard, both unders hit — settles `won`                |

| Export               | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `TEST_VECTORS`       | Readonly array of verified `TestVector` triples                        |
| `TestVector`         | Type: `{ name, description, entry, gameLogsByLegId, expected }`        |
| `ExpectedLegOutcome` | Type: expected per-leg `{ legId, status, actual }`                     |

## When to use this vs siblings

| You want to…                                       | Reach for                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Prove your integration matches Buzzr's grading     | **this package**                                                          |
| Build custom fixtures for your own test scenarios  | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit) |
| Grade entries in production code                   | [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)   |
| Spot-check a single entry from the command line    | [`@buzzr/dfs-cli`](https://www.npmjs.com/package/@buzzr/dfs-cli)         |

## Links

- [Engine API docs](https://buzzr-app.github.io/dfs-engine/)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## License

MIT
