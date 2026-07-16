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
- Versioned engine regression fixtures ship as their own package, so an external integrator can detect drift from the matching engine behavior. They are not operator certification.

The vNext release adds effective-dated policy provenance, adversarial regression vectors, bounded public contracts, and a repository-owned Codex skill. There is also an odds-math package (no-vig fair lines, parlay pricing, EV, Kelly, CLV), an entertainment-scoring engine, and an 11-tool MCP server so AI agents can call deterministic math from supplied data.

The Buzzr mobile app's `release/ios-2.0.0` branch currently vendors 5.0.0 tarballs for the DFS, odds, and entertainment engines. The app is not automatically upgraded to this public vNext work.

Repo: https://github.com/Buzzr-app/dfs-engine
Docs: https://buzzr-app.github.io/dfs-engine/
npm: https://www.npmjs.com/package/@buzzr/dfs-engine

Happy to answer questions about settlement edge cases — the DNP/rescue matrix across books is weirder than you'd expect.

## First-comment notes (post as a comment right after submitting)

- Why zero dependencies: settlement code is audit-surface; every dep is something a money-grading pipeline has to trust.
- Why "engine + injected providers": books/apps have wildly different data sources; the engine validates rows at the boundary and refuses malformed data (`invalid_provider_data`) instead of mis-grading.
- Honest limitations: PrizePicks is an experimental/partial compatibility profile; Underdog is experimental/unverified; displayed entry terms and operator rulings remain authoritative. Draft fixtures are non-executable, and provider packages are contracts, not API clients — you bring the fetch.
