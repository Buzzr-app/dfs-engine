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

Run it directly with npx (Node 22+). Pin the version you reviewed instead of
silently accepting a future `latest` release:

```sh
npx -y @buzzr/mcp@<published-version>
```

The server speaks MCP over stdio: JSON-RPC on stdin/stdout, logs on stderr.
It exposes 11 tools with bounded inputs and outputs, and does not fetch live
odds, box scores, operator accounts, or private user data.

### Claude Desktop

Add this to `claude_desktop_config.json` from **Settings → Developer → Edit
Config**, then fully quit and reopen Claude Desktop:

```json
{
  "mcpServers": {
    "buzzr": {
      "command": "npx",
      "args": ["-y", "@buzzr/mcp@<published-version>"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add --transport stdio buzzr -- npx -y @buzzr/mcp@<published-version>
```

For a version-controlled project configuration, add this to `.mcp.json`, trust
the project when prompted, and start a new Claude Code session:

```json
{
  "mcpServers": {
    "buzzr": {
      "command": "npx",
      "args": ["-y", "@buzzr/mcp@<published-version>"]
    }
  }
}
```

Confirm it with `claude mcp get buzzr`; inside Claude Code, `/mcp` shows the
connection and discovered tool count.

### Cursor

Add this to the repository's `.cursor/mcp.json` (or the equivalent user-level
MCP configuration), then fully restart Cursor:

```json
{
  "mcpServers": {
    "buzzr": {
      "command": "npx",
      "args": ["-y", "@buzzr/mcp@<published-version>"]
    }
  }
}
```

Open **Cursor Settings → MCP** to confirm `buzzr` connected and exposed 11
tools. See [Cursor's MCP documentation](https://cursor.com/docs/context/mcp) if
your installed Cursor version presents a different settings location.

### Codex

The Codex CLI, IDE extension, and app share `config.toml`. The one-command user
setup is:

```sh
codex mcp add buzzr -- npx -y @buzzr/mcp@<published-version>
```

Or add the equivalent block to `~/.codex/config.toml` for all projects, or to a
trusted repository's `.codex/config.toml` for that project only:

```toml
[mcp_servers.buzzr]
command = "npx"
args = ["-y", "@buzzr/mcp@<published-version>"]
```

Run `codex mcp get buzzr`, then start a new Codex task after changing the
configuration.

### Generic stdio MCP client

Use this process configuration in any client that accepts a command plus args:

```json
{
  "name": "buzzr",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@buzzr/mcp@<published-version>"],
  "env": {}
}
```

Treat stdout as JSON-RPC only, read diagnostics from stderr, and close the child
process's stdin during shutdown. The client must perform the MCP lifecycle below;
starting `npx` in a terminal and seeing it remain open is normal for a stdio
server waiting for a client.

## Initialization and capability discovery

The client sends `initialize` first. Verify the `serverInfo.name` field is
`"buzzr"`, the `serverInfo.version` field is the installed package version, and
the response has a `capabilities.tools` object. Send
`notifications/initialized`, then call `tools/list`. The server returns the 11
tools in the catalog below with their input schemas. It does not advertise data
fetching, resources, or prompts.

[`examples/mcp-calls.json`](examples/mcp-calls.json) is a machine-readable JSON-RPC
transcript with the initialization expectation, exact tool discovery order, and
a safe `list_book_policies` → `validate_dfs_entry` → `grade_dfs_entry` workflow.
The repository replays that workflow through a real MCP client in CI.

## Startup troubleshooting

1. Confirm Node.js 22+ and npm are visible to the same desktop process or shell:
   `node --version`, `npm --version`, and `npx --version`.
2. Confirm the pinned release exists with
   `npm view @buzzr/mcp@<published-version> version`, then run
   `npm cache verify`. If npm reports cache corruption, repair npm's cache before
   retrying; `npm cache clean --force` is a last resort because it removes the
   whole local cache.
3. GUI apps may inherit a smaller `PATH` than an interactive shell. On macOS or
   Linux, run `command -v npx`; on Windows, run `where.exe npx`. If the client
   cannot find `npx`, use that absolute path as `command` (normally `npx.cmd` on
   Windows) or launch the client from an environment where Node is on `PATH`.
4. Keep logs off stdout. A healthy manual start writes a `listening on stdio`
   diagnostic to stderr and waits for JSON-RPC input.
5. After any config, Node, PATH, or package-version change, fully quit and restart
   Claude Desktop, Claude Code, Cursor, or Codex. Opening only another chat tab
   may leave the old MCP child process and cached tool catalog in place.

## Tool catalog

| Tool                    | Engine                      | What it does                                                                                                                               |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `grade_dfs_entry`       | @buzzr/dfs-engine           | Settle one 1–12-leg entry and return the full result plus explanation.                                                                      |
| `grade_dfs_entries`     | @buzzr/dfs-engine           | Settle 1–50 entries, up to 600 total legs, with bounded concurrency and isolated failures.                                                   |
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
npx skills@1.5.17 add https://github.com/Buzzr-app/dfs-engine --skill buzzr-sports-engine --agent codex --yes --copy
```

Repository contributors can prove the same one-command install without using a
published branch: `npx skills@1.5.17 add . --skill buzzr-sports-engine --agent
codex --yes --copy`. `npm run check:skill` runs the official pinned
`quick_validate.py`, performs that local install in an isolated temporary
project, and verifies every installed skill file byte-for-byte.

## Compatibility

- Node.js >= 22
- `rank_games` requires `@buzzr/entertainment-engine` >= 5.0.0. Against an older
  engine build the tool degrades gracefully with an `engine_capability_missing`
  error result instead of crashing the server.

## License

MIT
