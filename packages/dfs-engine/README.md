# @buzzr/dfs-engine

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-engine.svg)](https://www.npmjs.com/package/@buzzr/dfs-engine)
[![ci](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)

Pure-functional **DFS prop grading**, payout math, stat normalization, and policy-aware settlement for DFS pick'em apps. PrizePicks is an experimental, partially verified compatibility profile; Underdog is experimental and unverified. These independent profiles are not official operator rules engines. The package also supports strict settlement inputs, structured validation, and custom book policies without forking. Drop-in TypeScript, zero runtime dependencies, ESM + CJS + `.d.ts` shipped.

**Sports covered:** NBA, WNBA, NCAAM/W, NFL, MLB, NHL, EPL, MLS, La Liga, NWSL, UEFA Champions League. ~70 props.

## Install

```bash
npm install @buzzr/dfs-engine
```

## Why this exists

If you're building a DFS-adjacent tool — a bet tracker, parlay analyzer, EV calculator, social betting app, fantasy coaching tool — you eventually need code that answers:

- **Did this leg hit?** Given a player's actual stat and a slip line, decide won / lost / push.
- **What does the slip pay out?** Given the play type (Power / Flex / Standard), the pick count, the hits, and any boost, compute the multiplier and the withdrawable-vs-bonus split.
- **What happens when a player doesn't play?** Apply a selected compatibility or custom policy, preserve the decision in the audit trail, and surface uncertainty instead of inventing an operator ruling.
- **What stat goes into a `Pts + Rebs + Asts` leg?** Or `Pass + Rush + Rec Yds`? Or `Hitter FS`?

There's no good open-source TypeScript package for any of this. Everyone reinvents it from scratch, usually wrong. This package was extracted from [Buzzr](https://apps.apple.com/us/app/buzzr-sports/id6760628256) and is maintained as an independent, testable engine. Pure functions, strict runtime validation, and a release suite covering 300+ settlement tests keep code behavior auditable without claiming that an operator will issue the same ruling.

## Quickstart

```ts
import { gradeLegFromActual } from '@buzzr/dfs-engine';

// Player scored 28 against a line of 24.5 over → leg won.
gradeLegFromActual(24.5, 'over', 28);  // 'won'

// Same line, only 20 → leg lost.
gradeLegFromActual(24.5, 'over', 20);  // 'lost'

// Game hasn't ended yet (no stat available) → leg pending.
gradeLegFromActual(24.5, 'over', null); // 'pending'
```

## v4 Settlement OS

For full-entry settlement, create an isolated engine. Each engine owns its own book policies, payout overrides, league adapters, providers, clock, and audit metadata, so tests, apps, and plugins do not mutate a global registry.

```ts
import { createDfsEngine, defineBookPolicy, definePayoutTable } from '@buzzr/dfs-engine';

const myBook = defineBookPolicy({
  id: 'my-book',
  displayName: 'My Book',
  version: '2026-05',
  effectiveFrom: '2026-05-01',
  status: 'stable',
  sources: [{ label: 'Internal rules memo' }],
  playTypes: [
    {
      id: 'all-in',
      displayName: 'All-In',
      payoutModel: 'fixed-table',
      pickCount: { min: 2, max: 4 },
      allOrNothing: true,
    },
  ],
  tiePolicy: { type: 'push' },
  dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
  pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
  payoutSplit: { type: 'all_withdrawable' },
  validation: { duplicatePlayers: 'error' },
});

const engine = createDfsEngine({
  bookPolicies: [myBook],
  payoutTables: [
    definePayoutTable({
      bookId: 'my-book',
      playTypeId: 'all-in',
      effectiveFrom: '2026-05-01',
      entries: [{ pickCount: 2, hits: 2, multiplier: 4 }],
    }),
  ],
});

const result = await engine.settleEntry(
  {
    entryId: 'slip-1',
    bookId: 'my-book',
    playTypeId: 'all-in',
    stake: 10,
    displayedMultiplier: 4,
    legs: [
      {
        legId: 'a',
        playerName: 'A. Example',
        playerId: 'athlete-1',
        league: 'NBA',
        propType: 'Points',
        line: 24.5,
        direction: 'over',
        actual: null,
        status: 'pending',
        gameDate: '2026-05-07',
      },
      {
        legId: 'b',
        playerName: 'B. Example',
        league: 'NBA',
        propType: 'Rebounds',
        line: 7.5,
        direction: 'over',
        actual: null,
        status: 'pending',
      },
    ],
  },
  { actualsByLegId: { a: 28, b: 9 } },
);

console.log(result.status, result.payout, result.policyVersion, result.explanationCodes);
```

Legacy `app` / `playType` inputs are intentionally not the main v4 model. Use `adaptV2EntryInput(...)` during migration:

```ts
import { adaptV2EntryInput } from '@buzzr/dfs-engine';

const v4Input = adaptV2EntryInput({
  entryId: 'legacy-slip',
  app: 'underdog',
  playType: 'underdog_flex',
  stake: 10,
  displayedMultiplier: 11.5,
  legs: [],
});
```

Optional SDK packages:

- `@buzzr/dfs-provider-espn` wraps your ESPN-shaped loader as a stat provider.
- `@buzzr/dfs-testkit` ships fixture builders and mock providers for settlement tests.

## Operator compatibility contract

The operator-named built-ins are versioned compatibility profiles, not affiliated or endorsed implementations:

- **PrizePicks:** `status: "experimental"` with `verification.status: "partial"`. Standard Player Pick references were reviewed on 2026-07-16 from [PrizePicks Payouts](https://www.prizepicks.com/help-center/payouts), [PrizePicks Potential Outcomes](https://www.prizepicks.com/help-center/potential-outcomes), and [DNPs, Reboots, and Ties](https://www.prizepicks.com/help-center/dnps-reboots-and-ties). For a 2-pick Power entry, one correct pick plus one tie pays 1.5x, one incorrect pick plus one tie loses, and a DNP below the two-pick minimum receives a refund. Other settlement behavior and variable lineup-specific payouts remain incomplete.
- **Underdog:** `status: "experimental"` with `verification.status: "unverified"`. The [Underdog Sports Legal Center](https://legal.underdogsports.com/) is recorded as the rules entrypoint; current payout and settlement values in the compatibility snapshot have not been verified.

The displayed lineup terms are authoritative. Record `placedAt` so the engine can select an effective-dated payout table, inspect `policyStatus`, `policyVerification`, `payoutTable`, `confidence`, `sourceRefs`, and `explanationCodes` on every engine-produced result, and obtain explicit operator rulings for DNPs, reboots, ties, rescues, voids, and corrections. The three policy metadata properties are optional in the public `DfsSettlementResult` type so legacy external result objects remain source-compatible, but `createDfsEngine()` always populates them at runtime.

```ts
const policies = createDfsEngine().getBookPolicies();
// Immutable snapshots with status, verification, sources, and play types.
```

`createDfsEngine()` returns `DfsEngineWithPolicySnapshots`, which extends the legacy `DfsEngine` interface with `getBookPolicies()`. Existing external `DfsEngine` implementations do not need to add the discovery method.

Draft fixtures are source metadata for future work. They are not registered by `createDfsEngine()` and cannot settle entries unless a caller deliberately supplies a complete custom implementation.

## Examples

### 1. Look up the payout for a pick count + hit count

```ts
import { lookupStandardMultiplier } from '@buzzr/dfs-engine';

// PrizePicks compatibility table effective 2026-07-02: 5-pick Power, 5/5 → 20×.
lookupStandardMultiplier({ app: 'prizepicks', playType: 'power', pickCount: 5, hits: 5 });
// → 20

// PrizePicks compatibility table effective 2026-07-02: 6-pick Flex, 5/6 → 2×.
lookupStandardMultiplier({ app: 'prizepicks', playType: 'flex', pickCount: 6, hits: 5 });
// → 2

// Unverified Underdog compatibility snapshot: 8-pick Standard, 8/8 → 100×.
lookupStandardMultiplier({ app: 'underdog', playType: 'underdog_standard', pickCount: 8, hits: 8 });
// → 100
```

### 2. Recompute the multiplier after a DNP

```ts
import { recalcMultiplierAfterDnp } from '@buzzr/dfs-engine';

// Under the selected compatibility profile, remove one leg from a 6-pick
// Power entry and scale the slip's displayed multiplier proportionally.
const { newMultiplier } = recalcMultiplierAfterDnp({
  app: 'prizepicks',
  playType: 'power',
  originalPickCount: 6,
  survivingPickCount: 5,
  survivingHits: 5,
  originalMultiplier: 37.5,   // slip-displayed multiplier (post-boost)
});
// newMultiplier ≈ 20 (37.5 × 20/37.5)
```

`recalcMultiplierAfterDnp` returns `{ newMultiplier, usedFallback }`. `usedFallback` is `true` when the payout table doesn't cover the (app, playType, pickCount, hits) tuple — caller should warn the user that the recompute couldn't be verified.

### 3. Extract a stat from a gamelog entry

The grader needs a numeric value to compare against the line. `extractStatForProp` handles the prop-string → stat-value mapping across leagues:

```ts
import { extractStatForProp } from '@buzzr/dfs-engine';

const entry = {
  date: '2026-05-04',
  minutes: '38:21',
  points: '28',
  rebounds: '4',
  assists: '7',
  steals: '1',
  blocks: '0',
  turnovers: '2',
  threeP: '3',
};

extractStatForProp('Points', 'NBA', entry, 'prizepicks');          // 28
extractStatForProp('Pts+Rebs+Asts', 'NBA', entry, 'prizepicks');   // 39
extractStatForProp('3-Pointers Made', 'NBA', entry, 'prizepicks'); // 3
extractStatForProp('Rebounds', 'NBA', entry, 'prizepicks');        // 4
```

Slip-text aliases are normalized — `"3PT Made"`, `"3-pt made"`, `"3ptm"`, `"3pm"`, `"threes"` all resolve to `'3-Pointers Made'`. v0.3 adds 14 new props (Double-Double, Triple-Double, Pts+Stls, Longest Reception/Rush/Pass, MLB Singles/Doubles/Triples/Runs, Pitching Outs, NHL Plus/Minus). See `DFS_PROP_TYPE_KEYS` for the full canonical list (60+ props across NBA / WNBA / NCAAM/W / NFL / MLB / NHL).

### 4. Grade a full entry end-to-end

`gradeDfsBetFromGraded` rolls per-leg statuses into a bet-level result with the boost split:

```ts
import { gradeDfsBetFromGraded } from '@buzzr/dfs-engine';

const result = gradeDfsBetFromGraded({
  app: 'underdog',
  playType: 'underdog_flex',
  legs: [
    { legId: 'a', legStatus: 'won',  /* ...DfsBetLeg fields */ },
    { legId: 'b', legStatus: 'won',  /* ... */ },
    { legId: 'c', legStatus: 'lost', /* ... */ },
    { legId: 'd', legStatus: 'won',  /* ... */ },
    { legId: 'e', legStatus: 'won',  /* ... */ },
  ],
  stake: 10,
  displayedMultiplier: 11.5,      // boosted from base 10×
  baseMultiplier: 10,
  profitBoostPct: null,
});
// Unverified Underdog compatibility snapshot: 4-of-5 Flex → 2×,
// scaled by displayed/base ratio.
// → { status: 'won', effectiveMultiplier: 2.3, totalPayout: 23,
//     withdrawablePayout: 20, bonusPayout: 3 }
```

Pending semantics: if any surviving leg is `legStatus: 'pending'`, the whole bet returns `status: 'pending'` — you can call this every time a leg's `actualValue` updates without risk of premature settlement.

## Add your own sport

Built-in coverage is NBA, WNBA, NCAAM/W, NFL, MLB, NHL. The plugin registry lets you add a sport without forking:

```ts
import {
  registerLeague,
  extractStatForProp,
  type AdapterTable,
} from '@buzzr/dfs-engine';

const SOCCER_ADAPTERS: AdapterTable = {
  Goals: (entry) => parseInt(entry.points, 10) || null,
  Assists: (entry) => parseInt(entry.rebounds, 10) || null,
};

registerLeague('EPL', SOCCER_ADAPTERS);
registerLeague('MLS', SOCCER_ADAPTERS);

extractStatForProp('Goals', 'EPL', someEntry, 'prizepicks'); // your value
```

`getRegisteredLeagues()` returns the current list; `unregisterLeague(name)` removes one (useful in tests).

## Explained variants for richer error handling

When `null` isn't specific enough, use the `*Explained` variants — they return a discriminated union with a reason code so you can show the user *why* a leg can't be graded yet:

```ts
import {
  extractStatForPropExplained,
  gradeLegFromActualExplained,
} from '@buzzr/dfs-engine';

const stat = extractStatForPropExplained('Yellow Cards', 'EPL', entry, 'prizepicks');
if (!stat.ok) {
  console.log(stat.reason); // 'unknown_prop' | 'unsupported_league' | 'prop_not_supported_for_league' | 'adapter_returned_null'
  console.log(stat.detail); // human-readable context
}

const grade = gradeLegFromActualExplained(24.5, 'over', NaN);
if (!grade.ok) {
  console.log(grade.reason); // 'pending' | 'unparseable_actual'
}
```

## What's in here

| Module | Highlights |
|---|---|
| `payouts` | `lookupStandardMultiplier`, `recalcMultiplierAfterDnp`, `lookupBaseMultiplier` — reference compatibility schedules; PrizePicks includes reviewed standard rates effective 2026-07-02, while Underdog remains unverified |
| `grading` | `gradeLegFromActual` (+`Explained`), `gradeDfsBetFromGraded`, `applyLegDnp`, `computeBoostSplit`, `detectMidGameDnp`, `reconcileMidGameDnpEntries`, `findGameLogCandidates`, `shouldRegradeLeg`, `extractStatForProp` (+`Explained`) |
| `prop-normalizer` | `normalizeDfsPropType`, `asDfsPropTypeKey`, `DFS_PROP_TYPE_KEYS` |
| `stat-adapters` | `getStatAdapter`, `extractStatForPropViaRegistry`, **`registerLeague`** / **`unregisterLeague`** / **`getRegisteredLeagues`**, plus per-sport tables: `BASKETBALL_ADAPTERS`, `NFL_ADAPTERS`, `MLB_ADAPTERS`, `NHL_ADAPTERS` |
| `reconciliation-windows` | `isWithinReconciliationWindow`, per-league stat-correction TTLs (NBA 2h, NFL 24h, MLB 6h) |
| `live-helpers` | `shouldWriteLiveActual`, `buildLiveSnapshot`, `buildLiveLegAlertTitle` for live-watcher write-paths |
| `boxscore-shape` | `boxScorePlayerToGameLogShape` for sources that only ship some stats on the boxscore (NHL Hits, Blocked Shots) |
| `validators` | `validateDfsEntryInput`, `validateDfsLegInput`, `validateDfsSettlementContext`, `assertValidDfsEntryInput`, and structured validation issues |
| `types` | `DfsApp`, `DfsPlayType`, `DfsLegStatus`, `DfsBetLeg`, `DfsLegGameContext`, `DfsParseResult`, `LegLinkage`, `DfsPayoutSplit`, `BetslipParseMeta`, …and ~15 more |

The `PlayerGameLogEntryShape` the adapters consume is intentionally minimal — define your own gamelog rows that satisfy the shape (`{ date, minutes, points, ... }`) and pipe them in.

See [CHANGELOG.md](./CHANGELOG.md) for what's new in each release. Looking to contribute? Start at [CONTRIBUTING.md](./CONTRIBUTING.md). Copy-paste-runnable demos live in [examples/README.md](./examples/README.md). Generated API docs: [buzzr-app.github.io/dfs-engine](https://buzzr-app.github.io/dfs-engine/).

## Performance

Pure functions, zero deps, sub-microsecond on a Mac M-series (from `npm run bench`):

| Function | ops/sec |
|---|---|
| `gradeLegFromActual` | ~24M |
| `extractStatForPropViaRegistry` (NBA Points) | ~7.5M |
| `gradeDfsBetFromGraded` (5-pick Power) | ~11.5M |
| `recalcMultiplierAfterDnp` | ~20M |
| `applyLegDnp` (6-pick) | ~5.8M |

Floor numbers — every operation completes in microseconds. You will not be CPU-bound by this library.

## Stability

Starting at 1.0, the public API is frozen. Breaking changes only at major versions. New sports, props, and `*Explained` failure reasons can ship in minor releases without breaking consumers. See [CHANGELOG.md](./CHANGELOG.md) for the full stability contract.

## Validating untrusted inputs

When an LLM, webhook, or cross-process source hands you a slip leg or gamelog entry, run it through the validator before grading:

```ts
import {
  assertValidDfsEntryInput,
  validateDfsEntryInput,
  validatePlayerGameLogEntryShape,
} from '@buzzr/dfs-engine';

const v = validatePlayerGameLogEntryShape(maybeEntry);
if (!v.ok) {
  console.error('Bad gamelog entry:', v.errors);
  return;
}
// v.value is now typed as PlayerGameLogEntryShape

const entry = validateDfsEntryInput(maybeSettlementEntry);
if (!entry.ok) {
  console.error(entry.errors.map((issue) => [issue.path, issue.code]));
  return;
}

assertValidDfsEntryInput(maybeSettlementEntry);
```

v4 settlement inputs are canonical: use `actual` on `DfsLegInput`, `status` for leg state, `actualsByLegId` for settlement context actuals, and `legStatusesByLegId` for status overrides. Legacy `stat`, `legStatus`, `statsByLegId`, and `legStatusByLegId` are rejected by the strict validators.

## Status & caveats

- **Compatibility status is part of the result.** PrizePicks is experimental and partially verified; Underdog is experimental and unverified. Neither profile certifies a current operator ruling.
- **PrizePicks standard references were reviewed 2026-07-16.** The current standard table is effective 2026-07-02, and older effective-dated tables remain for historical entries. Recheck the linked first-party sources before relying on a later entry.
- **Displayed slip terms are authoritative.** Tables are compatibility inputs and demotion-ratio baselines; variable, promotional, state-specific, and entry-specific terms may differ.
- **Gamelog parsing is your problem.** This package grades stats; it doesn't fetch them. Adapt ESPN, your own scraper, or a paid data feed to `PlayerGameLogEntryShape` upstream.
- **Sport coverage:** NBA / WNBA / NCAAM (basketball), NFL, MLB (batters + pitchers), NHL (skaters + goalies). Adding a sport means a new `AdapterTable` plus extending `DfsPropTypeKey`.

## Origin

Extracted from [Buzzr](https://apps.apple.com/us/app/buzzr-sports/id6760628256) and maintained in this public monorepo. The mobile app currently vendors the 5.0.0 engine tarball; later public-repository changes require a deliberate app upgrade. Operator-named policy outputs remain compatibility estimates subject to the displayed entry terms and current operator ruling.

## Compatibility and support

Node.js >= 22 is supported. Import the supported API from `@buzzr/dfs-engine`.
Deep `src/*` and `dist/*` imports are unsupported. See the
[all-package API index](../../docs/api-reference.md) and the
[generated root-export reference](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-engine.html).

Report reproducible defects in [GitHub Issues](https://github.com/Buzzr-app/dfs-engine/issues).
Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md). The
[versioning and support policy](../../docs/versioning-and-support.md) defines the
supported runtime and SemVer contract.

## License

[MIT](../../LICENSE) © Sarvesh Chidambaram
