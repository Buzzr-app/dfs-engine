# X/Twitter thread draft

> Status: DRAFT — maintainer posts manually. Attach a screenshot/GIF of `dfs-grade` output or the audit trail JSON to tweet 1 (posts with visuals travel further). Pin the thread after posting.

## Thread

**1/**
Grading a DFS slip looks like one line of code:

`actual > line`

It isn't. I open-sourced the settlement engine from my sports app — pure TypeScript, zero dependencies, and every decision comes with an audit trail.

github.com/Buzzr-app/dfs-engine 🧵

**2/**
The problem: every book settles differently.

Player ruled out? Does the entry remove the leg, reboot it, reprice, or void? Exact-line push? Which displayed terms apply? Stat correction 36h later? What is the re-grade window?

These rules move real money. `if` statements don't scale to that.

**3/**
So in @buzzr/dfs-engine, book rules are DATA, not code:

- defineBookPolicy → play types, payout tables, DNP/push/rescue rules
- versioned + source-cited
- validated at definition time (v5)

When a user disputes a grade, you can show exactly which compatibility or custom policy ran. PrizePicks is experimental/partial; Underdog is experimental/unverified. The displayed entry still controls.

**4/**
The engine does zero I/O. You inject a StatProvider; it validates every row at the boundary.

Malformed vendor data → explicit `invalid_provider_data` failure.
Not `NaN > 26.5` silently grading a leg as lost.

**5/**
Every settlement returns:

✅ status + payout split
📜 audit trail (timestamped, coded steps)
🔍 provenance — the raw stat rows each leg was graded from
🧾 machine-readable explanation codes

The result object can testify.

**6/**
And you don't have to trust me: golden fixtures ship as their own npm package (@buzzr/dfs-engine-test-vectors).

Replay them in your CI → detect drift from the matching engine version.

They are regression fixtures, not official operator certification.

**7/**
The 5.1.0 public-toolkit release includes:

- settleEntries: batch settlement w/ memoized stat cache
- book-policy validation
- @buzzr/bets-core: parlay math, EV, Kelly staking, CLV
- @buzzr/entertainment-engine: calibrated ML + game recommendations
- @buzzr/mcp: 11 bounded tools for AI agents
- effective-dated policy sources + verification metadata
- a repository-owned Codex skill

**8/**
That last one matters: point your agent at `npx -y @buzzr/mcp` and it runs deterministic odds, history, DFS compatibility, and game-scoring math on supplied data. It does not fetch live odds, box scores, or operator rulings.

**9/**
All MIT, Node ≥22, ESM+CJS, typed to the teeth. Built by one person. Buzzr's mobile release branch currently vendors the three 5.0.0 engine tarballs; the public 5.1.0 toolkit is not an automatic app upgrade.

⭐ github.com/Buzzr-app/dfs-engine
📚 buzzr-app.github.io/dfs-engine
📦 npmjs.com/package/@buzzr/dfs-engine

Questions about settlement edge cases welcome — the DNP matrix is cursed.

## Standalone short post (alternative, single tweet)

I open-sourced my sports app's settlement core: a zero-dependency TypeScript DFS engine with declarative compatibility policies, boundary-validated stat providers, audit trails, versioned regression fixtures, and an 11-tool MCP server. Operator-named profiles disclose verification limits. github.com/Buzzr-app/dfs-engine
