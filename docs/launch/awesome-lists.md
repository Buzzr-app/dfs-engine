# Directory submission tracker

> Status: MANUAL RELEASE FOLLOW-UP. Do not publish or open duplicate submissions before the reviewed npm/GitHub release is live. Re-check each directory's current rules immediately before submission.

## Official MCP Registry

Publish `server.json` as `io.github.Buzzr-app/dfs-engine` with the official `mcp-publisher` after the matching `@buzzr/mcp` version and provenance are live. This is the authoritative MCP listing; verify the exact registry record and install metadata after publication.

## Existing awesome-mcp-servers PR

- Directory: https://github.com/punkpeye/awesome-mcp-servers
- Existing submission: https://github.com/punkpeye/awesome-mcp-servers/pull/9540
- Current state checked 2026-07-16: open; `check-submission` passes; the maintainer bot requires a Glama listing and score badge.
- Action after release: update the existing PR instead of opening a duplicate. Replace its retired tool-count and production-use claims, point to the live package/repository, and use bounded wording.

Proposed corrected entry:

```text
- [Buzzr-app/dfs-engine](https://github.com/Buzzr-app/dfs-engine/tree/main/packages/mcp) 📇 🏠 - Local 11-tool server for DFS compatibility audits, sportsbook odds math, bet-history summaries, and game entertainment scoring. Install with `npx -y @buzzr/mcp`.
```

Before updating the PR, either complete the directory's current Glama requirement and append the exact score badge it provides, or close the PR with a short explanation. Do not invent a badge path.

## Additional current directory

- Directory: https://github.com/TensorBlock/awesome-mcp-servers
- State checked 2026-07-16: active, public, and accepts repository entries through pull requests.
- Action after the official registry and npm release are live: search for an existing Buzzr entry, follow the repository's then-current category/format rules, and submit only if it is not a duplicate.

Proposed entry:

```text
- [Buzzr Sports Engines](https://github.com/Buzzr-app/dfs-engine) - Local TypeScript MCP server for bounded DFS compatibility analysis, sportsbook calculations, bet-history summaries, and game entertainment scoring.
```

## Not current PR targets

- `dzharii/awesome-typescript` is archived. Its contribution policy also rejects AI-generated submissions; do not submit.
- `wong2/awesome-mcp-servers` is maintained through https://mcpservers.org rather than repository entry pull requests. Use its website submission flow only after the release is live.
- The previously drafted `hkair/awesome-sports-analytics` repository does not exist. It has been removed as a target.

## Submission proof

For every live submission, record the URL, date, exact released version, directory requirements, status, and any follow-up requirement here. A prepared draft is not counted as a submitted or accepted listing.
