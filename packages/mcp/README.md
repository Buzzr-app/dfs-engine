# @buzzr/mcp

MCP server exposing the @buzzr sports engines to AI agents — DFS settlement, odds
math, and entertainment predictions as tools.

`@buzzr/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) stdio
server that puts the whole @buzzr engine family in front of any MCP-capable agent
(Claude Desktop, Claude Code, or your own client). All math and policy logic lives
in the underlying engines — this package is a thin, schema-validated tool surface:

- [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) — pick-em
  settlement with real book policies (PrizePicks, Underdog, drafts)
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

| Tool                 | Engine                       | What it does                                                                                                              |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `grade_dfs_entry`    | @buzzr/dfs-engine            | Settle a DFS pick-em entry: applies the book policy (ties, DNPs, flex tables) and returns status, payout split, per-leg decisions, and explanation codes. |
| `validate_dfs_entry` | @buzzr/dfs-engine            | Run the engine's runtime validators against a candidate entry; returns structured error/warning issues without settling.  |
| `list_book_policies` | @buzzr/dfs-engine            | Enumerate the registered DFS books (built-in stable policies plus draft fixtures) with play types and policy status.       |
| `fair_line`          | @buzzr/bets-core             | Remove the vig from a two-sided market: fair probability, fair American odds, overround, and edge vs. the offered price.   |
| `parlay_value`       | @buzzr/bets-core             | Price a parlay: per-leg no-vig probabilities, fair combined odds, edge of the offered price, optional expected value.      |
| `kelly_stake`        | @buzzr/bets-core             | Kelly-criterion stake sizing with fractional-Kelly support (defaults to quarter-Kelly).                                    |
| `predict_game_buzz`  | @buzzr/entertainment-engine  | Predict a game's 1–10 entertainment (buzz) score with model confidence and weighted factor breakdown.                      |
| `rank_games`         | @buzzr/entertainment-engine  | Rank candidate games for a user's taste profile: base score plus bounded personal-affinity and social adjustments.         |

Every tool validates its input with zod before touching an engine, and returns
results as JSON text content. Failures come back as structured MCP error results
(`isError: true` with `{ "error": { "code", "message" } }`) instead of protocol
errors — agents can read and recover from them.

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
> both legs won, the 2-pick power table pays 3x.

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

## Compatibility

- Node.js >= 22
- `rank_games` requires `@buzzr/entertainment-engine` >= 5.0.0. Against an older
  engine build the tool degrades gracefully with an `engine_capability_missing`
  error result instead of crashing the server.

## License

MIT
