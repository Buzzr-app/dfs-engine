# Show HN draft

> Status: DRAFT — maintainer posts manually from their own HN account. Post the text below as-is or trimmed; HN culture rewards plain, first-person, honest framing. Best window: Tue–Thu, 8–10am ET.

## Title

Show HN: Auditable DFS settlement engine in pure TypeScript (zero dependencies)

(alternate: "Show HN: I extracted my sports app's money-grading code into open-source TypeScript engines")

## URL

https://github.com/Buzzr-app/dfs-engine

## Body

I build Buzzr, a sports social app. Part of it grades DFS pick'em slips (PrizePicks/Underdog-style entries: "Tatum over 26.5 points" × N legs), and I learned the hard way that settling money on `if (points > line)` is how you end up in support-ticket hell: DNP rescues, mid-game exits, pushes on exact lines, boosted multipliers, stat corrections landing two days later — every book handles these differently.

So I extracted the settlement code into open-source packages and made "explain yourself" the core design constraint:

- Book rules are data, not code: a `DfsBookPolicy` declares play types, payout tables, DNP/push/tie/rescue behavior, and is versioned so you can prove which rules graded a slip.
- Every settlement returns a full audit trail, provider provenance (which stat source, what raw row), a validation report, and machine-readable explanation codes.
- The engine does zero I/O. You inject a `StatProvider`; pure functions do the rest. Zero runtime dependencies, ESM+CJS, strict types.
- Golden test vectors ship as their own package, so an external integrator can prove their wiring grades identically to production.

v5.0.0 just landed: batch settlement with a memoized per-call stat cache, book-policy validation, and a draft prediction-market policy. There's also an odds-math package (no-vig fair lines, parlay pricing, EV, Kelly, CLV), an entertainment-scoring engine, and an MCP server so AI agents can call the real math instead of hallucinating payouts.

Everything runs in production in the Buzzr app; the app is the first consumer of every release.

Repo: https://github.com/Buzzr-app/dfs-engine
Docs: https://buzzr-app.github.io/dfs-engine/
npm: https://www.npmjs.com/package/@buzzr/dfs-engine

Happy to answer questions about settlement edge cases — the DNP/rescue matrix across books is weirder than you'd expect.

## First-comment notes (post as a comment right after submitting)

- Why zero dependencies: settlement code is audit-surface; every dep is something a money-grading pipeline has to trust.
- Why "engine + injected providers": books/apps have wildly different data sources; the engine validates rows at the boundary and refuses malformed data (`invalid_provider_data`) instead of mis-grading.
- Honest limitations: built-in policies cover PrizePicks/Underdog-style play types; prediction-market policy is a draft; provider packages are contracts, not API clients — you bring the fetch.
