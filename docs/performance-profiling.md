# Performance Profiling (Playwright)

This project includes an automated Playwright profiling harness that:

- Builds and serves the production app (unless explicitly skipped)
- Drives a repeatable UI scenario (Solar playback -> Planetarium playback -> Sky Charts texture playback)
- Captures a Chrome DevTools performance trace (`chrome-trace.json`)
- Captures a Playwright interaction trace (`playwright-trace.zip`)
- Writes structured metrics (`summary.json`) and a readable report (`summary.md`)
- Supports repeat runs with median aggregation (`median-summary.json` / `median-summary.md`)
- Supports automated regression checks against a committed median baseline

Default scripted segments:

- `idle_initial` (4s)
- `solar_playback` (8s)
- `planetarium_playback` (10s)
- `skychart_texture_setup` (2.5s, diagnostic only)
- `skychart_texture_playback` (9.5s)
- `idle_final` (3s)

## Quick Start

1. Install browser binaries once:

```bash
npm run perf:install
```

2. Run the profiling harness:

```bash
npm run perf:profile
```

Artifacts are written to:

`test-output/perf/<timestamp>/`

3. Run repeat mode for more stable comparisons:

```bash
npm run perf:profile:repeat
```

Repeat artifacts are written to:

`test-output/perf/repeat-<timestamp>/`

4. Check regressions against baseline:

```bash
PERF_MEDIAN_PATH=test-output/perf/repeat-<timestamp>/median-summary.json npm run perf:profile:check
```

## CI Job

A manual GitHub Actions workflow is included:

- Workflow: `.github/workflows/profile-playwright.yml`
- Trigger: `workflow_dispatch` + weekly schedule (Mondays 09:00 UTC)
- Run steps: `perf:profile:repeat:ci` then `perf:profile:check:ci`
- Artifact: `playwright-profile-artifacts`

## Generated Artifacts

Each run emits:

- `summary.json`: machine-readable segment metrics and aggregate metrics
- `summary.md`: quick human summary table
- `chrome-trace.json`: Chrome DevTools trace (load in `chrome://tracing` or DevTools Performance)
- `hotspots.json`: per-segment long-task hotspot attribution extracted from trace
- `hotspots.md`: readable per-segment hotspot tables (top offenders)
- `playwright-trace.zip`: Playwright trace (open via `npx playwright show-trace`)
- `final-screen.png`: final UI screenshot

Repeat mode additionally emits:

- `median-summary.json`: median aggregate/segment metrics across runs
- `median-summary.md`: human-readable median report
- `hotspots-summary.json`: median hotspot attribution across runs
- `hotspots-summary.md`: readable median hotspot summary tables
- `hotspots-pr-comment.md`: PR comment-ready markdown snippet
- `run-XX/`: per-run artifacts from the single-run harness

Regression checking uses:

- `scripts/perf/baseline-median-summary.json`: committed baseline reference
- `scripts/perf/baseline-median-summary-ci.json`: CI baseline reference for GitHub-hosted runners

## Optimization Measures (Reference)

This section documents the major optimization measures implemented in the
profiling/optimization workstream (`2026-03-04` to `2026-03-05`).

### Runtime and Render Path

| Commit | Area | Measure | Intended Effect |
|--------|------|---------|-----------------|
| `e132101` | Sky projection pipeline | Added `prepareSkyProjectionContext` and context-based helpers so planets, stars, ecliptic, and MW reuse the same time/observer/rotation solve per chart frame. Also computed sunrise/sunset virtual longitudes in one call via `sunHorizonLongitudes`. | Removes duplicate astronomy-engine transforms and reduces per-frame CPU cost. |
| `0ea422e` | Sky Charts draw model | Moved stars and constellation edges/labels from SVG node trees to a clipped canvas overlay (`StarfieldCanvasLayer`). | Reduces SVG DOM churn and improves playback/frame consistency. |
| `7c9d5c1` | Milky Way texture path | Added internal render scaling (`0.75`), avoided repeated WebGL resize work, and skipped draw calls when texture is not ready or effective opacity is zero. | Lowers GPU fill/load and avoids unnecessary GL work during animation. |
| `a6d24b6` | Playback + time-zone utilities | Switched playback loops to in-place `Date` mutation (`setTime`), throttled React time snapshots (`150ms` in app loop), memoized day-key/range usage, and added bounded day-range cache in `timeZoneDay`. | Reduces allocation churn and repeated timezone/day-boundary computations. |
| `be2088f` | Scene recompute scope | Prevented full-planet position recompute each tick for overlay-only needs; `InfoDisplay` now computes only the selected body position on demand. | Cuts redundant ephemeris work during playback. |
| `f867996` | Sky Charts rerender control + panel layout | Wrapped `SkyChartPanel` in `React.memo` with playback-aware prop equality (ignore parent date snapshots while playing) and added CSS `contain: layout paint style` for floating panels. | Reduces avoidable React rerenders and cross-panel layout invalidation. |
| `d1e1200` | Animation smoothness | Smoothed sky animation timing and stabilized Milky Way update behavior. | Reduces visible jitter/stutter in sky playback. |

### Profiling and Regression Infrastructure

