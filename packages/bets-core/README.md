# @buzzr/bets-core

Pure TypeScript contracts and helpers for Buzzr Bets.

This package intentionally contains no React, no native modules, no Supabase
client, no network calls, and no credentials. It is the app-facing domain layer
for sportsbook normalization, external bet keys, no-vig fair-line math, ROI
rollups, and converting tracked bet records into settlement inputs shaped for
`@buzzr/dfs-engine`. The DFS adapter emits v4-canonical settlement legs
(`actual` and `status`, never legacy `stat` / `legStatus`) and rejects
non-finite money or line values before they hit the engine.

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

## v5 API

Version 5 is additive: every v4 export keeps its exact name, signature, and
behavior, and the package still has zero runtime dependencies. New APIs reject
invalid input (empty leg arrays, zero/negative stakes, out-of-range
probabilities, zero odds) with `TypeError`; v4 exports keep throwing plain
`Error` exactly as before.

### Parlay math

```ts
import {
  americanToDecimalOdds,
  calculateParlayFairValue,
  calculateParlayProbability,
  combineAmericanOdds,
  decimalToAmericanOdds,
} from '@buzzr/bets-core';

americanToDecimalOdds(-110); // 1.909091 (stake included; +/-100 both map to 2)
decimalToAmericanOdds(2.5); // 150 (decimal odds must be > 1)

// Combined parlay price via the decimal-odds product.
combineAmericanOdds([-110, -110]); // 264

// Independent-legs joint probability.
calculateParlayProbability([0.5, 0.5]); // 0.25

// Per-leg no-vig fair probabilities, combined fair price, and the edge of the
// offered combined price against that fair probability.
calculateParlayFairValue({
  legs: [
    { selected: -110, opposite: -110 },
    { selected: -110, opposite: -110 },
  ],
});
// {
//   legFairProbabilities: [0.5, 0.5],
//   fairProbability: 0.25,
//   fairAmericanOdds: 300,
//   offeredAmericanOdds: 264,
//   edgePercent: -2.47,
// }
```

### Value & staking

```ts
import {
  calculateClosingLineValue,
  calculateExpectedValue,
  calculateKellyStake,
} from '@buzzr/bets-core';

// Expected profit and ROI for a stake at American odds.
calculateExpectedValue({ stake: 100, americanOdds: 100, winProbability: 0.55 });
// { expectedValue: 10, expectedRoiPercent: 10 }

// Kelly staking. fullKellyFraction = (b * p - q) / b with b = decimal - 1,
// clamped at 0 for -EV bets. fraction defaults to 0.25 (quarter-Kelly).
calculateKellyStake({ bankroll: 1000, americanOdds: 100, winProbability: 0.55 });
// { fullKellyFraction: 0.1, recommendedFraction: 0.025, recommendedStake: 25 }

// Closing line value as the implied-probability delta (closing minus placed)
// in percentage points. Positive means you beat the close.
calculateClosingLineValue({ placedAmericanOdds: 110, closingAmericanOdds: -105 });
// { clvPercent: 3.6, beatClosingLine: true }
```

### Analytics rollups

```ts
import {
  calculateDrawdown,
  calculateRollupByPeriod,
  calculateStreaks,
} from '@buzzr/bets-core';

// Buckets bets by settledAt (falling back to placedAt) in UTC and runs a full
// calculateBetRollup per bucket, sorted ascending. Periods: 'day' | 'week'
// (Monday start) | 'month'. periodStart is an ISO date string (YYYY-MM-DD).
calculateRollupByPeriod(bets, 'week');
// [{ periodStart: '2026-05-11', rollup: { ... } }, ...]

// Max drawdown over the chronological cumulative net-units curve. Each
// settled bet contributes returned - stake (the same netUnits semantics as
// calculateBetRollup); pending, draft, and canceled bets are excluded. The
// curve starts at 0, so peakUnits >= 0 and troughUnits <= 0.
calculateDrawdown(bets);
// { maxDrawdownUnits: 20, peakUnits: 15, troughUnits: -5, currentUnits: 15 }

// Longest win/loss streaks over won/lost bets in chronological order, plus
// the same current streak calculateBetRollup reports.
calculateStreaks(bets);
// { longestWinStreak: 2, longestLossStreak: 3, currentStreak: { status: 'won', count: 1 } }
```
