# @buzzr/bets-core

Pure TypeScript contracts and helpers for Buzzr Bets.

This package intentionally contains no React, no native modules, no Supabase
client, no network calls, and no credentials. It is the app-facing domain layer
for sportsbook normalization, external bet keys, no-vig fair-line math, ROI
rollups, and converting tracked bet records into settlement inputs shaped for
`@buzzr/dfs-engine`.

The package has zero runtime dependencies. Consumers can install
`@buzzr/dfs-engine` when they want to pass the adapter output directly into the
Settlement OS, but app-side odds and rollup helpers do not pull the engine into
the bundle.

```bash
npm install @buzzr/bets-core
```

```ts
import {
  betRecordToDfsEntryInput,
  calculateNoVigFairLine,
  normalizeSportsbookSlug,
} from '@buzzr/bets-core';

normalizeSportsbookSlug('Draft Kings'); // draftkings

calculateNoVigFairLine({
  selected: { side: 'home', americanOdds: -110 },
  opposite: { side: 'away', americanOdds: -105 },
});

const dfsInput = betRecordToDfsEntryInput({
  id: 'bet-1',
  userId: 'user-1',
  sportsbookSlug: 'prizepicks',
  kind: 'dfs',
  status: 'pending',
  stake: 10,
  placedAt: '2026-05-13T00:00:00.000Z',
  dfs: {
    playTypeId: 'power',
    displayedMultiplier: 3,
  },
  legs: [
    {
      legId: 'leg-1',
      playerName: 'A. Example',
      league: 'NBA',
      propType: 'Points',
      line: 20.5,
      direction: 'over',
    },
    {
      legId: 'leg-2',
      playerName: 'B. Example',
      league: 'NBA',
      propType: 'Rebounds',
      line: 7.5,
      direction: 'over',
    },
  ],
});
```
