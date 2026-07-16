# Adoption baseline — 2026-07-16

This is the pre-release baseline for the public toolkit work that follows v5.0.0. Use the same source and window definitions for the +7-day and +30-day comparisons.

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

## Measurement protocol

- Record +7 days and +30 days using complete UTC days only.
- Query all ten npm packages individually and retain both per-package and family totals.
- Record GitHub traffic before the API's rolling 14-day window expires.
- Separate GitHub issues from pull requests when measuring community reports.
- Record MCP Registry presence by exact server name after publication.
- Do not infer unique users by summing npm package downloads.
