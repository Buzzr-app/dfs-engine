# @buzzr/dfs-provider-espn

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-provider-espn)](https://www.npmjs.com/package/@buzzr/dfs-provider-espn)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-provider-espn)](https://www.npmjs.com/package/@buzzr/dfs-provider-espn)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-provider-espn)](https://www.npmjs.com/package/@buzzr/dfs-provider-espn)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-provider-espn)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Wire ESPN-shaped gamelog data into [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) as a typed `StatProvider`.** You bring the fetch — an ESPN client, a scraper, a cache, or a paid data feed. This package gives you the ergonomic, strongly-typed loader contract: it unpacks the leg into `playerId` / `playerName` / `league` / `gameId` / `gameDate` so your loader reads like a data query instead of engine plumbing.

This package does **no network I/O itself**. The loader you provide is the only code that touches ESPN, so auth, rate limits, and caching stay entirely under your control.

## Install

```bash
npm install @buzzr/dfs-provider-espn @buzzr/dfs-engine
```

## 30-second quick start

```ts
import { createDfsEngine } from '@buzzr/dfs-engine';
import { createEspnStatProvider } from '@buzzr/dfs-provider-espn';

const espn = createEspnStatProvider({
  getGameLog: async ({ playerId, playerName, league, gameDate }) => {
    // Your fetch. Return PlayerGameLogEntryShape[] rows:
    const rows = await myEspnClient.gamelog(playerId ?? playerName, league, gameDate);
    return rows; // [{ date, minutes, points, rebounds, assists, ... }]
  },
});

const engine = createDfsEngine({ statProviders: [espn] });
const result = await engine.settleEntry(entry, { statProviderId: 'espn' });
```

The engine validates every returned row at the provider boundary and reports `invalid_provider_data` if your loader emits malformed gamelog entries — bad data fails loudly instead of silently mis-grading a slip.

## API

| Export                     | Purpose                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| `createEspnStatProvider()` | Build a `StatProvider` (id `'espn'` by default) from your gamelog loader     |
| `EspnStatProviderOptions`  | Type: `{ id?, getGameLog }` options bag                                      |
| `EspnGameLogLoaderInput`   | Type: unpacked leg context handed to your loader (player, game, entry, leg)  |

## When to use this vs siblings

| You want to…                                | Reach for                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Feed ESPN-shaped stats into the engine      | **this package**                                                                                  |
| Feed Sportradar stats into the engine       | [`@buzzr/dfs-provider-sportradar`](https://www.npmjs.com/package/@buzzr/dfs-provider-sportradar)  |
| A deterministic provider for tests          | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit)                          |
| A custom provider for any other data source | `defineStatProvider` in [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)    |

## Links

- [Engine API docs](https://buzzr-app.github.io/dfs-engine/)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## License

MIT
