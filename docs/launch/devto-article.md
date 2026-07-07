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

Everything, it turns out. This article is about the architecture that replaced it: [`@buzzr/dfs-engine`](https://github.com/Buzzr-app/dfs-engine), a zero-dependency TypeScript settlement engine that now runs in production, and the design decisions that made it auditable rather than merely correct.

## Why settlement is harder than a comparison

A pick'em entry seems trivial to grade until real slates happen:

- A player is ruled out pregame. PrizePicks doesn't void the slip — it removes the leg and **recalculates the multiplier** for the remaining legs. Underdog's rules differ.
- A player exits mid-game with 3 points on an o2.5 that already cleared. Is that a DNP or a win? Depends on the book and whether the stat was already banked.
- The line is 26.0 and the player scores exactly 26. Push rules vary by book and play type.
- A stat correction lands 36 hours after the game. Some leagues get corrections for days; you need a re-grade window per league.
- The slip has a "boost" multiplier that only applies to part of the payout, splitting withdrawable winnings from bonus balance.

Each of these is a rule that pays or withholds real money. Encoding them as nested `if`s scattered across an app is how you end up unable to answer the only question that matters when a user disputes a grade: **"why did the engine decide this?"**

## Decision 1: book rules are data, not code

The core abstraction is the **book policy** — a declarative, versioned object describing how one book settles one family of play types:

```ts
const policy = defineBookPolicy({
  bookId: 'prizepicks',
  playTypes: [
    {
      playTypeId: 'power',
      payoutModel: 'fixed_table',
      payoutTable: [
        /* legs → multiplier */
      ],
      dnpPolicy: 'rescue_recalculate', // drop leg, recompute multiplier
      pushPolicy: 'reduce_legs',
      // ...
    },
  ],
  sourceRefs: [{ label: 'PrizePicks payout and settlement compatibility profile' }],
});
```

Policies are registered per engine instance (no global mutable registry), carry a `policyVersion`, and cite `sourceRefs` — so every settlement result can state *which rules, which version, based on what documentation* graded the slip. When a book changes its payout table, that's a new policy version, not a code archaeology expedition.

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

1. **Zero runtime dependencies.** Settlement code is audit surface; every dependency is something a money-grading pipeline has to trust. The published packages depend on nothing outside the family.
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

## Decision 4: conformance is a published package

The monorepo publishes its golden fixtures as [`@buzzr/dfs-engine-test-vectors`](https://www.npmjs.com/package/@buzzr/dfs-engine-test-vectors): verified `{ entry, gameLogsByLegId, expected }` triples. An integrator who wires their own stat pipeline replays the vectors in CI and proves their setup grades identically to production:

```ts
for (const v of TEST_VECTORS) {
  const result = await engine.settleEntry(v.entry, { statProviderId: 'mine' });
  expect(result.status).toBe(v.expected.status);
}
```

This converted a class of "works on my data" bug reports into a failing test on the integrator's side. It also acts as a behavioral ratchet on the engine itself: any change that flips a vector is by definition a breaking change, no debate needed.

## Decision 5 (v5): batch settlement without breaking purity

Settling a slate one entry at a time re-fetches the same boxscores constantly — hundreds of entries on a game night share a handful of players. v5's `settleEntries` wraps the unchanged per-entry path with a per-call memoized stat cache keyed on `(player, game, league)`:

```ts
const batch = await engine.settleEntries(entries, {
  statProviderId: 'my-stats',
  concurrency: 4,
});
// batch.summary: { total, settled, pending, failed }
// batch.cacheStats: { providerCalls, cacheHits }
```

Two details I care about: in-flight **promises** are memoized (not just resolved values), so cache dedup holds at any concurrency; and the cache lives only for the call — no global state, purity preserved. One failed entry doesn't abort the batch; failures come back indexed in the result.

## What I'd tell you to steal

If you're building anything that turns data into money decisions:

1. Make the rules **data** — versioned, validated, citable.
2. Make I/O someone else's job and **validate at the boundary**.
3. Return explanations as **typed values**; a settlement should be able to testify.
4. Publish your **golden fixtures**; conformance beats documentation.
5. Zero dependencies is a feature you can only choose early.

Everything above is MIT and on npm — the engine ([`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)), odds math ([`@buzzr/bets-core`](https://www.npmjs.com/package/@buzzr/bets-core)), entertainment scoring ([`@buzzr/entertainment-engine`](https://www.npmjs.com/package/@buzzr/entertainment-engine)), an MCP server for AI agents ([`@buzzr/mcp`](https://www.npmjs.com/package/@buzzr/mcp)), plus CLI/testing/UI satellites. Monorepo and docs: https://github.com/Buzzr-app/dfs-engine · https://buzzr-app.github.io/dfs-engine/

I'm one person building this for a production app, so issues and hostile code review are genuinely welcome.
