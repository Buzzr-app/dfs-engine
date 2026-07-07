# AGENTS.md — Buzzr Sports Engines

Guidance for AI coding agents working in this monorepo or consuming the published `@buzzr/*` packages.

## What this repo is

An npm workspaces monorepo (`packages/*`) publishing ten pure-TypeScript packages for sports betting / DFS apps. Three core engines, one MCP server, six satellites. Everything is pure functions: no I/O, no network, no framework runtime, zero runtime dependencies outside the `@buzzr/*` family.

## Package map and API entry points

Each package's public API is exactly what `packages/<name>/src/index.ts` exports. Do not import from deep paths — only the package root is a supported entry point.

| Package                          | Directory                            | Primary entry points                                                                       |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `@buzzr/dfs-engine`              | `packages/dfs-engine`                | `createDfsEngine`, `defineStatProvider`, `defineBookPolicy`, `engine.settleEntry`, `engine.settleEntries` (v5 batch) |
| `@buzzr/bets-core`               | `packages/bets-core`                 | `calculateNoVigFairLine`, `combineAmericanOdds`, `calculateParlayFairValue`, `calculateExpectedValue`, `calculateKellyStake`, `calculateClosingLineValue`, `calculateRollupByPeriod` |
| `@buzzr/entertainment-engine`    | `packages/entertainment-engine`      | `resolveBuzzScores`, `enrichGameRowWithBuzzScores`, `isMustWatch`, `rankGamesForUser`       |
| `@buzzr/mcp`                     | `packages/mcp`                       | MCP server, bin `buzzr-mcp` (run via `npx -y @buzzr/mcp`), 8 tools over the three engines   |
| `@buzzr/dfs-cli`                 | `packages/dfs-cli`                   | bin `dfs-grade`; `runGrade`, `runGradeFromFiles`                                            |
| `@buzzr/dfs-react`               | `packages/dfs-react`                 | `getSlipDisplayModel`, `getStatusTone`, `formatLegLabel`, `formatLegLine`                   |
| `@buzzr/dfs-testkit`             | `packages/dfs-testkit`               | `makeDfsEntry`, `makeDfsLeg`, `makeGameLogEntry`, `createMockStatProvider`, `makeInvalidDfsEntry` |
| `@buzzr/dfs-provider-espn`       | `packages/dfs-provider-espn`         | `createEspnStatProvider`                                                                    |
| `@buzzr/dfs-provider-sportradar` | `packages/dfs-provider-sportradar`   | `createSportradarStatProvider`, `sportradarRowToGameLog`                                    |
| `@buzzr/dfs-engine-test-vectors` | `packages/dfs-engine-test-vectors`   | `TEST_VECTORS`                                                                              |

API reference: https://buzzr-app.github.io/dfs-engine/ (typedoc, generated from `@buzzr/dfs-engine`).

## Invariants — do not break these

1. **Zero runtime dependencies.** No package may add a runtime dependency outside the `@buzzr/*` family. If a change needs a library, it does not belong in these packages.
2. **Pure functions only.** No I/O, no network calls, no timers, no global mutable state in engine code. Data providers are injected by the consumer (`StatProvider`, etc.); the engines never fetch.
3. **v4 canonical shapes are frozen contracts.** `DfsEntryInput`, `DfsLegInput` (`legId`, `actual`, `status`, `direction`, `line`, …), and `PlayerGameLogEntryShape` (string-valued stat fields: `points: '31'`) are the interchange formats. Changing a field name or type is a breaking change requiring a major version — never do it casually.
4. **Settlement must stay explainable.** Every settlement result carries `validation`, `provenance`, `auditTrail`, and `explanationCodes`. New settlement paths must populate them; never return a bare status.
5. **The verify gate is the definition of done.** `npm run verify` (typecheck, lint, format check, tests, coverage, build, docs, export smoke tests, package size checks, dry-run pack) must pass before any release-bound change is complete.
6. **Golden vectors are conformance law.** If a change alters the outcome of any fixture in `@buzzr/dfs-engine-test-vectors`, that is a breaking behavioral change — flag it, don't silently update the vectors.

## Working in the repo

```bash
npm ci               # install (Node >= 22 required)
npm run typecheck    # tsc across all workspaces
npm test             # vitest across all workspaces
npm run lint         # eslint on packages/*/src and packages/*/tests
npm run build        # tsup builds (ESM + CJS + d.ts)
npm run verify       # full release gate
```

- Tests live in `packages/<name>/tests` and run with vitest.
- Prettier formats `packages/*/{src,tests,examples}` and root-level `*.{json,md}` — run `npm run format` before committing doc or config changes.
- Changesets (`@changesets/cli`) drive versioning; all packages currently release in lockstep (5.x).

## Consuming the packages (for agents writing integration code)

- To grade a DFS entry: build a `DfsEntryInput`, register a `StatProvider` that returns `PlayerGameLogEntryShape[]` rows, call `engine.settleEntry(entry, { statProviderId })`. See `packages/dfs-cli/src/index.ts` for a minimal end-to-end example.
- To verify an integration, replay `TEST_VECTORS` from `@buzzr/dfs-engine-test-vectors` and assert identical statuses and per-leg actuals.
- For AI-agent runtimes, prefer the MCP server (`npx -y @buzzr/mcp`) over reimplementing odds/settlement math in prompts.

## Machine-readable index

See [llms.txt](llms.txt) for a compact package/exports/docs index following the llms.txt convention.
