# Changelog

## 5.0.0 - 2026-07-06

### Breaking

- Default local-time derivation for primetime/weekend detection is now
  deterministic US Eastern (with a correct statutory DST calculation) instead
  of the host machine's timezone. Scores no longer vary by the machine that
  computes them; pass `venueUtcOffsetMinutes` or `localStartHour` on the game
  input for non-Eastern venues.
- `trainSGD` output changed: weights are now 22-long, standardized by
  default, and tagged `modelVersion: 'ml-v5'`. Predictions with previously
  trained v1 weights are unchanged (see below), but newly trained weights are
  not numerically comparable to v1 training runs.

### Fixed

- Injectable clock: `Date.now()` is no longer read inside scoring.
  `resolveBuzzScores`, `enrichGameRowWithBuzzScores`, prediction contexts,
  and `rankGamesForUser` accept an optional `now?: number | Date`
  (default `Date.now()`), fixing time-rotted results and making tests stable
  forever.
- US Eastern primetime detection computes DST from the
  second-Sunday-in-March / first-Sunday-in-November rule, eliminating the
  ±1h drift across the September/November boundary. Exported as
  `easternUtcOffsetMinutes`.
- Team-name lookups (rivalry, marquee, shared-city) are case- and
  diacritic-insensitive through a single exported `normalizeTeamName` helper.

### Added

- ML v5 (`ml-v5`, `ML_MODEL_VERSION_V5`):
  - Two appended features (20 → 22): `searchHeat` (per-team `[-1, 1]`
    context normalized to `[0, 1]`) and `starPower` (`[0, 1]`). Old 20-long
    v1 weight arrays skip the new features and predict bit-identically to
    prior releases (`LEGACY_FEATURE_COUNT` exported).
  - Feature standardization: per-feature mean/std stored in the trained
    weights (`featureMeans`/`featureStds`) and applied at prediction time.
  - `trainSGD` options: `momentum` (classical momentum), `validationSplit`
    (chronological tail) with `earlyStopping` + `patience` on validation MAE,
    `shuffle` + `seed` (deterministic mulberry32 RNG), `standardize`.
  - Calibrated confidence: piecewise-linear calibration bins from validation
    residuals stored in `confidenceCalibration` and applied by
    `predictGameWithDiagnostics`; `applyConfidenceCalibration` exported.
- Recommendations module: `rankGamesForUser` (base score + bounded
  personal-affinity adjustment ±1.5 + bounded social adjustment ±0.75,
  deterministic tie-break by start time then id) and `explainRecommendation`
  (base score, personal adjustment, social adjustment, individual factors).
  New types: `UserAffinityProfile`, `RecommendationGameEntry`, `RankedGame`,
  `RecommendationExplanation`, `RecommendationFactor`, `RankGamesOptions`.
- NFL rivalry table expanded with modern rivalries: Bills–Bengals,
  Bills–Chiefs, Bills–Dolphins, Ravens–Steelers, Ravens–Bengals,
  Bengals–Browns, Chiefs–Raiders, Cowboys–49ers, Lions–Packers,
  Eagles–Commanders.
- Game inputs accept `venueUtcOffsetMinutes` / `localStartHour`
  (`venue_utc_offset_minutes` / `local_start_hour` on DB rows) for
  timezone-exact primetime detection.
- `buildModelRunReport` carries the trained weights' `modelVersion` through
  to the report.
- `ENGINE_PACKAGE_VERSION` now reads `'5.0.0'`.

### Internal

- `buzz-model-core.ts` is fully typed (removed `@ts-nocheck`); package lint
  is clean under typescript-eslint recommended.
- Still zero runtime dependencies.

## 0.2.0

- Transparent deterministic scoring (`resolveBuzzScores`,
  `enrichGameRowWithBuzzScores`), 20-feature linear model
  `ml-v1-transparent` (`trainSGD`, `predictGameWithDiagnostics`,
  `validateModel`), and model run reporting (`buildModelRunReport`).
