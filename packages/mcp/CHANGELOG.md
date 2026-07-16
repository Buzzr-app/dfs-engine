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
- Documented the real-client JSON-RPC `-32602` schema failure separately from
  direct-handler `invalid_input` results.

### Documentation

- Labeled PrizePicks experimental/partial and Underdog
  experimental/unverified, with displayed entry terms authoritative.

