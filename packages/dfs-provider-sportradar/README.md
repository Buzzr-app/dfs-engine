# @buzzr/dfs-provider-sportradar

Optional Sportradar-shaped stat provider contract for
[`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine).

You bring the Sportradar fetch (auth, rate limits, caching). This package
exposes a thin adapter that maps Sportradar's basketball statline shape into
the engine's `PlayerGameLogEntryShape`, so you can wire Sportradar as a
`StatProvider` without bending the engine to a vendor format.

## Install

```bash
npm install @buzzr/dfs-provider-sportradar @buzzr/dfs-engine
```

## Usage

```ts
import { createDfsEngine } from '@buzzr/dfs-engine';
import { createSportradarStatProvider } from '@buzzr/dfs-provider-sportradar';

const provider = createSportradarStatProvider({
  getGameLog: async ({ playerId, gameDate }) => {
    return fetchSportradarBoxscore(playerId, gameDate);
  },
});

const engine = createDfsEngine({ statProviders: [provider] });
```

The package does **no network I/O itself**. The loader you provide is the
only code that touches Sportradar.

## License

MIT
