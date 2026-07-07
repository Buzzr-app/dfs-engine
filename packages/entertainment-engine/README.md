# @buzzr/entertainment-engine

Transparent sports entertainment scoring, hybrid ML prediction, and
personalized game recommendations for Buzzr.

The package is intentionally pure: it does not import React Native, Expo,
Supabase, AsyncStorage, or app services — and it has zero runtime
dependencies. Apps and jobs provide data through plain objects, then persist
results however they choose.

## Core API

```ts
import {
  resolveBuzzScores,
  enrichGameRowWithBuzzScores,
  predictGameWithDiagnostics,
} from '@buzzr/entertainment-engine';

const resolved = resolveBuzzScores({
  league: 'NBA',
  status: 'scheduled',
  startsAt: '2026-06-12T01:00:00Z',
  homeTeam: 'Boston Celtics',
  awayTeam: 'Los Angeles Lakers',
}, { upcomingLike: true });

const prediction = predictGameWithDiagnostics({
  league: 'NBA',
  status: 'scheduled',
  startsAt: '2026-06-12T01:00:00Z',
  homeTeam: 'Boston Celtics',
  awayTeam: 'Los Angeles Lakers',
}, {
  odds: { spread: -1.5, overUnder: 226.5 },
  teamPower: { home: 9.2, away: 8.7 },
});
```

## New in v5

### Injectable clock

Every time-sensitive entry point accepts an optional `now` (epoch millis or a
`Date`). It defaults to `Date.now()`, so existing callers are unaffected, but
jobs and tests can pin the clock for full determinism:

```ts
resolveBuzzScores(game, { upcomingLike: true, now: Date.UTC(2026, 4, 1) });
enrichGameRowWithBuzzScores(row, { now: Date.UTC(2026, 4, 1) });
predictGameWithDiagnostics(game, { now: Date.UTC(2026, 4, 1) });
```

### Timezone-safe primetime detection

Primetime and weekend detection no longer depend on the host machine's
timezone. Game inputs may carry an explicit `venueUtcOffsetMinutes` or
`localStartHour` (also `venue_utc_offset_minutes` / `local_start_hour` on DB
rows). When absent, the engine derives US Eastern local time with a proper
DST calculation (second Sunday in March through first Sunday in November).
`easternUtcOffsetMinutes(utcMs)` is exported for reuse.

### Team-name normalization

All rivalry, marquee, and shared-city lookups run through one exported
`normalizeTeamName` helper: lowercase, trimmed, whitespace-collapsed, and
diacritic-insensitive (`'Los Ángeles Lakers'` matches
`'los angeles lakers'`). The NFL rivalry table now includes modern rivalries
such as Bills–Bengals, Ravens–Steelers, Chiefs–Raiders, Bills–Chiefs, and
Cowboys–49ers.

### ML v5 (`ml-v5`)

The feature vector grew from 20 to 22 with two appended optional features:

- `searchHeat` — from `context.searchHeat: { home?, away? }`, each in
  `[-1, 1]`, normalized to `[0, 1]` (absent → neutral `0.5`).
- `starPower` — from `context.starPower` in `[0, 1]` (absent → `0.5`).

Old 20-length v1 weight arrays remain fully supported: the appended features
are skipped for them, so v1 predictions are bit-identical to prior releases.

`trainSGD(examples, opts)` upgrades (defaults preserve pre-v5 behavior):

- Feature standardization (on by default) — per-feature mean/std captured
  during training, stored as `featureMeans`/`featureStds` in the weights and
  applied automatically at prediction time.
- `momentum` — classical momentum coefficient (default `0`, plain SGD).
- `validationSplit` — chronological tail held out for validation, with
  `earlyStopping: true` and `patience` stopping on validation MAE plateau.
- `shuffle: true` with `seed` — deterministic per-epoch shuffling via an
  embedded mulberry32 PRNG.
- Calibrated confidence — when a validation split exists, piecewise-linear
  calibration bins built from validation residuals are stored in
  `confidenceCalibration` and applied by `predictGameWithDiagnostics`
  (also exported directly as `applyConfidenceCalibration`).

Freshly trained weights carry `modelVersion: 'ml-v5'`
(`ML_MODEL_VERSION_V5`), and `buildModelRunReport` carries the trained
model's version through to the report.

### Recommendations

```ts
import { rankGamesForUser, explainRecommendation } from '@buzzr/entertainment-engine';

const ranked = rankGamesForUser(
  [
    { id: 'game-1', game: celticsLakers, baseScore: 8.1 },
    { id: 'game-2', game: kingsJazz }, // base score estimated transparently
  ],
  {
    favoriteTeams: ['Boston Celtics'],
    favoriteLeagues: ['NBA'],
    teamAffinity: { 'utah jazz': -0.4 },
    leagueAffinity: { NHL: 0.6 },
    socialSignal: { 'game-2': 0.8 }, // fire-ratio in [-1, 1] keyed by game id
  },
  { now: Date.UTC(2026, 4, 1), limit: 20 },
);

const breakdown = explainRecommendation(ranked[0]);
// { baseScore, personalAdjustment, socialAdjustment, totalScore, factors }
```

Scoring is the base entertainment score (provided `baseScore`, else a
transparent estimate) plus a bounded personal-affinity adjustment (±1.5,
`MAX_AFFINITY_ADJUSTMENT`) and a bounded social adjustment (±0.75,
`MAX_SOCIAL_ADJUSTMENT`). Ordering is deterministic: ties break by earliest
start time, then id. `explainRecommendation` returns the factor list the
app's BuzzBreakdownSheet renders — base score, personal adjustment, social
adjustment, and individual signed factor deltas.

## Design

- `resolveBuzzScores` is deterministic and explainable.
- `predictGameWithDiagnostics` layers trained weights over transparent
  features and returns factor impacts, input coverage, confidence, and model
  version metadata.
- Training helpers accept already-built examples; Supabase extraction belongs
  in the consuming app or job.
- `ENGINE_PACKAGE_VERSION` reports the package version (`5.0.0`).
