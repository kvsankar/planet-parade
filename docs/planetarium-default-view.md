# Planetarium Default View Time Selection and Framing

## Goal

When Planetarium opens (or when the active combo changes), the app should pick a time that:

1. Shows as much of the target cluster as possible above the horizon.
2. Minimizes solar/twilight interference.
3. Keeps the target bodies at practical viewing altitudes.
4. Remains deterministic.
5. Supports a wide, horizon-rich framing of the ecliptic after time selection.

This logic is implemented in `src/lib/planetariumDefaultView.ts` and used by `PlanetariumCameraController`.

## Inputs

- `baseDate` (UTC date currently selected in the app)
- `observer` (lat/lon/height)
- `targets` (active combo bodies, mapped to `SkyBodyId`)

## Search Window

- Scan the full UTC day `00:00` to `24:00` in 5-minute steps.
- Consider only samples where `Sun altitude < 0°` (Sun below horizon).

## Candidate Metrics

For each sampled instant:

- `visibleCount`: number of targets with altitude `> 0°`
- `elevatedCount`: number of targets with altitude `>= 2°` (safety margin)
- `darknessScore`: `clamp(-sunAltitude, 0, 18)`
  - `0` at horizon
  - `18` at astronomical-dark threshold (`Sun <= -18°`)
- `minAltitude`: minimum target altitude
- `meanAltitude`: average target altitude

## Ranking (Lexicographic)

Candidates are compared in this exact order:

1. Higher `visibleCount`
2. Higher `elevatedCount`
3. Higher `darknessScore`
4. Higher `minAltitude`
5. Higher `meanAltitude`
6. Earlier timestamp (tie-break)

This means:

- Full-cluster visibility is always preferred.
- Given equal visibility, darker sky wins.
- If darkness is effectively tied, higher planet placement wins.

## Fallbacks

- If no nighttime candidate is found with any useful visibility, use the earliest Sun-horizon crossing (sunrise/sunset) in the same UTC day.
- If even that is unavailable (extreme lat edge case), keep the existing current date.

## Framing Strategy (After Time Selection)

Implemented in `PlanetariumCameraController`:

1. Build a cluster frame from target azimuths (preferring targets above horizon).
2. Build an ecliptic-arc frame from the visible ecliptic segment above the horizon.
3. Center view on the ecliptic-arc center azimuth when available (fallback: cluster center).
4. Choose a wide startup FoV to show horizon-to-horizon context:
   - baseline default: `100°`
   - startup clamp: `96°` to `118°`
5. Keep pitch near the horizon band to preserve orientation context.

If there is no active combo, the controller falls back to framing the visible ecliptic arc for the current date.

## Trigger Rules

- Runs when Planetarium mounts.
- Re-runs when the selected combo changes.
- Does **not** re-run for date-only changes from global ±1d/±5d navigation, so user-selected alt/az framing stays stable while stepping dates.

## Why this approach

This avoids hardcoding a single Sun-altitude target (for example, always `-15°`).
Instead, the optimizer adapts to geometry automatically:

- If an inner-planet-heavy cluster can be shown only near twilight, it may choose a less dark but more complete view.
- If the cluster remains visible deeper into night, it will choose the darker time.

So the Mercury/Sun-elongation tradeoff is handled by the ranking itself rather than a fixed rule.
