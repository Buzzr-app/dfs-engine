# @buzzr/mcp

MCP server exposing the @buzzr sports engines to AI agents — DFS settlement, odds
math, and entertainment predictions as tools.

`@buzzr/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) stdio
server that puts the whole @buzzr engine family in front of any MCP-capable agent
(Claude Desktop, Claude Code, or your own client). All math and policy logic lives
in the underlying engines — this package is a thin, schema-validated tool surface:

- [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) — pick-em
  settlement with versioned compatibility and custom policies
- [`@buzzr/bets-core`](https://www.npmjs.com/package/@buzzr/bets-core) — no-vig fair
  lines, parlay pricing, expected value, Kelly staking
- [`@buzzr/entertainment-engine`](https://www.npmjs.com/package/@buzzr/entertainment-engine) —
  ML buzz-score predictions and personalized game ranking

## Install

Run it directly with npx (Node 22+):

```sh
npx -y @buzzr/mcp
```

The server speaks MCP over stdio: JSON-RPC on stdin/stdout, logs on stderr.
It exposes 11 tools with bounded inputs and outputs, and does not fetch live
odds, box scores, operator accounts, or private user data.

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "buzzr": {
      "command": "npx",
      "args": ["-y", "@buzzr/mcp"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add buzzr -- npx -y @buzzr/mcp
```

or in `.mcp.json`:

```json
{
  "mcpServers": {
    "buzzr": {
      "command": "npx",
      "args": ["-y", "@buzzr/mcp"]
    }
  }
}
```

## Tool catalog

| Tool                    | Engine                      | What it does                                                                                                                               |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `grade_dfs_entry`       | @buzzr/dfs-engine           | Settle one 1–12-leg entry and return the full result plus explanation.                                                                      |
| `grade_dfs_entries`     | @buzzr/dfs-engine           | Settle 1–25 entries, up to 300 total legs, with bounded concurrency and isolated failures.                                                   |
| `validate_dfs_entry`    | @buzzr/dfs-engine           | Return structured engine validation issues for a candidate entry without settling it.                                                       |
| `list_book_policies`    | @buzzr/dfs-engine           | List authoritative executable profile snapshots and metadata-only drafts, including status, verification, sources, and complete play types. |
| `fair_line`             | @buzzr/bets-core            | Remove vig from both sides of one two-way market.                                                                                           |
| `closing_line_value`    | @buzzr/bets-core            | Compare placed and closing prices for the same selection.                                                                                   |
| `parlay_value`          | @buzzr/bets-core            | Price independent parlay legs, compare offered odds, and optionally calculate expected value.                                               |
| `kelly_stake`           | @buzzr/bets-core            | Calculate full and fractional Kelly stakes from a supplied win probability.                                                                 |
| `summarize_bet_history` | @buzzr/bets-core            | Summarize up to 500 bets with overall and UTC-period rollups, drawdown, and streaks.                                                         |
| `predict_game_buzz`     | @buzzr/entertainment-engine | Predict one game's 1–10 entertainment score with confidence and factor detail.                                                              |
| `rank_games`            | @buzzr/entertainment-engine | Rank 1–100 candidate games for a bounded taste profile.                                                                                     |

Tool strings, identifiers, arrays, stdio frames, concurrent calls, and serialized
results are bounded. American odds must be within `[-100000, -100]` or
`[100, 100000]`. `grade_dfs_entries`, `closing_line_value`, and
`summarize_bet_history` return string `contractVersion: "1"`.

## DFS policy safety

Operator-named policies are independent compatibility profiles, not official
rules engines or evidence of affiliation:

