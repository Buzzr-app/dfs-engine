# Buzzr MCP tool reference

The local `@buzzr/mcp` server exposes 11 tools. It performs deterministic computation only; it does not fetch live odds, box scores, operator accounts, or private user data.

| Tool | Use | Principal limits |
| --- | --- | --- |
| `grade_dfs_entry` | Settle one DFS pick-em entry | 1–12 unique legs |
| `grade_dfs_entries` | Settle a batch with isolated failures | 1–50 entries, 12 legs each, 600 total legs, concurrency 1–8 |
| `validate_dfs_entry` | Validate a candidate engine entry without settlement | 64 KiB JSON, 1,000 top-level fields |
| `list_book_policies` | Inspect executable compatibility profiles and non-executable drafts | No input |
| `fair_line` | Remove vig from a two-way market | Both American prices required |
| `closing_line_value` | Compare placed and closing implied probability | Same selection at both timestamps |
| `parlay_value` | Price independent parlay legs and optional EV | 1–50 legs |
| `kelly_stake` | Calculate full and fractional Kelly | Probability strictly between 0 and 1 |
| `summarize_bet_history` | Return rollup, UTC periods, drawdown, and streaks | Up to 500 unique bet IDs |
| `predict_game_buzz` | Score one game's entertainment value | Scheduled or final games |
| `rank_games` | Rank games for a taste profile | 1–100 games; optional top-N limit |

American odds must be within `[-100000, -100]` or `[100, 100000]`. Tool strings, identifiers, lists, input frames, concurrent calls, and serialized output are bounded.

## DFS result reading order

1. `validation`: structural errors and compatibility-profile warnings.
2. `status`, `multiplier`, and `payout`: the engine outcome.
3. `legs`: observed value, decision, pending reason, and provider provenance.
4. `pendingReasons`: evidence still needed before settlement.
5. `policyVersion`, `payoutTable`, and `sourceRefs`: effective-dated rule metadata.
6. `confidence` and `explanationCodes`: limitations and machine-readable rationale.
7. `auditTrail`: ordered settlement decisions.

`grade_dfs_entries`, `closing_line_value`, and `summarize_bet_history` use string `contractVersion: "1"`. Batch results preserve input order; inspect the separate failures array as well as summary counts.

## Failure contracts

- Invalid tool arguments return an `invalid_input` error result with bounded issue details through a real MCP client or a direct handler.
- Malformed JSON-RPC envelopes remain protocol errors owned by the MCP SDK.
- `server_busy`, `result_too_large`, `tool_execution_failed`, and `entry_settlement_failed` are intentionally generic public failures.
- An oversized or incomplete stdio frame is rejected without entering a tool handler.
