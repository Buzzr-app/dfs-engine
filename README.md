# Buzzr DFS Settlement OS

Monorepo for the Buzzr DFS settlement packages.

## Packages

| Package | Purpose |
|---|---|
| `@buzzr/bets-core` | Pure Buzzr Bets domain contracts, sportsbook normalization, odds/edge math, ROI rollups, and settlement adapters. |
| `@buzzr/dfs-engine` | Core zero-runtime-dependency settlement engine, grading math, strict v4 book policy registry, adapters, and validation exports. |
| `@buzzr/dfs-provider-espn` | Optional provider contract package for wiring ESPN-shaped gamelog data into the engine. |
| `@buzzr/dfs-testkit` | Golden fixture builders, mock providers, and contract helpers for consumers and Buzzr app tests. |

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
```

## Release Hardening

Before publishing or cutting a release, run:

```bash
npm run verify
npm run audit:high
```

`verify` runs typecheck, lint, format check, tests, coverage, build, docs, export smoke tests, package size checks, and a dry-run pack across all packages.

## Reporting Bugs

Use the GitHub bug report template for package defects. Include the package version, Node version, book policy/play type, provider data shape, and a minimal reproduction.

For settlement correctness or security-sensitive issues, follow [SECURITY.md](SECURITY.md) so reports can be triaged before public disclosure.
