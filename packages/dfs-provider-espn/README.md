# @buzzr/dfs-provider-espn

Optional ESPN-shaped provider contract for `@buzzr/dfs-engine`.

This package does not fetch on its own. Bring your own ESPN client, scraper, cache, or paid data feed adapter and return `PlayerGameLogEntryShape[]`.

The engine validates returned rows at the provider boundary and reports
`invalid_provider_data` when a loader emits malformed gamelog entries.
