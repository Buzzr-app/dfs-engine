# Adoption baseline — 2026-07-16

This is the pre-release baseline for the public toolkit work that follows v5.0.0. Use the same source and window definitions for the +7-day and +30-day comparisons.

## Measurement clock

Release day (day 0), written as **D**, is the UTC calendar date on which the
first reviewed 5.1.0 package is confirmed live on npm. The planned date is
2026-07-16, but it becomes D only after that live proof. Because publication
can happen partway through a day, day 0 is not included in either follow-up
download window.

- Baseline: the fixed seven complete UTC days from 2026-07-09 through
  2026-07-15.
- +7: D+1 through D+7, captured on or after 00:00 UTC on D+8.
- +30: D+1 through D+30, captured on or after 00:00 UTC on D+31.

Run the read-only capture with explicit inclusive dates. It writes
machine-readable JSON to standard output and does not change GitHub, npm, or
the MCP Registry:

```bash
npm run --silent capture:adoption -- --start 2026-07-09 --end 2026-07-15
```

## npm downloads

Source: npm downloads API. Window: the seven complete UTC days from 2026-07-09 through 2026-07-15.

Measured family baseline: 191 package downloads from 2026-07-09 through 2026-07-15. This is package activity, not a unique-user count.

| Package                            | Downloads |
| ---------------------------------- | --------: |
| `@buzzr/dfs-engine`                |        38 |
| `@buzzr/bets-core`                 |        34 |
| `@buzzr/dfs-provider-espn`         |        25 |
| `@buzzr/entertainment-engine`      |        20 |
| `@buzzr/dfs-testkit`               |        19 |
| `@buzzr/dfs-provider-sportradar`   |        18 |
| `@buzzr/dfs-engine-test-vectors`   |        16 |
| `@buzzr/dfs-cli`                   |         9 |
| `@buzzr/dfs-react`                 |         8 |
| `@buzzr/mcp`                       |         4 |
| **Family total**                   |   **191** |

Package downloads overlap when one consumer installs several packages. Treat the family total as package-download volume, not unique users.

`@buzzr/mcp` downloads are the privacy-preserving MCP adoption proxy. The
baseline is 4 package downloads. This aggregate does not identify MCP clients
or unique users, and it can include reinstalls, CI, cache misses, and direct npm
downloads that never start the server.

## GitHub and discovery

Snapshot captured from the GitHub and MCP Registry APIs on 2026-07-16.

| Metric                                      | Baseline |
| ------------------------------------------- | -------: |
| GitHub stars                                |        1 |
| GitHub forks                                |        0 |
| GitHub subscribers                          |        0 |
| GitHub clones, trailing 14 days             |       98 |
| GitHub unique cloners, trailing 14 days     |       37 |
| GitHub page views, trailing 14 days         |        1 |
| GitHub unique viewers, trailing 14 days     |        1 |
| MCP Registry records matching Buzzr         |        0 |

The clone window contains the v5.0.0 release day, when GitHub reports 74 clones and 26 unique cloners. Keep that launch spike visible rather than treating the 14-day total as a steady daily rate.

GitHub's traffic endpoints always return a rolling 14-day repository window,
so their +7 and +30 snapshots are point-in-time rolling totals rather than
cumulative release windows. GitHub repo views and unique viewers are not docs
site analytics. GitHub Pages has no first-party analytics configured for this
site, so the baseline makes no claim about docs-site visits or uniques.

Top referrers and top paths are also rolling GitHub repository traffic data.
Referrer attribution is a limited hint, not a complete referral funnel: only the
most popular reported sources appear, direct or unattributed traffic is not
resolved, npm exposes no referral source, and repository paths do not measure
Pages traffic. Use channel timing as correlation, never proof that a channel
caused an install.

## Measurement protocol

- Record +7 days and +30 days using complete UTC days only.
- Query all ten npm packages individually and retain both per-package and family totals.
- Record GitHub traffic, top referrers, and top paths before the API's rolling 14-day window expires.
- Separate GitHub issues from pull requests when measuring community reports.
- Record MCP Registry presence by exact server name after publication.
- Do not infer unique users by summing npm package downloads.
- Save the JSON capture alongside the launch evidence so every number retains its source URL, capture timestamp, and window semantics.
