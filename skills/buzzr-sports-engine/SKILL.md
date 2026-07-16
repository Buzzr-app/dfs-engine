---
name: buzzr-sports-engine
description: Use Buzzr's local MCP server and TypeScript packages for deterministic sportsbook odds math, DFS pick-em validation and settlement, bet-history analytics, and game-entertainment scoring. Trigger for American-odds fair lines, parlays, EV or Kelly questions; PrizePicks- or Underdog-style entry grading; batch DFS audits; closing-line value; bet-history summaries; or game buzz and personalized ranking. Do not use it to fetch live lines, account data, official operator rulings, or financial advice.
---

# Buzzr Sports Engine

Use Buzzr when the user needs auditable sports math instead of an estimated calculation. Prefer the MCP server for interactive analysis and the `@buzzr/*` packages for application code, custom policies, provider adapters, or high-volume pipelines.

## Route the request

1. Identify the domain:
   - DFS settlement: `list_book_policies`, `validate_dfs_entry`, `grade_dfs_entry`, or `grade_dfs_entries`.
   - Odds and bankroll math: `fair_line`, `closing_line_value`, `parlay_value`, or `kelly_stake`.
   - Historical analysis: `summarize_bet_history`.
   - Entertainment scoring: `predict_game_buzz` or `rank_games`.
2. Use the MCP tools when they are available in the current session.
3. If the tools are unavailable, help configure the local server or use the matching npm package in code. Do not imitate a tool result and present it as engine output.
4. Read [references/mcp-tools.md](references/mcp-tools.md) for the 11-tool catalog, limits, and response contracts.
5. Before any operator-specific DFS conclusion, follow [references/operator-safety.md](references/operator-safety.md).

## Configure the local MCP server

For repeatable work, pin the reviewed published version:

```toml
[mcp_servers.buzzr]
command = "npx"
args = ["-y", "@buzzr/mcp@<published-version>"]
```

Use `@buzzr/mcp@latest` only when automatic upgrades are acceptable. The server uses stdio, writes protocol messages only to stdout, and needs no API key. Restart the client after changing its MCP configuration.

If startup fails, check these in order:

1. Node.js is version 22 or newer.
2. The package version exists: `npm view @buzzr/mcp@<published-version> version`.
3. The executable starts cleanly: `npx -y @buzzr/mcp@<published-version>`.
4. The client launches the command directly rather than through an interactive shell.

## Settle DFS entries

Call `list_book_policies` before grading. Use only a policy/play type reported as `executable: true`. A draft fixture is documentation, not a grading implementation.

Supply the slip's own `bookId`, `playTypeId`, `displayedMultiplier`, stake, placed timestamp, and leg details. Supply observed stats as `actual` or `actualsByLegId`; the MCP server does not fetch box scores. Mark DNP, void, or other operator rulings explicitly when known.

Run `validate_dfs_entry` before grading untrusted or generated JSON. For one entry, call `grade_dfs_entry`. For 2–50 entries, call `grade_dfs_entries` and inspect both `results` and `failures`. A batch may contain at most 600 total legs.

In the answer, surface:

- entry status and payout;
- per-leg decisions and pending reasons;
- policy version, selected payout-table metadata, confidence, and source references;
- validation warnings and explanation codes;
- any gap between the slip's displayed terms and the compatibility profile.

Never turn a `pending`, low-confidence, experimental, or unverified result into a definitive operator ruling.

## Calculate odds and performance

American odds inputs must be at most `-100` or at least `+100`, with magnitude no greater than `100000`.

- Use `fair_line` only with both sides of the same two-way market.
- Use `closing_line_value` to compare the placed and closing prices for the same selection.
- Use `parlay_value` only when every leg includes selected and opposite prices. Explain that the calculation assumes independent legs unless the caller models correlation separately.
- Use `kelly_stake` only with a user-supplied win probability. Identify the fraction used and avoid framing the result as a recommendation to wager.
- Use `summarize_bet_history` for up to 500 normalized bet records. Its day/week/month buckets are UTC.

## Score and rank games

Use `predict_game_buzz` for one scheduled or final game. State which optional inputs were present because confidence changes with odds, injuries, team power, engagement, search heat, and star power.

Use `rank_games` for 1–100 games and a bounded taste profile. Treat the output as an entertainment ranking, not a forecast of the game result.

## Use the packages in code

Reach for the package surface when the user is building software:

- `@buzzr/dfs-engine` for policies, payout tables, providers, settlement, and audit trails;
- `@buzzr/bets-core` for odds and bet-history math;
- `@buzzr/entertainment-engine` for buzz predictions and recommendations;
- `@buzzr/dfs-engine-test-vectors` for engine regression fixtures;
- `@buzzr/dfs-testkit` for custom test fixtures.

Keep operator rules as effective-dated data, preserve source metadata, validate inputs at boundaries, and pin related `@buzzr/*` package versions together. Published test vectors prove compatibility with the named engine version, not official operator conformance.

## Report errors honestly

Invalid tool arguments return a structured, bounded `invalid_input` result through MCP transports and direct handlers. Malformed JSON-RPC envelopes remain protocol errors. Other public errors are intentionally generic; do not infer internal details.

If the tool is unavailable, input is missing, a policy is non-executable, or settlement remains pending, say exactly that and ask only for the missing evidence needed to proceed.
