# Reddit post drafts

> Status: DRAFTS — maintainer posts manually. Read each subreddit's self-promo rules first (r/sportsbook is strict; lead with usefulness, not the repo). Space posts days apart; don't cross-post identical text.

---

## r/algobetting

**Title:** Open-sourced the settlement + odds-math engines from my sports app (pure TypeScript, zero deps)

**Body:**

I've been building a sports app for a while and ended up extracting the "math that has to be right" into open-source TypeScript packages. Sharing here because this sub is the audience that would actually stress-test it.

What's in it:

- `@buzzr/dfs-engine` — grades DFS pick'em entries with declarative compatibility or custom policies: effective-dated payout tables, explicit DNP/push/tie inputs, validation, and boosts. Every settlement returns an audit trail, source metadata, verification status, and provider provenance. PrizePicks is experimental/partial; Underdog is experimental/unverified; the displayed entry terms remain authoritative.
- `@buzzr/bets-core` — the odds toolbox: implied probability, no-vig fair lines from a two-way market, parlay pricing (`combineAmericanOdds`, fair-value vs offered), EV per bet, fractional Kelly staking, closing-line value, and bankroll analytics (period rollups, drawdown, streaks).
- Engine regression fixtures as a separate package — if you wire your own data pipeline, you can detect drift from the matching engine version. They do not certify operator behavior.

Design constraints: pure functions only, zero runtime dependencies, the engine never fetches — you inject your stat source and it validates rows at the boundary.

It's all MIT. The Buzzr mobile release branch currently vendors the 5.0.0 tarballs for three engine packages; this public vNext is a separate release until the app is deliberately upgraded. Repo: https://github.com/Buzzr-app/dfs-engine — would genuinely value this sub picking holes in the Kelly/CLV implementations.

---

## r/typescript

**Title:** Lessons from building a zero-dependency monorepo where the output is "money decisions" (DFS settlement engine, vNext)

**Body:**

I maintain a family of pure-TypeScript packages that grade DFS entries and price bets, and the domain forced some design decisions this sub might find interesting:

1. **Result types over throws for explainability.** Grading functions have `*Explained` variants returning typed `{ ok, value | failure }` results with machine-readable failure reasons, because "why did this leg not grade" is a support question, not an exception.
2. **Policies as data.** Book behavior (payout tables, DNP rules, push handling) is a validated, versioned object — `defineBookPolicy` — not subclasses. Runtime validation of policy definitions shipped in v5 (`validateBookPolicyDefinition`) because a malformed policy is worse than a crash.
3. **Canonical shapes as frozen contracts.** All stat rows normalize to one `PlayerGameLogEntryShape`; vendor adapters (ESPN/Sportradar-shaped) map into it at the boundary, and the engine validates every row a provider returns.
4. **Regression vectors as a published package.** Versioned engine fixtures ship on npm so integrators' CI can detect drift from the matching library behavior — without claiming official operator equivalence.
5. **Zero runtime deps, ESM+CJS+d.ts via tsup**, strict tsconfig, Node >= 22.

Repo (MIT): https://github.com/Buzzr-app/dfs-engine — happy to go deeper on any of the patterns.

---

## r/sportsbook

> NOTE: r/sportsbook removes most self-promotion. Prefer answering an existing "how do books grade X" / "how do I track CLV" thread and linking the specific function, or posting in the weekly discussion thread. If posting standalone:

**Title:** Free open-source tools: no-vig fair lines, parlay EV, Kelly staking, CLV tracking

**Body:**

I open-sourced the math library my app uses for bet tracking, in case anyone here builds their own spreadsheets/tools: no-vig fair line from any two-way market, parlay fair value vs offered odds, per-bet EV, fractional Kelly stake sizing, and closing-line value. It also has an independent DFS compatibility grader with audit trails. Its PrizePicks profile is experimental/partial and its Underdog profile is experimental/unverified, so your displayed entry terms and operator ruling stay authoritative. All free, MIT, no signup — it's a code library, so some technical comfort is needed: https://github.com/Buzzr-app/dfs-engine
