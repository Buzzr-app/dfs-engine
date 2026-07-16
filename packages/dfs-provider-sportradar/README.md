# @buzzr/dfs-provider-sportradar

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-provider-sportradar)](https://www.npmjs.com/package/@buzzr/dfs-provider-sportradar)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-provider-sportradar)](https://www.npmjs.com/package/@buzzr/dfs-provider-sportradar)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-provider-sportradar)](https://www.npmjs.com/package/@buzzr/dfs-provider-sportradar)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-provider-sportradar)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Map Sportradar basketball statlines into [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) without bending the engine to a vendor format.** You bring the Sportradar fetch (auth, rate limits, caching); this package converts Sportradar's snake_case numeric statline shape (`three_points_made`, `scheduled`, …) into the engine's canonical `PlayerGameLogEntryShape` and registers it all as a typed `StatProvider`.

This package does **no network I/O itself**. The loader you provide is the only code that touches Sportradar.

## Install

```bash
npm install @buzzr/dfs-provider-sportradar @buzzr/dfs-engine
```

## 30-second quick start

```ts
import { createDfsEngine } from '@buzzr/dfs-engine';
import { createSportradarStatProvider } from '@buzzr/dfs-provider-sportradar';

const sportradar = createSportradarStatProvider({
  getGameLog: async ({ playerId, gameDate }) => {
    // Your fetch. Return Sportradar-shaped statlines as-is:
    return fetchSportradarBoxscore(playerId, gameDate);
    // [{ scheduled, minutes, points, rebounds, assists, three_points_made, ... }]
  },
});

const engine = createDfsEngine({ statProviders: [sportradar] });
const result = await engine.settleEntry(entry, { statProviderId: 'sportradar' });
```

Rows are converted with `sportradarRowToGameLog` before they reach the engine, and the engine still validates them at the provider boundary — malformed data surfaces as `invalid_provider_data` instead of a silent mis-grade.

## API

| Export                           | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `createSportradarStatProvider()` | Build a `StatProvider` (id `'sportradar'` by default) from your statline loader |
| `sportradarRowToGameLog()`       | Convert one `SportradarBasketballStatLine` into a `PlayerGameLogEntryShape`    |
| `SportradarBasketballStatLine`   | Type: Sportradar's basketball statline shape (snake_case, numeric fields)      |
| `SportradarStatProviderOptions`  | Type: `{ id?, getGameLog }` options bag                                        |
| `SportradarGameLogLoaderInput`   | Type: unpacked leg context handed to your loader (player, game, entry, leg)    |

## When to use this vs siblings

| You want to…                                | Reach for                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Feed Sportradar stats into the engine       | **this package**                                                                         |
| Feed ESPN-shaped stats into the engine      | [`@buzzr/dfs-provider-espn`](https://www.npmjs.com/package/@buzzr/dfs-provider-espn)     |
| A deterministic provider for tests          | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit)                 |
| A custom provider for any other data source | `defineStatProvider` in [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) |

## Links

- [All-package API index](../../docs/api-reference.md)
- [Generated root-export reference](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-provider-sportradar.html)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## Compatibility and support

Node.js >= 22 is supported. Import the supported API from `@buzzr/dfs-provider-sportradar`.
Deep `src/*` and `dist/*` imports are unsupported. This package adapts a
consumer-owned loader; it does not include a Sportradar client, credentials, or
network transport.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md). The
[versioning and support policy](../../docs/versioning-and-support.md) defines the
supported runtime and SemVer contract.

## License

[MIT](../../LICENSE)
