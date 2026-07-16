# Package API index

This page maps every published package to its supported root API and detailed package documentation. The package's `src/index.ts` is authoritative; deep `src/*` or `dist/*` imports are unsupported.

The [generated TypeDoc site](https://buzzr-app.github.io/dfs-engine/) covers the supported root exports of all ten public packages. This hand-curated index adds package purpose and entry-point guidance; each package section links directly to its generated module reference.

## Core engines

### `@buzzr/dfs-engine`

DFS validation, effective-dated compatibility/custom policies, stat providers, settlement, payout math, provenance, and audit records.

- Primary runtime: `createDfsEngine`, `defineStatProvider`, `defineBookPolicy`, `definePayoutTable`, `validateBookPolicyDefinition`, `validateDfsEntryInput`, grading/payout helpers, league adapters, and migration adapters.
- Primary contracts: `DfsEntryInput`, `DfsLegInput`, `DfsSettlementContext`, `DfsSettlementResult`, batch result/cache types, policy/table/source/verification types, and provider interfaces.
- [README](../packages/dfs-engine/README.md)
- [Root exports](../packages/dfs-engine/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-engine.html)

### `@buzzr/bets-core`

Sportsbook odds, value, bankroll, and history analytics.

- Primary runtime: `americanOddsToImpliedProbability`, `probabilityToAmericanOdds`, `calculateNoVigFairLine`, `combineAmericanOdds`, `calculateParlayProbability`, `calculateParlayFairValue`, `calculateExpectedValue`, `calculateKellyStake`, `calculateClosingLineValue`, `calculateBetRollup`, `calculateRollupByPeriod`, `calculateDrawdown`, `calculateStreaks`, `normalizeSportsbookSlug`, and `betRecordToDfsEntryInput`.
- [README](../packages/bets-core/README.md)
- [Root exports](../packages/bets-core/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_bets-core.html)

### `@buzzr/entertainment-engine`

Transparent entertainment scoring, feature extraction/training, model diagnostics, reporting, and personalized recommendations.

- Primary runtime: `resolveBuzzScores`, `enrichGameRowWithBuzzScores`, `isMustWatch`, `predictGame`, `predictGameWithDiagnostics`, `trainSGD`, `validateModel`, `buildModelRunReport`, `rankGamesForUser`, and `explainRecommendation`.
- Primary constants/contracts: `MUST_WATCH_THRESHOLD`, model version/feature constants, score/model/report types, `UserAffinityProfile`, and recommendation types.
- [README](../packages/entertainment-engine/README.md)
- [Root exports](../packages/entertainment-engine/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_entertainment-engine.html)

## Process boundaries

### `@buzzr/mcp`

Local stdio MCP server exposing 11 tools across the three core engines.

- Server API: `createBuzzrMcpServer`, `registerBuzzrTool`, `allTools`, `SERVER_NAME`, and `SERVER_VERSION`.
- Tool groups: `dfsTools`, `oddsTools`, `historyTools`, and `buzzTools`, plus each named tool definition.
- Embedding helpers: `defineTool`, `jsonResult`, `errorResult`, and public tool/result types.
- Executables: `mcp` and `buzzr-mcp`.
- [README and 11-tool catalog](../packages/mcp/README.md)
- [Root exports](../packages/mcp/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_mcp.html)

### `@buzzr/dfs-cli`

Filesystem wrapper for grading one entry JSON document against a leg-keyed game-log JSON document.

- Runtime: `runGrade` and `runGradeFromFiles`.
- Contracts: `GameLogsByLegId`, `RunGradeInput`, and `RunGradeFileInput`.
- Executable: `dfs-grade`.
- [README](../packages/dfs-cli/README.md)
- [Root exports](../packages/dfs-cli/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-cli.html)

## Integration helpers

### `@buzzr/dfs-react`

Framework-neutral settlement display models; no React runtime dependency.

- Runtime: `getSlipDisplayModel`, `getStatusTone`, `formatLegLabel`, and `formatLegLine`.
- Contracts: `SlipStatusTone`, `LegDisplayModel`, and `SlipDisplayModel`.
- [README](../packages/dfs-react/README.md)
- [Root exports](../packages/dfs-react/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-react.html)

### `@buzzr/dfs-testkit`

Fixture builders and injected mock providers for engine consumers.

- Runtime: `makeDfsEntry`, `makeDfsLeg`, `makeGameLogEntry`, `createMockStatProvider`, and `makeInvalidDfsEntry`.
- [README](../packages/dfs-testkit/README.md)
- [Root exports](../packages/dfs-testkit/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-testkit.html)

### `@buzzr/dfs-provider-espn`

Adapter from a consumer-owned ESPN-shaped game-log loader to `StatProvider`. It performs no network request itself.

- Runtime: `createEspnStatProvider`.
- Contracts: `EspnGameLogLoaderInput` and `EspnStatProviderOptions`.
- [README](../packages/dfs-provider-espn/README.md)
- [Root exports](../packages/dfs-provider-espn/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-provider-espn.html)

### `@buzzr/dfs-provider-sportradar`

Adapter from consumer-owned Sportradar-shaped basketball rows to `PlayerGameLogEntryShape` and `StatProvider`. It performs no network request itself.

- Runtime: `createSportradarStatProvider` and `sportradarRowToGameLog`.
- Contracts: `SportradarBasketballStatLine`, `SportradarGameLogLoaderInput`, and `SportradarStatProviderOptions`.
- [README](../packages/dfs-provider-sportradar/README.md)
- [Root exports](../packages/dfs-provider-sportradar/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-provider-sportradar.html)

### `@buzzr/dfs-engine-test-vectors`

Versioned engine regression fixtures for the matching `@buzzr/dfs-engine` version. They are not official operator conformance.

- Runtime: `TEST_VECTORS`.
- Contracts: `TestVector`, `ExpectedSettlement`, and `ExpectedLegOutcome`.
- [README](../packages/dfs-engine-test-vectors/README.md)
- [Root exports](../packages/dfs-engine-test-vectors/src/index.ts)
- [Generated TypeDoc](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-engine-test-vectors.html)

## Machine-readable and agent references

- [`llms.txt`](../llms.txt) for a compact package index.
- [`AGENTS.md`](../AGENTS.md) for repository invariants.
- [Buzzr Sports Engine skill](../skills/buzzr-sports-engine/SKILL.md) for MCP/package routing and operator safety.
