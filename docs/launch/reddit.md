# Reddit post drafts

> Status: DRAFTS — maintainer posts manually. Read each subreddit's self-promo rules first (r/sportsbook is strict; lead with usefulness, not the repo). Space posts days apart; don't cross-post identical text.

---

## r/algobetting

**Title:** Open-sourced the settlement + odds-math engines from my sports app (pure TypeScript, zero deps)

**Body:**

I've been building a sports app for a while and ended up extracting the "math that has to be right" into open-source TypeScript packages. Sharing here because this sub is the audience that would actually stress-test it.

What's in it:

- `@buzzr/dfs-engine` — grades DFS pick'em entries (PrizePicks/Underdog-style) with declarative book policies: payout tables, DNP rescue rules, push/tie handling, boosts. Every settlement returns an audit trail + provenance of the stat rows used, so you can reconstruct exactly why a slip graded the way it did. v5 added batch settlement with a memoized stat cache.
- `@buzzr/bets-core` — the odds toolbox: implied probability, no-vig fair lines from a two-way market, parlay pricing (`combineAmericanOdds`, fair-value vs offered), EV per bet, fractional Kelly staking, closing-line value, and bankroll analytics (period rollups, drawdown, streaks).
- Golden test vectors as a separate package — if you wire your own data pipeline, you can prove your grading matches production output.

Design constraints: pure functions only, zero runtime dependencies, the engine never fetches — you inject your stat source and it validates rows at the boundary.

It's all MIT, runs in production in my app. Repo: https://github.com/Buzzr-app/dfs-engine — would genuinely value this sub picking holes in the Kelly/CLV implementations.

---

## r/typescript

**Title:** Lessons from building a zero-dependency monorepo where the output is "money decisions" (DFS settlement engine, v5)

**Body:**

I maintain a family of pure-TypeScript packages that grade DFS entries and price bets, and the domain forced some design decisions this sub might find interesting:

1. **Result types over throws for explainability.** Grading functions have `*Explained` variants returning typed `{ ok, value | failure }` results with machine-readable failure reasons, because "why did this leg not grade" is a support question, not an exception.
2. **Policies as data.** Book behavior (payout tables, DNP rules, push handling) is a validated, versioned object — `defineBookPolicy` — not subclasses. Runtime validation of policy definitions shipped in v5 (`validateBookPolicyDefinition`) because a malformed policy is worse than a crash.
3. **Canonical shapes as frozen contracts.** All stat rows normalize to one `PlayerGameLogEntryShape`; vendor adapters (ESPN/Sportradar-shaped) map into it at the boundary, and the engine validates every row a provider returns.
4. **Golden vectors as a published package.** Conformance fixtures ship on npm so integrators' CI can prove behavioral compatibility — massively reduces "works on my data" bug reports.
5. **Zero runtime deps, ESM+CJS+d.ts via tsup**, strict tsconfig, Node >= 22.

Repo (MIT): https://github.com/Buzzr-app/dfs-engine — happy to go deeper on any of the patterns.

---

## r/sportsbook

> NOTE: r/sportsbook removes most self-promotion. Prefer answering an existing "how do books grade X" / "how do I track CLV" thread and linking the specific function, or posting in the weekly discussion thread. If posting standalone:

**Title:** Free open-source tools: no-vig fair lines, parlay EV, Kelly staking, CLV tracking

**Body:**

I open-sourced the math library my app uses for bet tracking, in case anyone here builds their own spreadsheets/tools: no-vig fair line from any two-way market, parlay fair value vs offered odds, per-bet EV, fractional Kelly stake sizing, and closing-line value. Also a DFS pick'em grader that mirrors PrizePicks/Underdog settlement rules (DNPs, pushes, boosts) if you want to audit how your slips settle. All free, MIT, no signup — it's a code library, so some technical comfort needed: https://github.com/Buzzr-app/dfs-engine
