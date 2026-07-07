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

Player ruled out? PrizePicks drops the leg and RECALCULATES your multiplier. Exact-line push? Depends on the play type. Stat correction 36h later? Re-grade window varies by league.

These rules move real money. `if` statements don't scale to that.

**3/**
So in @buzzr/dfs-engine, book rules are DATA, not code:

- defineBookPolicy → play types, payout tables, DNP/push/rescue rules
- versioned + source-cited
- validated at definition time (v5)

When a user disputes a grade, you can prove exactly which rules ran.

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

Replay them in your CI → prove your integration grades identically to production.

**7/**
v5.0.0 just shipped across the family:

- settleEntries: batch settlement w/ memoized stat cache
- book-policy validation
- @buzzr/bets-core: parlay math, EV, Kelly staking, CLV
- @buzzr/entertainment-engine: calibrated ML + game recommendations
- NEW @buzzr/mcp: the engines as MCP tools for AI agents

**8/**
That last one matters: point your agent at `npx -y @buzzr/mcp` and it prices parlays and settles entries with book-accurate math instead of hallucinating payouts.

**9/**
All MIT, Node ≥22, ESM+CJS, typed to the teeth. Built by one person, running in production in the Buzzr app.

⭐ github.com/Buzzr-app/dfs-engine
📚 buzzr-app.github.io/dfs-engine
📦 npmjs.com/package/@buzzr/dfs-engine

Questions about settlement edge cases welcome — the DNP matrix is cursed.

## Standalone short post (alternative, single tweet)

I open-sourced my sports app's money-grading code: a zero-dependency TypeScript DFS settlement engine with declarative book policies, boundary-validated stat providers, audit trails on every result, and published conformance vectors. v5 adds batch settlement + an MCP server for AI agents. github.com/Buzzr-app/dfs-engine
