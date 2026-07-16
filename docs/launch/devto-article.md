# dev.to article draft

> Status: DRAFT — maintainer publishes manually on dev.to (canonical) and can cross-post to Hashnode/Medium with `canonical_url` set. Suggested tags: `typescript`, `opensource`, `architecture`, `node`.

---

title: Building an auditable DFS settlement engine in pure TypeScript
published: false
tags: typescript, opensource, architecture, node
canonical_url:

---

Two years ago I shipped a sports app with a feature that grades DFS pick'em slips — entries like "Tatum over 26.5 points + Jokić over 11.5 rebounds, $10 at 3x." The first version was exactly what you'd write on day one:

```ts
const won = actual > line; // what could go wrong
```

Everything, it turns out. This article is about the architecture that replaced it: [`@buzzr/dfs-engine`](https://github.com/Buzzr-app/dfs-engine), a zero-dependency TypeScript settlement engine, and the design decisions that made it auditable rather than merely correct. The Buzzr mobile app currently vendors the 5.0.0 tarballs for three engine packages; the public repository's vNext work is not automatically deployed to the app.

## Why settlement is harder than a comparison

A pick'em entry seems trivial to grade until real slates happen:

- A player is ruled out pregame. Does the entry remove the leg, reprice, reboot, or void? The answer depends on the displayed entry terms and the operator's current ruling.
- A player exits mid-game with 3 points on an o2.5 that already cleared. Is that a DNP or a win? Depends on the book and whether the stat was already banked.
- The line is 26.0 and the player scores exactly 26. Push rules vary by book and play type.
- A stat correction lands 36 hours after the game. Some leagues get corrections for days; you need a re-grade window per league.
- The slip has a "boost" multiplier that only applies to part of the payout, splitting withdrawable winnings from bonus balance.

Each of these is a rule that pays or withholds real money. Encoding them as nested `if`s scattered across an app is how you end up unable to answer the only question that matters when a user disputes a grade: **"why did the engine decide this?"**

## Decision 1: book rules are data, not code

The core abstraction is the **book policy** — a declarative, versioned object describing how one book settles one family of play types:

```ts
const policy = defineBookPolicy({
  id: 'my-book',
  displayName: 'My Book',
  version: '2026-07',
  effectiveFrom: '2026-07-01',
  status: 'experimental',
  verification: { status: 'partial', reviewedAt: '2026-07-16' },
  sources: [{ label: 'Rules page', url: 'https://example.com/rules' }],
  playTypes: [
    {
      id: 'power',
      displayName: 'Power',
      payoutModel: 'fixed-table',
      pickCount: { min: 2, max: 6 },
      allOrNothing: true,
    },
  ],
  tiePolicy: { type: 'push' },
  dnpPolicy: { type: 'remove_leg', voidIfNoSurvivors: true },
  pushPolicy: { type: 'remove_leg', refundIfNoSurvivors: true },
  payoutSplit: { type: 'all_withdrawable' },
  validation: { duplicatePlayers: 'warn' },
});

const table = definePayoutTable({
  bookId: 'my-book',
  playTypeId: 'power',
  version: '2026-07',
  effectiveFrom: '2026-07-01',
  sources: [{ label: 'Rules page', url: 'https://example.com/rules' }],
  entries: [{ pickCount: 2, hits: 2, multiplier: 3 }],
});
```

Policies are registered per engine instance (no global mutable registry), carry a `policyVersion`, and cite `sourceRefs` — so every settlement result can state *which rules, which version, based on what documentation* graded the slip. When a book changes its payout table, that's a new policy version, not a code archaeology expedition.

The bundled operator-named policies are independent compatibility profiles, not official engines. PrizePicks is experimental and partially verified: its standard payout references were reviewed on 2026-07-16 from [Payouts](https://www.prizepicks.com/help-center/payouts) and [Potential Outcomes](https://www.prizepicks.com/help-center/potential-outcomes), but settlement behavior and variable payouts remain incomplete. Underdog is experimental and unverified; the [legal center](https://legal.underdogsports.com/) is only the recorded rules entrypoint. The displayed entry terms remain authoritative.

Because policies are data, they're also validatable: v5 added `validateBookPolicyDefinition`, which rejects malformed policies (impossible payout tables, contradictory DNP rules) at definition time. A typo in a payout table should be a loud error, not a quiet 2% overpayment.

## Decision 2: the engine never fetches

The engine does **zero I/O**. It doesn't know what ESPN is. Consumers inject data sources through a small contract:

```ts
const provider = defineStatProvider({
  id: 'my-stats',
  getGameLog: ({ leg }) => fetchRows(leg.playerId, leg.gameDate),
});

const engine = createDfsEngine({ statProviders: [provider] });
const result = await engine.settleEntry(entry, { statProviderId: 'my-stats' });
```

This bought three things:

1. **Zero runtime dependencies in the settlement engine.** Settlement code is audit surface; every dependency is something a money-grading pipeline has to trust. Boundary packages can still depend on the engine, and the MCP server uses the official MCP SDK plus Zod.
2. **Determinism in tests.** A mock provider is just a map from leg id to boxscore rows.
3. **Boundary validation.** Every row a provider returns is validated against the canonical `PlayerGameLogEntryShape` before grading. Malformed vendor data becomes an explicit `invalid_provider_data` failure instead of `NaN > 26.5 === false` silently grading a leg as lost.

Vendor differences live in thin adapter packages (`@buzzr/dfs-provider-espn`, `@buzzr/dfs-provider-sportradar`) that map vendor shapes into the canonical one. The Sportradar adapter is ~70 lines; that's the point.

## Decision 3: explanations are return values, not logs

Grading functions come in pairs: `gradeLegFromActual` and `gradeLegFromActualExplained`. The explained variants return typed results —

```ts
type LegGradingResult =
  | { ok: true; value: DfsLegDecision }
  | { ok: false; failure: LegGradingFailure }; // machine-readable reason
```

— because "why didn't this leg grade" is a *support workflow*, not an exception. The same philosophy shapes the settlement result itself. Every `settleEntry` call returns, alongside the status and payout:

- `validation` — the boundary-validation report for the input entry
- `provenance` — which provider, what confidence, and the **raw stat rows** each leg was graded from
- `auditTrail` — timestamped, coded steps (`settlement.started`, `settlement.won`, …)
- `explanationCodes` — e.g. `settlement.fixed_table_payout`, so UIs and analysts can filter grading behavior without parsing prose

When a user disputes a slip, the answer is in the settlement object — not in whatever logging happened to be enabled that night.

## Decision 4: regression fixtures are a published package

The monorepo publishes engine regression fixtures as [`@buzzr/dfs-engine-test-vectors`](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors): verified `{ entry, gameLogsByLegId, expected }` triples. An integrator who wires a stat pipeline can replay the vectors in CI and detect drift from the matching engine version:

```ts
for (const v of TEST_VECTORS) {
  const result = await engine.settleEntry(v.entry, { statProviderId: 'mine' });
  expect(result.status).toBe(v.expected.status);
}
```

This converted a class of "works on my data" bug reports into a failing test on the integrator's side. It also acts as a behavioral review gate on the engine itself: any change that flips a vector must be explained and versioned. The fixtures are not proof of current operator behavior.

## Decision 5 (v5): batch settlement without breaking purity

Settling a slate one entry at a time re-fetches the same boxscores constantly — hundreds of entries on a game night share a handful of players. v5's `settleEntries` wraps the unchanged per-entry path with a per-call memoized stat cache keyed on `(player, game, league)`:

```ts
const batch = await engine.settleEntries(entries, {
  statProviderId: 'my-stats',
  concurrency: 4,
});
// batch.summary: { total, settled, pending, failed }
// batch.cache: { providerCalls, cacheHits }
```

Two details I care about: in-flight **promises** are memoized (not just resolved values), so cache dedup holds at any concurrency; and the cache lives only for the call — no global state, purity preserved. One failed entry doesn't abort the batch; failures come back indexed in the result.

## What I'd tell you to steal

If you're building anything that turns data into money decisions:

1. Make the rules **data** — versioned, validated, citable.
2. Make I/O someone else's job and **validate at the boundary**.
3. Return explanations as **typed values**; a settlement should be able to testify.
4. Publish **engine regression fixtures**; executable examples catch integration drift.
5. Zero dependencies is a feature you can only choose early.

Everything above is MIT and on npm — the engine ([`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)), odds math ([`@buzzr/bets-core`](https://www.npmjs.com/package/@buzzr/bets-core)), entertainment scoring ([`@buzzr/entertainment-engine`](https://www.npmjs.com/package/@buzzr/entertainment-engine)), an 11-tool MCP server for AI agents ([`@buzzr/mcp`](https://www.npmjs.com/package/@buzzr/mcp)), plus CLI/testing/UI satellites. The vNext release adds effective-dated policy provenance, adversarial regression vectors, bounded MCP contracts, and a repository-owned Codex skill. Monorepo and docs: https://github.com/Buzzr-app/dfs-engine · https://buzzr-app.github.io/dfs-engine/

I'm one person building this alongside a production app, so issues and hostile code review are genuinely welcome.
