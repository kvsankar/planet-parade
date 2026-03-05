# Planetarium Default View Time Selection and Framing

## Goal

When Planetarium opens (or the active combo/location/day context changes), the app should pick a practical viewing instant that:

1. Shows as much of the target cluster as possible above the horizon.
2. Optionally prefers darker sky when visibility is tied.
3. Keeps bodies at usable altitudes.
4. Is deterministic for a given input state.
5. Starts with a wide horizon-rich ecliptic framing.

This behavior lives in `src/lib/planetariumDefaultView.ts` and is applied by `PlanetariumCameraController`.

## Inputs

- `baseDate`: current simulation instant
- `observer`: lat/lon/height
- `targets`: active combo bodies mapped to `SkyBodyId`
- `timeZone` (optional): inferred IANA zone from observer coordinates
- `preferNightVisible` (optional, default `true`): whether to prefer night-only candidates when usable

## Day Window

The search window is day-bounded by `getTimeZoneDayRange(baseDate, timeZone)`:

- If `timeZone` is present and valid, scan that **local calendar day** (`00:00` to next `00:00` in that zone).
- Otherwise, fall back to the UTC day window.

Sampling cadence is fixed at 5 minutes across the whole day window.

## Candidate Metrics

For each sampled instant:

- `visibleCount`: targets with altitude `> 0°`
- `elevatedCount`: targets with altitude `>= 2°`
- `darknessScore`: `clamp(-sunAltitude, 0, 18)`
- `minAltitude`: minimum target altitude
- `meanAltitude`: average target altitude

## Ranking Order (Lexicographic)

Candidates are compared in this order:

1. Higher `visibleCount`
2. Higher `elevatedCount`
3. Higher `darknessScore`
4. Higher `minAltitude`
5. Higher `meanAltitude`
6. Earlier timestamp

## Night Preference Rule (Mode-Aware)

Two best candidates are tracked:

- `bestNight`: best sample with Sun below horizon (`sunAltitude < 0°`)
- `bestAny`: best sample regardless of Sun altitude

Final choice:

- If `preferNightVisible=true`: use `bestNight` **only if** it has at least one visible target (`visibleCount > 0`), otherwise use `bestAny`.
- If `preferNightVisible=false`: always use `bestAny`.

This allows one shared selector for both analysis modes:
- **Visibility mode** uses `preferNightVisible=true`.
- **Geometry mode** uses `preferNightVisible=false` so daytime can be selected if it gives the best framing/visibility for the target set.

## Sun-Horizon Helper

`findFirstSunOnHorizon` searches nearby sunrise/sunset crossings inside the same evaluated day window (timezone-aware) and returns the one closest to `baseDate`.

`PlanetariumCameraController` keeps this helper as a fallback path when night preference is enabled; in all-day mode it is bypassed.

## Framing Strategy After Time Selection

`PlanetariumCameraController` then computes orientation/FoV:

1. Build a target-cluster frame from body azimuths (prefer above-horizon targets).
2. Build a visible ecliptic-arc frame from above-horizon ecliptic samples.
3. Use ecliptic-arc azimuth center when available (fallback: cluster center).
4. Select wide startup FoV:
   - baseline default: `100°`
   - startup clamp: `96°` to `118°`
5. Keep pitch near horizon context (roughly 8°–16° when cluster frame is available).

If no combo targets are active, the controller frames only the visible ecliptic arc for the current date.

## Trigger Rules

Default-time/framing effect runs on:

- Planetarium mount
- Active combo change
- Observer location change
- `timeZone` change
- Day-key change (`getTimeZoneDayKey(currentDate, timeZone)`)

It does **not** re-run for minute-level edits within the same evaluated day key, so manual camera orientation remains stable while nudging time.

## Why This Design

The algorithm avoids hardcoding a single Sun-altitude target (such as always `-12°` or `-15°`).
Instead, it optimizes visibility first, darkness second, altitude third, while respecting observer-local day boundaries when timezone is known. The night preference is a mode-level policy toggle, not a hard constraint.
