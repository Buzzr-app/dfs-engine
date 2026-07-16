# @buzzr/mcp

## Unreleased (vNext)

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

### Documentation

- Labeled PrizePicks experimental/partial and Underdog
  experimental/unverified, with displayed entry terms authoritative.
