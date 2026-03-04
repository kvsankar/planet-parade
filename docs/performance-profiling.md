# Performance Profiling (Playwright)

This project includes an automated Playwright profiling harness that:

- Builds and serves the production app (unless explicitly skipped)
- Drives a repeatable UI scenario (Solar playback -> Planetarium playback -> Sky Charts texture playback)
- Captures a Chrome DevTools performance trace (`chrome-trace.json`)
- Captures a Playwright interaction trace (`playwright-trace.zip`)
- Writes structured metrics (`summary.json`) and a readable report (`summary.md`)

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

## CI Job

A manual GitHub Actions workflow is included:

- Workflow: `.github/workflows/profile-playwright.yml`
- Trigger: `workflow_dispatch`
- Artifact: `playwright-profile-artifacts`

## Generated Artifacts

Each run emits:

- `summary.json`: machine-readable segment metrics and aggregate metrics
- `summary.md`: quick human summary table
- `chrome-trace.json`: Chrome DevTools trace (load in `chrome://tracing` or DevTools Performance)
- `playwright-trace.zip`: Playwright trace (open via `npx playwright show-trace`)
- `final-screen.png`: final UI screenshot

## Tunables (Environment Variables)

- `PROFILE_BASE_URL` (default `http://127.0.0.1:4173`)
- `PROFILE_PORT` (default `4173`)
- `PROFILE_OUT_DIR` (default `test-output/perf/<timestamp>`)
- `PROFILE_SKIP_BUILD=1` to skip `npm run build`
- `PROFILE_SKIP_SERVER=1` to use an already-running server at `PROFILE_BASE_URL`
- `PROFILE_HEADFUL=1` to run non-headless

Example (reuse existing `npm run dev` server):

```bash
PROFILE_SKIP_BUILD=1 PROFILE_SKIP_SERVER=1 PROFILE_BASE_URL=http://127.0.0.1:5173 npm run perf:profile
```

## Notes

- The scenario is intentionally deterministic to make regressions comparable across commits.
- The harness pre-marks the guided tour as seen, so onboarding overlays do not interfere with scripted clicks.
- When it starts its own preview server, it uses a strict port (`PROFILE_PORT`) and fails fast if already occupied.
- For reliable comparisons, run on the same machine, same browser channel, and similar background load.
- Use `summary.json` for automated regression thresholds and dashboards.
