# AGENTS.md — Buzzr Sports Engines

Guidance for AI coding agents working in this monorepo or consuming the published `@buzzr/*` packages.

## What this repo is

An npm workspaces monorepo (`packages/*`) publishing ten TypeScript packages for sports betting / DFS apps: three pure core engines, one stdio MCP server, one filesystem CLI, and five provider/UI/testing satellites. The core engines perform no I/O and have zero external runtime dependencies. Boundary packages have explicit jobs: the CLI reads files, provider packages call consumer-supplied loaders, and the MCP server uses the official MCP SDK plus Zod.

## Package map and API entry points

Each package's public API is exactly what `packages/<name>/src/index.ts` exports. Do not import from deep paths — only the package root is a supported entry point.

| Package                          | Directory                            | Primary entry points                                                                       |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `@buzzr/dfs-engine`              | `packages/dfs-engine`                | `createDfsEngine`, `defineStatProvider`, `defineBookPolicy`, `engine.settleEntry`, `engine.settleEntries` (v5 batch) |
| `@buzzr/bets-core`               | `packages/bets-core`                 | `calculateNoVigFairLine`, `combineAmericanOdds`, `calculateParlayFairValue`, `calculateExpectedValue`, `calculateKellyStake`, `calculateClosingLineValue`, `calculateRollupByPeriod` |
| `@buzzr/entertainment-engine`    | `packages/entertainment-engine`      | `resolveBuzzScores`, `enrichGameRowWithBuzzScores`, `isMustWatch`, `rankGamesForUser`       |
| `@buzzr/mcp`                     | `packages/mcp`                       | MCP server, bins `mcp` / `buzzr-mcp`, 11 tools over the three engines                      |
| `@buzzr/dfs-cli`                 | `packages/dfs-cli`                   | bin `dfs-grade`; `runGrade`, `runGradeFromFiles`                                            |
| `@buzzr/dfs-react`               | `packages/dfs-react`                 | `getSlipDisplayModel`, `getStatusTone`, `formatLegLabel`, `formatLegLine`                   |
| `@buzzr/dfs-testkit`             | `packages/dfs-testkit`               | `makeDfsEntry`, `makeDfsLeg`, `makeGameLogEntry`, `createMockStatProvider`, `makeInvalidDfsEntry` |
| `@buzzr/dfs-provider-espn`       | `packages/dfs-provider-espn`         | `createEspnStatProvider`                                                                    |
| `@buzzr/dfs-provider-sportradar` | `packages/dfs-provider-sportradar`   | `createSportradarStatProvider`, `sportradarRowToGameLog`                                    |
| `@buzzr/dfs-engine-test-vectors` | `packages/dfs-engine-test-vectors`   | `TEST_VECTORS` engine regression fixtures                                                   |

See the [all-package API index](docs/api-reference.md). The generated
[TypeDoc site](https://buzzr-app.github.io/dfs-engine/) covers the supported
root exports of all ten public packages.

## Invariants — do not break these

1. **Keep the cores dependency-free.** The three core engines have zero external runtime dependencies. Boundary packages may use reviewed dependencies required by their contract; `@buzzr/mcp` already uses the official MCP SDK and Zod. Never add a dependency casually, and keep settlement math out of wrappers.
2. **Keep engine code pure.** No I/O, network calls, timers, or global mutable state in core engine execution. Data providers are injected by the consumer (`StatProvider`, etc.). The CLI and MCP server are intentionally I/O boundaries, not pure-function packages.
3. **v4 canonical shapes are frozen contracts.** `DfsEntryInput`, `DfsLegInput` (`legId`, `actual`, `status`, `direction`, `line`, …), and `PlayerGameLogEntryShape` (string-valued stat fields: `points: '31'`) are the interchange formats. Changing a field name or type is a breaking change requiring a major version — never do it casually.
4. **Settlement must stay explainable.** Every settlement result carries `validation`, `provenance`, `auditTrail`, and `explanationCodes`. New settlement paths must populate them; never return a bare status.
5. **Run the complete release proof.** `npm run verify` covers typecheck, lint, formatting, tests and coverage, build, packed-MCP real-client proof, TypeDoc, exports, package size/pack smoke, release workflows, MCP Registry metadata, and high-severity dependency audit. Public documentation additionally requires `node scripts/check-public-docs.mjs`.
6. **Treat vectors as versioned review gates.** `@buzzr/dfs-engine-test-vectors` publishes engine regression fixtures. A changed outcome requires explanation, compatibility analysis, and the appropriate version; never silently rewrite expected results. The fixtures are not official operator conformance.
7. **Keep operator claims bounded.** PrizePicks is an experimental/partial compatibility profile and Underdog is experimental/unverified. Displayed entry terms and explicit operator rulings are authoritative; drafts remain non-executable.

## Working in the repo

```bash
npm ci               # install (Node >= 22 required)
npm run typecheck    # tsc across all workspaces
npm test             # vitest across all workspaces
npm run lint         # eslint on packages/*/src and packages/*/tests
npm run build        # package-defined build outputs
npm run verify       # full release gate
node scripts/check-public-docs.mjs
```

- Tests live in `packages/<name>/tests` and run with vitest.
- The repository's Prettier ignore file excludes Markdown. Run the public-docs contract and `git diff --check` for Markdown; run `npm run format:check` for the configured code/JSON surface.
- Changesets (`@changesets/cli`) drive independent package releases. Select the smallest semver changes justified by public API/behavior and update dependents only when their pins or contracts require it.

## Consuming the packages (for agents writing integration code)

- To grade a DFS entry: build a `DfsEntryInput`, register a `StatProvider` that returns `PlayerGameLogEntryShape[]` rows, call `engine.settleEntry(entry, { statProviderId })`. See `packages/dfs-cli/src/index.ts` for a minimal end-to-end example.
- To verify an integration, replay `TEST_VECTORS` from `@buzzr/dfs-engine-test-vectors` against the matching engine version and inspect the full expected policy, payout, validation, provenance, explanation, audit, pending, and leg contract.
- For AI-agent runtimes, prefer the MCP server (`npx -y @buzzr/mcp@5.1.0`) over reimplementing odds/settlement math in prompts. Call `list_book_policies` before grading and use only `executable: true` policies.

## Public documentation

- [Architecture and data flow](docs/architecture.md)
- [Security, privacy, and threat model](docs/security-and-privacy.md)
- [Versioning, compatibility, and support](docs/versioning-and-support.md)
- [All-package API index](docs/api-reference.md)
- [MCP installation and contracts](packages/mcp/README.md)
- [Repository-owned Codex skill](skills/buzzr-sports-engine/SKILL.md)

## Machine-readable index

See [llms.txt](llms.txt) for a compact package/exports/docs index following the llms.txt convention.
