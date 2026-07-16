# Versioning, compatibility, and support

Buzzr uses SemVer and Changesets for independent package releases. The workspace packages happen to be at 5.0.0 in the 2026-07-16 baseline, but there is no lockstep-versioning promise: each release should bump the smallest set of packages whose public API, behavior, dependency pins, or published artifacts changed.

## Release selection

- **Patch:** compatible correctness, security, documentation, source/provenance, or payout-table corrections that do not add a public contract.
- **Minor:** additive exports, optional result fields, tools, supported cases, or fixture coverage.
- **Major:** removed or renamed exports, changed required fields, incompatible canonical shapes, or intentionally incompatible behavior.

A release may need several independent package changes. For example, additive engine metadata plus new MCP tools and expanded vector fields can justify separate minor changes, while a dependent package with only an updated internal pin may need a patch. Record the decision in `.changeset/*.md`; do not infer a version from a draft document.

The Changesets configuration has no `fixed` or `linked` groups. `updateInternalDependencies: "patch"` governs generated dependency updates, not a requirement to publish every workspace.

## Compatibility contracts

- Node >= 22 is the supported runtime floor; CI covers Node 22 and 24.
- Only each package root export is supported. Deep imports from `src` or `dist` are internal.
- Core libraries publish ESM, CJS, and types where their manifest declares them. `@buzzr/dfs-cli` is ESM-only and also exposes the `dfs-grade` executable.
- `DfsEntryInput`, `DfsLegInput`, `PlayerGameLogEntryShape`, and documented settlement result fields follow SemVer. Use published adapters instead of passing legacy aliases into strict validators.
- Operator policy and payout data is effective-dated. A correction can change which table a later `placedAt` selects without rewriting an older historical table.
- `grade_dfs_entries`, `closing_line_value`, and `summarize_bet_history` currently return string `contractVersion: "1"`. A consumer should reject an unknown contract version rather than guessing.
- Engine regression fixtures are tied to a matching `@buzzr/dfs-engine` version. They are not official operator conformance.

## Deprecation and migration

Breaking changes require a major version and migration notes. When practical, a deprecated adapter remains available through at least the next minor line before removal; settlement/security flaws can require faster action and will be called out explicitly.

For every affected package:

1. Add a Changeset describing user-visible impact.
2. Update the package `CHANGELOG.md` and README without inventing the final version before Changesets applies it.
3. Add or update tests and versioned regression fixtures.
4. Document renamed fields, changed defaults, status/explanation codes, and required caller actions.
5. Prove the packed artifacts, then verify the exact published version, integrity, `gitHead`, and provenance.

The vNext documentation label means "unreleased work on the reviewed branch." Replace it with the actual version only when the release plan and generated package versions are final.

## Application compatibility

The public monorepo and Buzzr mobile app are separate release surfaces. The app's `release/ios-2.0.0` branch currently vendors local 5.0.0 tarballs for `@buzzr/bets-core`, `@buzzr/dfs-engine`, and `@buzzr/entertainment-engine`. A public npm release does not update those files automatically. Any mobile migration needs its own dependency change, tests, build, and release decision, while unrelated app-branch work remains untouched.

For MCP clients, pin `@buzzr/mcp@<published-version>` when reproducibility matters. Using `@latest` opts into future compatible updates and should be a conscious host policy.

## Support policy

Security and settlement-correctness fixes target the latest major release first. Older majors may receive a low-risk backport when it does not change public contracts; no fixed backport duration or end-of-life schedule is currently promised. See [`SECURITY.md`](../SECURITY.md) for private reporting.

## Release proof

Before publishing:

```sh
npm run verify
node scripts/check-public-docs.mjs
git diff --check
```

The release is not complete until CI, npm artifacts, the Git tag/GitHub Release, generated docs, registry metadata, and relevant cross-links all resolve to the reviewed commit.
