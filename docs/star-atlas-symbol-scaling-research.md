# Star Atlas Symbol Scaling Research

## Purpose

Document how reputable printed and online star atlases encode star brightness, then map those practices to concrete rendering improvements for Planet Parade.

Research date: 2026-03-08

## What Reputable Atlases Commonly Do

### Printed atlases

1. Printed atlases use **discrete symbol classes** for magnitudes, not a continuous physically exact photometric scale.
2. The official Pocket Sky Atlas legend shows magnitude classes from about `-1` through `+7`, each with a distinct dot size.
3. Printed atlases choose an intentional limiting magnitude for readability and page density.

### Online/interactive atlases

1. Modern tools expose separate controls for:
- limiting magnitude (how many stars are shown),
- absolute star size (overall symbol size),
- relative star scale (how strongly bright stars differ from faint stars).
2. These controls are intentionally decoupled. Users can increase spread without necessarily changing star count.
3. Several tools also expose star label density separately from symbol density.

## Sources

- Pocket Sky Atlas legend (official): https://skyandtelescope.org/wp-content/uploads/PSA_Key.pdf
- Sky & Telescope on atlas depth/use: https://skyandtelescope.org/astronomy-resources/using-a-map-at-the-telescope/
- Stellarium `StelSkyDrawer` docs (relative scale, absolute scale, mag limits): https://stellarium.org/doc/25.0/classStelSkyDrawer.html
- KStars handbook (star density, label density, mag limit): https://kstars-docs.kde.org/en/user_manual/catalogs.html
- Cartes du Ciel manual (star appearance mode, mag-limit controls): https://www.ap-i.net/pub/skychart/doc/doc_en.pdf
- SkySafari chart settings (star symbols and magnitude limit controls): https://support.simulationcurriculum.com/hc/en-us/articles/360016461592-How-do-I-adjust-the-look-of-the-sky-chart
- Taki Atlas 8.5 manual (print-atlas style and symbol framework): https://ozsky.org/resources/Toshimi_Taki_Mag_8.5_Atlas/manual_060107.pdf

## Current Planet Parade Behavior (Code Reality)

### Shared star size law

`src/lib/starAppearance.ts` currently uses a linear mapping:

- `magnitudeToSpriteSize(m) = clamp(3.0 - 0.5*m, 1.0, 5.0)`
- `magnitudeToCanvasRadius(m) = clamp(3.5 - 0.55*m, 1.0, 6.0)`

This creates only moderate separation between bright and faint objects.

### Where this is used

1. 3D stars (`RealStars`) use `magnitudeToSpriteSize` and then apply atmospheric attenuation.
2. Sky chart stars use shared photometry + `canvasRadiiFromEffectiveMagnitude`.
3. Sky chart planet dots still use `magnitudeToCanvasRadius`.
4. Planetarium planet meshes are mostly fixed by `BODY_SIZE` constants, with opacity driven by visibility/contrast.

### Current user brightness levels

`low/med/high` already exist, but they primarily scale global brightness/visibility. They do not strongly increase the bright-vs-faint diameter spread by magnitude.

## Gap Analysis

1. Atlas convention says users need separate control over count vs size vs spread. We mostly expose global brightness level.
2. Bright stars and bright planets are not yet separated enough in apparent diameter versus faint objects, especially on mobile.
3. Planetarium planets are still largely fixed-size markers, so magnitude hierarchy is weaker there than in chart layers.

## Improvement Plan for Planet Parade

### Phase 1: Introduce a shared magnitude transfer function

Goal: stronger, atlas-like spread while preserving readability.

1. Replace linear diameter mapping with a non-linear flux-based mapping anchored to magnitude range `-4` to `+6.5`.
2. Keep hard min/max clamps per view, but widen spread between bright and faint bins.
3. Export one shared helper for stars and planet symbols so all panels stay consistent.

Candidate function (design target):

```ts
// Pseudocode
flux = 10 ** (-0.4 * mag)
size = minSize + gain * (flux ** gamma)
// gamma in ~0.20-0.35 for perceptual compression
```

### Phase 2: Add atlas-style stepped classes for 2D charts

Goal: improve legibility and match printed-atlas expectations.

1. Quantize effective magnitudes into bins (for example 8-9 bins).
2. Map bins to pre-tuned radii, larger step jumps at the bright end.
3. Keep this in charts; optionally keep continuous scaling in 3D if visual motion looks better.

### Phase 3: Make Planetarium planet sizing magnitude-aware

Goal: align Planetarium with Sky Charts and user expectation.

1. Keep per-body identity baseline (Jupiter should not become tiny versus Mercury arbitrarily).
2. Multiply baseline by a magnitude-based factor with strict clamps.
3. Use the same effective magnitude pipeline already used for opacity so size and brightness tell one coherent story.

### Phase 4: Reframe `Low/Med/High` as atlas-style presets

Goal: make user controls predictable and meaningful.

1. `Low`: conservative spread, dense scenes remain stable.
2. `Med` (default): balanced spread, clear bright-object emphasis.
3. `High`: strongest spread and larger bright objects for quick visual scanning.

Implementation detail: presets should tune two independent internals:

1. `absoluteScale` (overall point size),
2. `relativeSpread` (how much bright objects are enlarged relative to faint ones).

### Phase 5: Validation and tuning

Goal: avoid regressions and ensure cross-panel consistency.

1. Create fixed test timestamps and locations (dark sky, twilight, moonlit).
2. Capture snapshots for Planetarium + Sky Charts on desktop and mobile widths.
3. Validate target ratios, for example:
- `mag -4` object diameter at least `3x` to `5x` of `mag +4` at default,
- no over-blooming that obscures constellation context,
- readable faint stars remain visible in dark-sky mode.

## Recommended Next Build Sequence

1. Implement Phase 1 first (shared transfer function).
2. Apply it to Sky Chart planets and 3D stars immediately.
3. Then do Phase 3 for Planetarium planets.
4. Add stepped-chart mode and preset tuning last.

This order gives visible improvement quickly while minimizing breakage risk.
