# v5.0.0 launch checklist

Sequenced end-to-end. Everything in `docs/launch/` is a draft the maintainer publishes manually — nothing here auto-posts.

## Phase 0 — Pre-flight (day −1)

- [ ] `npm run verify` green on `release/v5.0.0` (typecheck, lint, format, tests, coverage, build, docs, smoke, size, pack)
- [ ] `npm run audit:high` clean
- [ ] All 10 package READMEs render correctly on GitHub (badges, tables, code fences)
- [ ] Root README, AGENTS.md, llms.txt merged to `main`
- [ ] CHANGELOGs current for every package (changesets)
- [ ] Merge `release/v5.0.0` → `main` via PR

## Phase 1 — Publish (day 0)

- [ ] `npm publish` all 10 packages (workspaces; verify publish order lets `@buzzr/dfs-engine` land before dependents, or use `--workspaces` with existing tooling)
- [ ] Spot-check npm pages: README renders, keywords show, `repository`/`homepage` links resolve to the right package directory
- [ ] `npx -y @buzzr/mcp` starts clean on a machine that has never installed it
- [ ] `npm i -g @buzzr/dfs-cli && dfs-grade --help` works

## Phase 2 — GitHub release + docs (day 0)

- [ ] Tag `v5.0.0` and push the tag (this triggers the docs workflow → GitHub Pages)
- [ ] Verify https://buzzr-app.github.io/dfs-engine/ rebuilt with v5 API
- [ ] Write the GitHub Release: highlights (batch settlement, policy validation, parlay/EV/Kelly/CLV, calibrated ML + recommendations, new MCP server), migration notes, full changelog links
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
- [ ] Add "Powered by @buzzr open-source engines" section to the Buzzr app README (cross-promo) — done in the app repo
- [ ] Watch npm download trends + GitHub traffic; note which channel converted for the next release
- [ ] Follow-up content idea backlog: "How PrizePicks-style DNP rescue actually works", "Batch settlement cache design", "Giving AI agents real odds math via MCP"

## Metrics to record (baseline: ~24 downloads/week pre-launch)

| Metric                              | Baseline | +7 days | +30 days |
| ----------------------------------- | -------- | ------- | -------- |
| npm weekly downloads (family total) | ~24      |         |          |
| GitHub stars                        |          |         |          |
| Issues/discussions opened           |          |         |          |
| Docs site uniques                   |          |         |          |
