# 5.1.0 public-toolkit launch checklist

Sequenced end-to-end. Everything in `docs/launch/` is a draft the maintainer publishes manually — nothing here auto-posts.

## Phase 0 — Pre-flight (day −1)

- [ ] `npm run verify` green at the reviewed release commit (typecheck, lint, format, tests, coverage, build, packed MCP, docs, smoke, size, pack, workflows, registry metadata, audit)
- [ ] `npm run audit:high` clean
- [ ] `node scripts/check-public-docs.mjs` green
- [ ] All 10 package READMEs render correctly on GitHub (badges, tables, code fences)
- [ ] Root README, AGENTS.md, llms.txt merged to `main`
- [ ] CHANGELOGs current for every package (changesets)
- [ ] Required CI is green and the reviewed PR is merged to protected `main`

## Phase 1 — Publish (day 0)

- [ ] Publish only the five packages in the reviewed release manifest; publish `@buzzr/dfs-engine@5.1.0` before packages pinned to that version
- [ ] Verify every live npm artifact against the reviewed version, `gitHead`, exact integrity digest, registry tarball origin, and provenance attestation
- [ ] Spot-check npm pages: README renders, keywords show, `repository`/`homepage` links resolve to the right package directory
- [ ] The clean-cache published proof passes for the exact `@buzzr/mcp@5.1.0` on Linux, macOS, and Windows
- [ ] `npx -y @buzzr/mcp@5.1.0` starts clean with isolated npm/home state and a real MCP client lists all 11 tools
- [ ] `npm i -g @buzzr/dfs-cli && dfs-grade --help` works
- [ ] `npx skills add https://github.com/Buzzr-app/dfs-engine --skill buzzr-sports-engine` discovers and installs the repository skill

## Phase 2 — GitHub release + docs (day 0)

- [ ] Create the reviewed `v5.1.0` tag only after npm artifacts are live
- [ ] Verify https://buzzr-app.github.io/dfs-engine/ rebuilt from that exact tag
- [ ] Write the GitHub Release: highlights (effective-dated policy truthfulness, settlement fixes, adversarial vectors, 11-tool bounded MCP, Codex skill), migration notes, and full changelog links
- [ ] Publish and verify `io.github.Buzzr-app/dfs-engine` in the official MCP Registry after the npm version is live
- [ ] Repo polish: description, website field → docs site, topics (`typescript`, `dfs`, `sports-betting`, `settlement`, `mcp`, `zero-dependency`, `prizepicks`, `underdog`)
- [ ] Confirm the bug-report issue template still matches the README's "Reporting bugs" section

## Phase 3 — Announce (day 0–1)

- [ ] Show HN (`docs/launch/show-hn.md`) — Tue–Thu, 8–10am ET; post the prepared first comment immediately; stay available for 3–4 hours to answer
- [ ] X/Twitter thread (`docs/launch/twitter-thread.md`) — same day as HN, link the HN thread once live
- [ ] dev.to article (`docs/launch/devto-article.md`) — publish; add canonical link if cross-posting later

## Phase 4 — Communities (day 2–7, spaced out)

- [ ] r/algobetting post (`docs/launch/reddit.md`)
- [ ] r/typescript post (2–3 days later)
- [ ] r/sportsbook — comment-first strategy per the notes in `reddit.md`
- [ ] awesome-mcp-servers PR (`docs/launch/awesome-lists.md`)
- [ ] awesome-typescript PR (after the first one lands)
- [ ] awesome-sports-analytics PR

## Phase 5 — Sustain (week 2+)

- [ ] Respond to every issue within 24h during launch window (responsiveness converts stars → users)
- [ ] Reverify the Buzzr app cross-link. Its `release/ios-2.0.0` branch currently vendors three 5.0.0 tarballs; upgrading it to the public 5.1.0 toolkit is a separate reviewed release decision
- [ ] Watch npm download trends + GitHub traffic; note which channel converted for the next release
- [ ] Follow-up content idea backlog: "How PrizePicks-style DNP rescue actually works", "Batch settlement cache design", "Giving AI agents real odds math via MCP"

## Metrics to record

Measured baseline: 191 package downloads from 2026-07-09 through 2026-07-15
(complete UTC days). See
[the source snapshot](adoption-baseline-2026-07-16.md); package downloads are not
unique users. Release day (day 0) is D, the UTC date when the first reviewed
5.1.0 package is confirmed live. Capture +7 for D+1 through D+7 on or after D+8,
and +30 for D+1 through D+30 on or after D+31. Use
`npm run --silent capture:adoption -- --start YYYY-MM-DD --end YYYY-MM-DD` and retain its
JSON output as evidence.

| Metric                                      | Baseline | +7 days | +30 days |
| ------------------------------------------- | -------: | ------- | -------- |
| npm package downloads (family total)        |      191 |         |          |
| `@buzzr/mcp` downloads (MCP adoption proxy) |        4 |         |          |
| GitHub stars                                |        1 |         |          |
| GitHub unique cloners (trailing 14 days)    |       37 |         |          |
| GitHub repo page views (trailing 14 days)   |        1 |         |          |
| GitHub repo unique viewers (trailing 14 days) |      1 |         |          |
| Issues opened (excluding pull requests)     |        0 |         |          |
| MCP Registry records matching Buzzr         |        0 |         |          |

Also retain clones, top referrers, and top paths from each JSON snapshot. The
GitHub traffic values are rolling 14-day repository metrics, not cumulative
release windows. Referrers are incomplete attribution signals, and GitHub repo
views do not measure the Pages docs site. GitHub Pages has no first-party
analytics configured here, so do not report docs-site visits or uniques unless
a separate reviewed analytics source is added later.