| Commit | Area | Measure | Intended Effect |
|--------|------|---------|-----------------|
| `d2b7c79` | Baseline harness | Added automated Playwright profiling run (build/serve/drive/capture/report). | Enables repeatable, scripted profiling instead of ad-hoc runs. |
| `7f7f242` | Statistical stability | Added repeat-run profiling with median summaries. | Makes performance comparisons less noisy. |
| `d2ca332` | CI gating | Added regression checker against committed baseline medians. | Fails CI on statistically meaningful regressions. |
| `3f0774b` | Trace hotspot extraction | Added long-task hotspot extraction from Chrome traces plus CI baseline artifact. | Surfaces where regressions occur, not just aggregate FPS/p99 changes. |
| `f5e2d9f` | Reporting ergonomics | Added repeat hotspot summary outputs and CI log emission/PR-ready markdown. | Improves triage speed during review. |
| `a9bfaa5` | Attribution signal quality | Improved hotspot attribution de-noising/signal extraction. | Produces cleaner actionable offender lists. |
| `26ce3c3` | Source attribution + hotspot gates | Added sourcemap-based hotspot symbolization and hotspot-specific regression thresholds. | Connects regressions to source lines and enforces per-hotspot budget checks. |
| `826adb6` / `d681924` | Baseline maintenance | Refreshed committed local/CI baselines after accepted optimization shifts. | Keeps gates aligned with current accepted performance envelope. |

### Maintenance Rule

- When a change affects render hot paths, animation cadence, allocation behavior,
  profiling scripts, or regression thresholds, update this section in the same PR.

## Tunables (Environment Variables)

- `PROFILE_BASE_URL` (default `http://127.0.0.1:4173`)
- `PROFILE_PORT` (default `4173`)
- `PROFILE_OUT_DIR` (default `test-output/perf/<timestamp>`)
- `PROFILE_SKIP_BUILD=1` to skip `npm run build`
- `PROFILE_SKIP_SERVER=1` to use an already-running server at `PROFILE_BASE_URL`
- `PROFILE_HEADFUL=1` to run non-headless
- `PROFILE_BUILD_SOURCEMAP` (default `1`) build app with sourcemaps for hotspot symbolization
- `PROFILE_REPEAT` (default `5`) number of runs for `perf:profile:repeat`
- `PERF_MEDIAN_PATH` path to current median summary (`perf:profile:check`)
- `PERF_BASELINE_PATH` path to baseline summary (`perf:profile:check`)
- `PERF_MAX_WEIGHTED_FPS_DROP_PCT` (default `20`)
- `PERF_MAX_WORST_P99_INCREASE_PCT` (default `30`)
- `PERF_MAX_WORST_P99_INCREASE_MS` (default `20`)
- `PERF_MAX_LONG_TASK_INCREASE_PCT` (default `40`)
- `PERF_MAX_LONG_TASK_INCREASE_ABS` (default `400`)
- `PERF_SEGMENT_LABELS` (default `skychart_texture_playback,planetarium_playback,idle_final`)
- `PERF_SEGMENT_LABEL` legacy single-segment override (used if `PERF_SEGMENT_LABELS` is unset)
- `PERF_MAX_SEGMENT_FPS_DROP_PCT` (default `25`)
- `PERF_MAX_SEGMENT_P99_INCREASE_PCT` (default `40`)
- `PERF_MAX_SEGMENT_P99_INCREASE_MS` (default `25`)
- `PERF_HOTSPOT_SYMBOLIZE` (default `1`) map hotspot function calls back to source files/lines
- `PERF_HOTSPOT_ASSET_ROOTS` comma-separated asset roots for sourcemap lookup (default `dist`)
- `PERF_HOTSPOT_SEGMENTS` (default `skychart_texture_playback,solar_playback`)
- `PERF_HOTSPOT_SEGMENT` legacy single-segment override (used if `PERF_HOTSPOT_SEGMENTS` is unset)
- `PERF_MAX_HOTSPOT_SEGMENT_LONGTASK_INCREASE_PCT` (default `35`)
- `PERF_MAX_HOTSPOT_SEGMENT_LONGTASK_INCREASE_MS` (default `1200`)
- `PERF_MAX_HOTSPOT_TOP_OFFENDER_INCREASE_PCT` (default `40`)
- `PERF_MAX_HOTSPOT_TOP_OFFENDER_INCREASE_MS` (default `900`)

Example (reuse existing `npm run dev` server):

```bash
PROFILE_SKIP_BUILD=1 PROFILE_SKIP_SERVER=1 PROFILE_BASE_URL=http://127.0.0.1:5173 npm run perf:profile
```

Repeat mode example (3 runs against an existing dev server):

```bash
PROFILE_REPEAT=3 PROFILE_SKIP_BUILD=1 PROFILE_SKIP_SERVER=1 PROFILE_BASE_URL=http://127.0.0.1:5173 npm run perf:profile:repeat
```

CI-style local check:

```bash
PROFILE_OUT_DIR=test-output/perf/repeat-latest PROFILE_REPEAT=5 npm run perf:profile:repeat
npm run perf:profile:check:ci
```

## Notes

- The scenario is intentionally deterministic to make regressions comparable across commits.
- Aggregate metrics intentionally exclude `skychart_texture_setup` so one-time UI setup costs do not dominate steady-state regression gating.
- The harness pre-marks the guided tour as seen, so onboarding overlays do not interfere with scripted clicks.
- When it starts its own preview server, it uses a strict port (`PROFILE_PORT`) and fails fast if already occupied.
- For reliable comparisons, run on the same machine, same browser channel, and similar background load.
- Use `summary.json` and `median-summary.json` for automated regression thresholds and dashboards.
- For commit-to-commit tracking, prefer repeat-mode medians over single-run readings.
- Update `scripts/perf/baseline-median-summary.json` only after intentional performance shifts are accepted.
- Hotspot extraction de-noises wrapper events (for example, `Commit`/`RunTask`) so summaries surface actionable offenders such as `FunctionCall`, `Layout`, and `Paint`.