- PrizePicks is experimental and partially verified. Standard payout references
  were reviewed on 2026-07-16 from
  [PrizePicks Payouts](https://www.prizepicks.com/help-center/payouts) and
  [PrizePicks Potential Outcomes](https://www.prizepicks.com/help-center/potential-outcomes);
  settlement behavior and variable lineup-specific payouts remain incomplete.
- Underdog is experimental and unverified. The
  [Underdog Sports Legal Center](https://legal.underdogsports.com/) is the recorded
  rules entrypoint; the current compatibility payout and settlement values have
  not been verified.

Displayed lineup terms are authoritative. Call `list_book_policies` before
grading, inspect verification and sources, and obtain explicit operator rulings
for DNPs, reboots, ties, rescues, voids, and corrections. The tool lists future
fixtures with `executable: false`; grading tools reject draft book IDs because
drafts are metadata, not settlement implementations.

## Error contracts

- Invalid tool arguments return the same bounded `invalid_input` result through
  an MCP client transport or a direct exported `tool.handler(...)` call. At most
  eight compact validation issues are included; raw Zod errors are never returned.
- Malformed JSON-RPC envelopes remain protocol errors owned by the MCP SDK and
  are distinct from a valid `tools/call` request with invalid tool arguments.
- `validate_dfs_entry` intentionally accepts a bounded candidate object and
  returns the engine's structured validation report.
- Execution failures return generic `isError: true` results such as
  `tool_execution_failed`, `entry_settlement_failed`, `server_busy`, or
  `result_too_large`. Internal error details are not public.

## Example transcripts

**"Did my PrizePicks slip hit?"**

> **User:** I had a $10 2-pick power play: LeBron over 25.5 points (he scored 31)
> and Curry over 27.5 (he scored 33). What's the payout?
>
> **Agent** calls `grade_dfs_entry`:
>
> ```json
> {
>   "entryId": "slip-1",
>   "bookId": "prizepicks",
>   "playTypeId": "power",
>   "stake": 10,
>   "displayedMultiplier": 3,
>   "legs": [
>     { "legId": "l1", "playerName": "LeBron James", "league": "NBA", "propType": "points", "line": 25.5, "direction": "over", "actual": 31 },
>     { "legId": "l2", "playerName": "Stephen Curry", "league": "NBA", "propType": "points", "line": 27.5, "direction": "over", "actual": 33 }
>   ]
> }
> ```
>
> Result: `"status": "won"`, `"payout": { "total": 30, "withdrawable": 30, "bonus": 0 }` —
> both supplied actuals clear their lines and the submitted 3× displayed multiplier
> is consistent with the selected compatibility table. Confirm the actual entry
> details before treating this as an operator outcome.

**"Is this parlay +EV?"**

> **User:** The book offers +264 on a two-leg parlay where both legs are -110/-110
> markets. Worth $100?
>
> **Agent** calls `parlay_value` with
> `{ "legs": [{ "selected": -110, "opposite": -110 }, { "selected": -110, "opposite": -110 }], "offeredAmericanOdds": 264, "stake": 100 }`.
>
> Result: fair probability 0.25 (fair price +300) vs. offered +264 —
> `"edgePercent": -2.47` and an expected loss of about $9 per $100. The agent
> recommends passing.

**"What should I watch tonight?"**

> **User:** I'm a Lakers fan. Rank tonight's slate for me.
>
> **Agent** calls `rank_games` with the slate and
> `{ "profile": { "favoriteTeams": ["Lakers"], "leagueAffinity": { "NBA": 0.8 } } }`.
>
> Result: each game comes back with `baseScore`, bounded `affinityAdjustment` and
> `socialAdjustment`, a `totalScore`, and named factors ("favorite team playing",
> "league affinity") the agent can cite when explaining the ranking.

## Embedding

The server is also exported as a library, so you can mount the same tool catalog
on your own transport (in-memory for tests, HTTP, etc.):

```ts
import { createBuzzrMcpServer, allTools } from '@buzzr/mcp';

const server = createBuzzrMcpServer();
await server.connect(myTransport);
```

Individual tool definitions (`gradeDfsEntryTool`, `fairLineTool`, …) are exported
too — each is `{ name, title, description, inputSchema, handler }`, and handlers
can be called directly without any transport.

## Codex skill

The repository includes a
[Buzzr Sports Engine skill](../../skills/buzzr-sports-engine/SKILL.md) with the
11-tool routing guide, limits, response-reading order, and operator-safety rules:

```sh
npx skills add https://github.com/Buzzr-app/dfs-engine --skill buzzr-sports-engine
```

## Compatibility

- Node.js >= 22
- `rank_games` requires `@buzzr/entertainment-engine` >= 5.0.0. Against an older
  engine build the tool degrades gracefully with an `engine_capability_missing`
  error result instead of crashing the server.

## License

MIT
