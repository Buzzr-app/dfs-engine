# @buzzr/dfs-engine-test-vectors

## 5.1.0

### Minor Changes

- 5be07fa: Expand the public regression set from three happy paths to eleven version-matched fixtures covering policy evidence, payout tables, DNPs, pushes, missing and unsupported stats, ambiguous provider rows, warnings, provenance, and audit codes.

### Patch Changes

- Updated dependencies [5be07fa]
  - @buzzr/dfs-engine@5.1.0

### Details

- Expanded the public regression set from three happy paths to eleven fixtures,
  including all-push, explicit-DNP repricing, missing-vs-unsupported stats,
  duplicate-player warnings, wrong-date and ambiguous provider rows, and the
  PrizePicks standard three-pick table effective 2026-07-02.
- Pinned full top-level settlement behavior: payout, effective policy/table,
  verification, confidence, validation, sources, provenance, explanations, audit
  codes, pending reasons, and per-leg provider detail.

### Documentation

- Define the package as engine regression fixtures for the matching engine
  version, not proof of current operator rules or official operator equivalence.

## 5.0.0

### Major Changes

- Synchronized with `@buzzr/dfs-engine@5.0.0` and published three deterministic
  PrizePicks/Underdog regression fixtures for the v5 settlement contract.

## 1.0.0

### Major Changes

- Graduate v4-aligned companion packages to 1.0.0: CLI wrapper, Sportradar stat-provider adapter, framework-agnostic display helpers, and canonical settlement test vectors. All four ship pinned against `@buzzr/dfs-engine@^4.0.0` and follow Settlement OS v4 strict contracts.

### Patch Changes

- Updated dependencies [07fc4c7]
  - @buzzr/dfs-engine@4.0.0
