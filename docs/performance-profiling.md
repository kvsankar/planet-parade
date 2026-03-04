# Performance Profiling (Playwright)

This project includes an automated Playwright profiling harness that:

- Builds and serves the production app (unless explicitly skipped)
- Drives a repeatable UI scenario (Solar playback -> Planetarium playback -> Sky Charts texture playback)
- Captures a Chrome DevTools performance trace (`chrome-trace.json`)
- Captures a Playwright interaction trace (`playwright-trace.zip`)
- Writes structured metrics (`summary.json`) and a readable report (`summary.md`)
- Supports repeat runs with median aggregation (`median-summary.json` / `median-summary.md`)
- Supports automated regression checks against a committed median baseline

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
- Trigger: `workflow_dispatch`
- Run steps: `perf:profile:repeat:ci` then `perf:profile:check:ci`
- Artifact: `playwright-profile-artifacts`

## Generated Artifacts

Each run emits:

- `summary.json`: machine-readable segment metrics and aggregate metrics
- `summary.md`: quick human summary table
- `chrome-trace.json`: Chrome DevTools trace (load in `chrome://tracing` or DevTools Performance)
- `playwright-trace.zip`: Playwright trace (open via `npx playwright show-trace`)
- `final-screen.png`: final UI screenshot

Repeat mode additionally emits:

- `median-summary.json`: median aggregate/segment metrics across runs
- `median-summary.md`: human-readable median report
- `run-XX/`: per-run artifacts from the single-run harness

Regression checking uses:

- `scripts/perf/baseline-median-summary.json`: committed baseline reference

## Tunables (Environment Variables)

- `PROFILE_BASE_URL` (default `http://127.0.0.1:4173`)
- `PROFILE_PORT` (default `4173`)
- `PROFILE_OUT_DIR` (default `test-output/perf/<timestamp>`)
- `PROFILE_SKIP_BUILD=1` to skip `npm run build`
- `PROFILE_SKIP_SERVER=1` to use an already-running server at `PROFILE_BASE_URL`
- `PROFILE_HEADFUL=1` to run non-headless
- `PROFILE_REPEAT` (default `5`) number of runs for `perf:profile:repeat`
- `PERF_MEDIAN_PATH` path to current median summary (`perf:profile:check`)
- `PERF_BASELINE_PATH` path to baseline summary (`perf:profile:check`)
- `PERF_MAX_WEIGHTED_FPS_DROP_PCT` (default `20`)
- `PERF_MAX_WORST_P99_INCREASE_PCT` (default `30`)
- `PERF_MAX_WORST_P99_INCREASE_MS` (default `20`)
- `PERF_MAX_LONG_TASK_INCREASE_PCT` (default `40`)
- `PERF_MAX_LONG_TASK_INCREASE_ABS` (default `400`)
- `PERF_SEGMENT_LABEL` (default `skychart_texture_playback`)
- `PERF_MAX_SEGMENT_FPS_DROP_PCT` (default `25`)
- `PERF_MAX_SEGMENT_P99_INCREASE_PCT` (default `40`)
- `PERF_MAX_SEGMENT_P99_INCREASE_MS` (default `25`)

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
- The harness pre-marks the guided tour as seen, so onboarding overlays do not interfere with scripted clicks.
- When it starts its own preview server, it uses a strict port (`PROFILE_PORT`) and fails fast if already occupied.
- For reliable comparisons, run on the same machine, same browser channel, and similar background load.
- Use `summary.json` and `median-summary.json` for automated regression thresholds and dashboards.
- For commit-to-commit tracking, prefer repeat-mode medians over single-run readings.
- Update `scripts/perf/baseline-median-summary.json` only after intentional performance shifts are accepted.
