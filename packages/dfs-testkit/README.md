# @buzzr/dfs-testkit

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-testkit)](https://www.npmjs.com/package/@buzzr/dfs-testkit)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-testkit)](https://www.npmjs.com/package/@buzzr/dfs-testkit)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-testkit)](https://www.npmjs.com/package/@buzzr/dfs-testkit)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-testkit)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Fixture builders and mock stat providers for testing [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) integrations.** Build a valid v4-canonical DFS entry in one line, override only what your test cares about, and wire a deterministic stat provider without touching the network.

## Install

```bash
npm install --save-dev @buzzr/dfs-testkit @buzzr/dfs-engine
```

## 30-second quick start

Works with Vitest, Jest, or any test runner:

```ts
import { test, expect } from 'vitest';
import { createDfsEngine } from '@buzzr/dfs-engine';
import {
  makeDfsEntry,
  makeDfsLeg,
  makeGameLogEntry,
  createMockStatProvider,
} from '@buzzr/dfs-testkit';

test('a PrizePicks Power entry settles as won when both legs hit', async () => {
  const entry = makeDfsEntry({
    legs: [
      makeDfsLeg({ legId: 'leg-1', propType: 'Points', line: 20.5 }),
      makeDfsLeg({ legId: 'leg-2', propType: 'Rebounds', line: 6.5 }),
    ],
  });

  const provider = createMockStatProvider({
    'leg-1': [makeGameLogEntry({ points: '24' })],
    'leg-2': [makeGameLogEntry({ rebounds: '9' })],
  });

  const engine = createDfsEngine({ statProviders: [provider] });
  const result = await engine.settleEntry(entry, { statProviderId: provider.id });

  expect(result.status).toBe('won');
});
```

Every builder returns a complete, engine-valid object with sensible defaults (`prizepicks` / `power` / NBA points over), so tests only spell out what they assert.

## API

| Export                     | Purpose                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `makeDfsEntry()`           | A valid `DfsEntryInput` (PrizePicks Power, one leg) with overridable fields  |
| `makeDfsLeg()`             | A valid `DfsLegInput` (NBA Points over 20.5) with overridable fields         |
| `makeGameLogEntry()`       | A valid `PlayerGameLogEntryShape` boxscore row with overridable stats        |
| `createMockStatProvider()` | A deterministic `StatProvider` serving rows from a `legId → rows` map        |
| `makeInvalidDfsEntry()`    | An entry with duplicate leg ids and zero stake, for validation-path tests    |

Fixtures emit v4-canonical shapes (`actual`, `status`, per-leg `legId` keys), so anything you build here passes the engine's boundary validators — except `makeInvalidDfsEntry`, which is designed to fail them.

## When to use this vs siblings

| You want to…                                          | Reach for                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Write unit tests for your own settlement integration  | **this package**                                                                                  |
| Replay versioned engine regression fixtures           | [`@buzzr/dfs-engine-test-vectors`](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors)  |
| Grade entries in production code                      | [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)                            |
| Grade entries from the command line                   | [`@buzzr/dfs-cli`](https://www.npmjs.com/package/@buzzr/dfs-cli)                                  |

The regression fixtures are review gates for a matching engine version, not official operator conformance.

## Links

- [All-package API index](../../docs/api-reference.md)
- [Generated root-export reference](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-testkit.html)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## Compatibility and support

Node.js >= 22 is supported. Import the supported API from `@buzzr/dfs-testkit`.
Deep `src/*` and `dist/*` imports are unsupported. The package is intended for
development and test dependencies and uses the compatible `@buzzr/dfs-engine`
range declared in its package manifest.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md). The
[versioning and support policy](../../docs/versioning-and-support.md) defines the
supported runtime and SemVer contract.

## License

[MIT](../../LICENSE)
