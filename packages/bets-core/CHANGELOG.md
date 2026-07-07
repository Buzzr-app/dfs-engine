# @buzzr/bets-core

## 5.0.0

### Major Changes

- Additive v5 release. Every v4 export keeps its exact name, signature, and behavior; the package still has zero runtime dependencies.
- New parlay math module (`src/parlay.ts`): `americanToDecimalOdds`, `decimalToAmericanOdds`, `combineAmericanOdds` (combined parlay price via the decimal-odds product), `calculateParlayProbability` (independent-legs product), and `calculateParlayFairValue` (per-leg no-vig fair probabilities combined into a fair parlay price with edge versus the offered combined odds).
- New value & staking module (`src/value.ts`): `calculateExpectedValue` (expected profit and ROI for a stake at American odds), `calculateKellyStake` (full-Kelly fraction clamped at 0 for -EV, quarter-Kelly recommendation by default), and `calculateClosingLineValue` (implied-probability delta between placed and closing prices).
- New analytics module (`src/analytics.ts`): `calculateRollupByPeriod` (day/week/month UTC buckets of `calculateBetRollup`, keyed by `settledAt ?? placedAt`), `calculateDrawdown` (max drawdown over the chronological cumulative net-units curve), and `calculateStreaks` (longest win/loss streaks plus the existing current-streak semantics).
- New v5 APIs reject invalid input (empty leg arrays, zero/negative stakes and bankrolls, out-of-range probabilities, zero odds) with `TypeError` using the package's existing message wording. v4 exports keep throwing plain `Error` exactly as before.
- Internal-only refactor: shared odds math, rollup helpers, and validation moved into focused modules (`types.ts`, `internal.ts`, `odds.ts`, `rollup.ts`) re-exported from the entry point, so new modules reuse the existing helpers instead of duplicating them.

## 4.0.0

### Major Changes

- 07fc4c7: Harden DFS Settlement OS v4 with canonical settlement inputs, structured validation, typed definition and invariant errors, stricter provider/payout contracts, and cross-package v4 fixture/adaptor updates.
