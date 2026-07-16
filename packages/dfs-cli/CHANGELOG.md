# @buzzr/dfs-cli

## 5.0.1

### Patch Changes

- 5be07fa: Start the installed `dfs-grade` executable correctly through npm bin symlinks and publish corrected policy-verification and regression-fixture guidance.
- Updated dependencies [5be07fa]
  - @buzzr/dfs-engine@5.1.0

## 5.0.0

### Major Changes

- Synchronized the CLI with the public v5 package train and moved its engine
  dependency to `@buzzr/dfs-engine@^5.0.0` while preserving the `dfs-grade`
  command and programmatic API.

## 1.0.0

### Major Changes

- Graduate v4-aligned companion packages to 1.0.0: CLI wrapper, Sportradar stat-provider adapter, framework-agnostic display helpers, and canonical settlement test vectors. All four ship pinned against `@buzzr/dfs-engine@^4.0.0` and follow Settlement OS v4 strict contracts.

### Patch Changes

- Updated dependencies [07fc4c7]
  - @buzzr/dfs-engine@4.0.0
