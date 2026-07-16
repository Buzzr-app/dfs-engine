# @buzzr/mcp

## 5.1.0

### Minor Changes

- 5be07fa: Expand to eleven bounded tools with batch DFS settlement, closing-line value, bet-history analytics, authoritative policy discovery, portable bins, published examples, real-client proofs, and hardened packed/published startup and validation.

### Patch Changes

- Updated dependencies [5be07fa]
  - @buzzr/dfs-engine@5.1.0

### Added

- Expanded the catalog to 11 tools with batch DFS settlement, closing-line
  value, and bounded bet-history summaries.
- Added authoritative policy snapshots with executable flags, verification
  metadata, source references, and complete play-type definitions.

### Security and correctness

- Bounded input frames, payloads, identifiers, arrays, concurrency, error detail,
  and serialized results; public runtime errors no longer expose internals.
- Kept draft policy fixtures metadata-only and non-executable.
- Unified real-client and direct-handler tool validation behind bounded
  `invalid_input` results so SDK validation cannot amplify adversarial errors.
- Oversized stdio frames now close the server and terminate with an error even
  when a misbehaving client keeps its stdin pipe open.

### Documentation

- Labeled PrizePicks experimental/partial and Underdog
  experimental/unverified, with displayed entry terms authoritative.

## 5.0.0

### Major Changes

- Published the first synchronized Buzzr MCP server with eight DFS settlement,
  odds, Kelly, parlay, prediction, and ranking tools over local stdio transport.
- Pinned the v5 Buzzr engine family and exposed the `buzzr-mcp` executable.
