# Planet Parade

An advanced planetary alignment and sky-visualization platform for both real observing and orbital-geometry analysis. It combines ephemeris-grade astronomy, multi-mode ranking, interactive 3D/observer views, and timezone-aware planning workflows in a single browser app.

**Live:** [kvsankar.github.io/planet-parade](https://kvsankar.github.io/planet-parade/) | [sankara.net/astro/planet-parade](https://sankara.net/astro/planet-parade/)

## Screenshots

![Desktop](screenshots/planet-parade-desktop.png)

<p align="center">
  <img src="screenshots/planet-parade-mobile-portrait.png" alt="Mobile Portrait" width="240" />
  &nbsp;&nbsp;
  <img src="screenshots/planet-parade-mobile-landscape.png" alt="Mobile Landscape" width="480" />
</p>

## Key Use Cases

- **Plan naked-eye planet parades with practical confidence (`Visibility` mode):** Ranks windows by observing quality (PPI), not just geometry; useful for backyard observing, astronomy clubs, and public star parties.
- **Analyze conjunction geometry even when visibility is poor (`Geometry` mode):** Finds minimum-span clusters including Sun-straddling events; useful for orbital studies, research notes, and classroom demonstrations.
- **Choose between observer-first and headline-style rankings (`Practical` vs `Hyped`):** Compare realistic visibility against count-forward event framing; useful for outreach content and event curation.
- **Explore Sun/Moon-inclusive alignments in the same workflow:** Covers cases like Venus-Moon and Mars-Sun without switching tools; useful for comparative astronomy and conjunction case studies.
- **Plan by local civil time from your own location:** Applies timezone-aware local-day logic across minima tables, timeline peaks, and sky views; useful for travel observing and remote-session scheduling.
- **Pick AM vs PM opportunities quickly:** Separates pre-dawn and post-sunset combinations using per-combo classification; useful for night-by-night planning.
- **Validate events across synchronized views:** Cross-check the same date in tables, timeline, ecliptic strip, Solar System, planetarium, and sky charts; useful for teaching and analysis review.
- **Scout rare windows across long time ranges (up to 100 years):** Surface notable future events for planning and publishing calendars.
- **Use the app in the field on mobile (portrait + landscape):** Keep full analysis and sky context accessible away from desktop setups.

## Features (Typical Usage Flow)

### 1. Alignments Panel ([algorithm](docs/alignment-algorithm-analysis.md))
- Set the initial search inputs: mode, bodies, count range, and time range.
- `Visibility` mode analyzes Mercury-Neptune, excludes Sun-straddling combinations, and ranks by Planet Parade Index (PPI).
- `Geometry` mode allows Sun/Moon + planets, includes straddling combinations, and ranks by smallest angular span with intraday sampling.
- Use `Practical` and `Hyped` presets in Visibility mode to tune scoring intent.
- Review closest alignments and best combinations in sortable tables, then click records to drive all other panels.
- Day-level formatting and selection are timezone-aware when observer location is set.

### 2. Parade Timeline Panel ([PPI scoring](docs/planet-parade-index.md))
- Visualize ranking trends over months to decades to spot periods of interest.
- Use Simple mode for best-of-day tracking or Advanced mode for per-count traces.
- Zoom/pan for window discovery, then click any date to synchronize all views.
- Navigate local-day peaks with `Today`, `Prev`, and `Next`.

### 3. Exploration Panels

#### Ecliptic Strip
- Inspect ecliptic longitude/latitude clustering with per-kind shading and span annotations.
- Use the companion table for longitude, latitude, elongation, magnitude, and AM/PM classification.
- Pan/zoom longitude and resize chart-vs-table split for detailed inspection.

#### Space & Sky Panel (`Solar System` + `Planetarium`)
- `Solar System`: heliocentric 3D scene with orbit lines, labels, inner-planets inset, and Earth-based alignment cones.
- `Planetarium`: observer sky dome with horizon, cardinal markers, Alt/Az grid, dashed ecliptic, stars, Milky Way, and constellations.
- Shared star rendering model across all views keeps brightness/color treatment consistent.
- Planetarium startup is mode-aware and local-day-aware, with in-panel mini time controls for fine inspection.

#### Sky Charts ([Milky Way rendering](docs/milkyway-texture.md))
- Compare evening and morning hemispheres side by side with observer-aware framing.
- Toggle rich layers (stars, labels, constellations, ecliptic, Milky Way, atmosphere, Moon, and more).
- Uses the same atmosphere and star-photometry model as Planetarium for visual consistency.

## Getting Started

Use **Node 24.x LTS** (`.nvmrc` is included):

```bash
nvm use
```

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Other Commands

```bash
npm run build        # Type-check and production build
npm run preview      # Preview the production build
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run perf:install # Install Playwright Chromium (one-time)
npm run perf:profile # Automated profiling run + trace artifacts
npm run perf:profile:repeat # Repeated profiling runs + median summary
npm run perf:profile:check # Check median run against committed baseline thresholds
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 24.x LTS |
| UI Framework | React 19 + TypeScript |
| 3D Graphics | Three.js via @react-three/fiber and @react-three/drei |
| Charts | Recharts |
| Astronomy | astronomy-engine |
| Maps & Geocoding | Leaflet + OpenStreetMap tiles + Nominatim |
| Timezone Inference | tz-lookup (IANA zone from coordinates) |
| Panel Layout | react-rnd (desktop), custom tab bar (mobile) |
| Onboarding | driver.js |
| Build | Vite |
| Tests | Vitest |

Current major versions in this repo: React 19, Three.js 0.183, `@react-three/fiber` 9, `@react-three/drei` 10, Vite 7, TypeScript 5.9.

## Project Structure

```
src/
  components/
    scene/       Space & Sky renderers (Solar System + Planetarium)
    panels/      Floating panel wrappers (AlignmentPanel, ChartPanel, SkyViewPanel, SkyChartPanel)
    alignment/   Ecliptic Strip, Sky Charts renderer, timeline, planet picker, minima table
    ui/          Playback bars, planetarium mini controls, body selector, toggles, mobile tab bar, help button
  hooks/         State management, responsive hooks (useIsMobile, useIsLandscape),
                 guided tour (useTour), display settings, panel manager, planetarium view store
  lib/           Astronomy calculations, alignment/PPI math, atmosphere + visibility models, coordinate transforms
  data/          Star catalog, constellation lines, Milky Way polygons
  types.ts       Shared type definitions (CelestialBodyId, AlignmentTabDataPoint, etc.)
```

## Documentation

| Document | Description |
|----------|-------------|
| [Product Specification](docs/specs.md) | Complete feature requirements, design decisions, and project structure |
| [Planet Parade Index](docs/planet-parade-index.md) | PPI scoring formula, `Practical`/`Hyped` presets (Visibility mode), calibration, and design rationale |
| [Alignment Algorithm](docs/alignment-algorithm-analysis.md) | Combination-based alignment computation, classification logic, and validation |
| [Milky Way Texture](docs/milkyway-texture.md) | NASA Deep Star Maps source, EXR conversion, Three.js rendering, and WebGL shader reprojection |
| [Planetarium Default View](docs/planetarium-default-view.md) | Time-selection and framing algorithm for Planetarium startup (timezone-aware local-day scan, mode-aware night preference) |
| [Performance Profiling](docs/performance-profiling.md) | Automated Playwright-driven profiling harness with repeat-run medians, regression gating, and an optimization measures reference ledger |

## Data Sources

- **Star catalog** — 192 stars from the Yale Bright Star Catalogue / Hipparcos (J2000 epoch), including 26 named stars and all stars to magnitude ~3.0
- **Constellations** — 39 constellation stick figures with line segments connecting catalog stars
- **Milky Way** — Multi-layer polygon data from the d3-celestial project, pre-transformed to J2000 equatorial coordinates
- **Planetary ephemerides** — Computed at runtime by astronomy-engine using VSOP87 and other high-precision models

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

This project relies on the following open-source software:

- **[astronomy-engine](https://github.com/cosinekitty/astronomy)** — High-precision astronomical calculations by Don Cross
- **[Three.js](https://threejs.org/)** — 3D graphics library by mrdoob and contributors
- **[@react-three/fiber](https://github.com/pmndrs/react-three-fiber)** and **[@react-three/drei](https://github.com/pmndrs/drei)** — React bindings for Three.js by Poimandres
- **[Recharts](https://recharts.org/)** — Composable charting library for React
- **[react-rnd](https://github.com/bokuweb/react-rnd)** — Draggable and resizable component by bokuweb
- **[driver.js](https://driverjs.com/)** — Guided tour library by Kamran Ahmed
- **[d3-celestial](https://github.com/ofrohn/d3-celestial)** — Celestial map data including Milky Way polygons by Olaf Frohn
- **[Yale Bright Star Catalogue](http://tdc-www.harvard.edu/catalogs/bsc5.html)** — Stellar position and magnitude data
- **[Vite](https://vitejs.dev/)** — Frontend build tool
- **[Vitest](https://vitest.dev/)** — Unit testing framework
- **[React](https://react.dev/)** — UI library by Meta
- **[TypeScript](https://www.typescriptlang.org/)** — Typed JavaScript by Microsoft
