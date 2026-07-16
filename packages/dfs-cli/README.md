# @buzzr/dfs-cli

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-cli)](https://www.npmjs.com/package/@buzzr/dfs-cli)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-cli)](https://www.npmjs.com/package/@buzzr/dfs-cli)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-cli)](https://www.npmjs.com/package/@buzzr/dfs-cli)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-cli)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Grade a DFS pick'em entry from two JSON files — no code required.** This is a command-line wrapper around [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine), with bounded inputs, effective-dated compatibility tables, policy metadata, and a full audit trail.

The operator-named built-ins are independent estimates: PrizePicks is experimental and partially verified; Underdog is experimental and unverified. Displayed entry terms are authoritative. Treat output as an audit aid, inspect `policyStatus`, `policyVerification`, `payoutTable`, `confidence`, `sourceRefs`, and `explanationCodes`, and confirm DNP, reboot, tie, rescue, void, and correction rulings with the operator.

## 30-second quick start

```bash
npm install -g @buzzr/dfs-cli
```

Create `entry.json` (the slip you want to grade):

```json
{
  "entryId": "entry-001",
  "bookId": "prizepicks",
  "playTypeId": "power",
  "stake": 10,
  "displayedMultiplier": 3,
  "legs": [
    {
      "legId": "leg-1",
      "playerName": "Jayson Tatum",
      "playerId": "athlete-a",
      "league": "NBA",
      "propType": "Points",
      "line": 26.5,
      "direction": "over",
      "actual": null,
      "status": "pending",
      "gameDate": "2026-05-07T00:00:00.000Z"
    }
  ]
}
```

And `gamelogs.json` (what the players actually did, keyed by `legId`):

```json
{
  "leg-1": [
    {
      "date": "2026-05-07T00:00:00.000Z",
      "minutes": "38:00",
      "points": "31",
      "rebounds": "8",
      "assists": "5",
      "steals": "1",
      "blocks": "0",
      "turnovers": "2",
      "threeP": "4"
    }
  ]
}
```

Then grade it:

```bash
dfs-grade entry.json --gamelogs gamelogs.json
```

The full `DfsSettlementResult` prints to stdout as JSON — status, payout split, per-leg decisions with provider provenance, a validation report, and an audit trail:

```json
{
  "entryId": "entry-001",
  "bookId": "prizepicks",
  "status": "won",
  "effectiveMultiplier": 3,
  "payout": { "total": 30, "withdrawable": 30, "bonus": 0 },
  "legs": [{ "legId": "leg-1", "status": "won", "actual": 31, "...": "..." }],
  "auditTrail": [{ "code": "settlement.won", "...": "..." }]
}
```

Exit code is `0` on success and `1` on any error (bad JSON, invalid entry, unknown book policy), so it drops straight into shell scripts and CI pipelines.

## Programmatic API

The same grading path is exported as plain async functions:

```ts
import { runGrade, runGradeFromFiles } from '@buzzr/dfs-cli';

// From in-memory objects
const result = await runGrade({
  entry, // DfsEntryInput
  gameLogsByLegId: { 'leg-1': [gameLogRow] },
});

// Or straight from files
const fromFiles = await runGradeFromFiles({
  entryPath: './entry.json',
  gameLogsPath: './gamelogs.json',
});
```

| Export                  | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `dfs-grade` (bin)       | Grade an entry JSON against a gamelogs JSON, print settlement        |
| `runGrade()`            | Grade an in-memory `DfsEntryInput` against a `legId → gamelog[]` map |
| `runGradeFromFiles()`   | Same, reading both inputs from file paths                            |

## When to use this vs siblings

| You want to…                                        | Reach for                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Grade entries from the shell, CI, or a cron job     | **this package**                                                                                  |
| Grade entries inside a TypeScript/JavaScript app    | [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)                            |
| Render results in a UI                              | [`@buzzr/dfs-react`](https://www.npmjs.com/package/@buzzr/dfs-react)                              |
| Build fixtures for your own tests                   | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit)                          |
| Replay versioned engine regression cases           | [`@buzzr/dfs-engine-test-vectors`](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors) |

## Links

- [All-package API index](../../docs/api-reference.md)
- [Generated root-export reference](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-cli.html)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## Compatibility and support

Node.js >= 22 is supported. Use the `dfs-grade` executable for the command line.
Import the supported API from `@buzzr/dfs-cli`.
Deep `src/*` and `dist/*` imports are unsupported.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md). The
[versioning and support policy](../../docs/versioning-and-support.md) defines the
supported runtime and SemVer contract.

## License

[MIT](../../LICENSE)
