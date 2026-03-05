# Planet Parade

An advanced planetary alignment analysis and sky-visualization platform. It combines ephemeris-grade astronomy, multi-mode ranking, interactive 3D/observer views, and timezone-aware planning workflows in a single browser app.

**Live:** [kvsankar.github.io/planet-parade](https://kvsankar.github.io/planet-parade/) | [sankara.net/astro/planet-parade](https://sankara.net/astro/planet-parade/)

## Use Cases

| Use Case | Why It Matters | Where It Is Used |
|----------|----------------|------------------|
| Naked-eye planet parade planning (`Visibility` mode) | Ranks events by practical viewing quality (PPI), not just geometry, so observers get realistic targets | Backyard observing, astronomy clubs, public star parties |
| Pure conjunction geometry analysis (`Geometry` mode) | Finds the tightest angular clusters even when events are not easy to see, including Sun-straddling setups | Research notes, orbital-geometry study, educational demonstrations |
| Practical vs headline ranking comparison (`Practical` vs `Hyped`) | Lets you choose between observer-first scoring and count-forward "big event" scoring | Media/editorial planning, outreach content, event curation |
| Sun/Moon-inclusive event exploration | Supports Venus-Moon, Mars-Sun, and similar pair/group studies in the same workflow as planets | Conjunction case studies, classroom examples, comparative astronomy |
| Observer-location and timezone-aware planning | Keeps date boundaries, minima, and navigation aligned to local civil time | Travel observing, remote observatory scheduling, local meetup planning |
| Morning vs evening session selection (AM/PM classification) | Separates pre-dawn and post-sunset opportunities for actionable observing windows | Daily observing plans, beginner guidance, night-by-night scheduling |
| Multi-view validation across synchronized panels | Cross-checks the same event in timeline, strip, sky charts, and 3D scene to reduce misinterpretation | Teaching labs, analysis reviews, debugging or validating model behavior |
| Long-horizon event scouting (up to 100 years) | Enables strategic discovery of rare or notable future alignment windows | Long-term calendars, curriculum planning, astronomy publishing |
| Mobile in-field usage (portrait + landscape) | Keeps core analysis available while outside at the telescope or during travel | On-site observing, outreach booths, quick checks away from desktop |

## Screenshots

![Desktop](screenshots/planet-parade-desktop.png)

<p align="center">
  <img src="screenshots/planet-parade-mobile-portrait.png" alt="Mobile Portrait" width="240" />
  &nbsp;&nbsp;
  <img src="screenshots/planet-parade-mobile-landscape.png" alt="Mobile Landscape" width="480" />
</p>

## Features

### Space & Sky Panel
- Two scene modes in one panel: `Solar System` (heliocentric 3D) and `Planetarium` (observer sky dome)
- Solar System mode shows all planets with orbit lines, labels, inner-planets inset, and per-kind alignment cones from Earth
- Shared star rendering model across all views (Solar System, Planetarium, Sky Charts): common spectral color mapping, magnitude sizing law, and core+halo appearance profile
- Mode-aware star photometry: `Solar System` uses space mode (no atmospheric extinction/twilight wash), while `Planetarium` uses atmospheric mode (extinction + sky wash)
- Planetarium mode provides Stellarium-style drag/zoom navigation with horizon, cardinal markers, Alt/Az grid, dashed ecliptic, stars, Milky Way, and constellations
- Planetarium startup auto-selects the best instant inside the observer-local day, then frames a wide horizon-to-horizon ecliptic view
- Startup time selection is mode-aware: `Visibility` mode prefers night if a usable target set is visible; `Geometry` mode picks the best overall sample (day or night)
- Planetarium includes independent mini time controls (play/pause, ±1/±5 min, 1 min/s to 1 hr/s), separate from the main playback bar
- Observer location is progressive/opt-in and user-triggered: set via browser geolocation permission, OpenStreetMap map/search widget, or manual coordinates
- Timezone is inferred from chosen observer coordinates, persisted with location state, and used in sky-time labels/day boundaries (UTC fallback)

### Planetary Alignments ([algorithm](docs/alignment-algorithm-analysis.md))
- Two analysis modes: `Visibility (PPI)` and `Geometry (Span)`
- `Visibility` mode analyzes Mercury–Neptune only, excludes Sun-straddling combinations, and ranks by Planet Parade Index (PPI)
- `Geometry` mode allows Sun/Moon plus planets, includes straddling combinations, and ranks by smallest angular span using intraday sampling across the full local day
- Geometry mode default starter is `Venus + Moon` with count range `2–2` for fast switching; you can expand bodies/counts as needed
- Visibility-mode Parade Scoring presets are `Practical` (default) and `Hyped` (count-forward)
- Combination-based classification: AM (pre-dawn), PM (post-sunset), or Straddling (spanning the Sun)
- Per-count evaluation across a selectable body-count range (e.g. best 7, best 6, best 5)
- Automatic detection of closest-alignment dates with sortable minima table
- Day-level combo detail and date formatting follow observer local day when a timezone is available
- Planet count filter chips, planet symbols with tooltips, and click-to-navigate
- Configurable time ranges from 3 months to 100 years

### Parade Timeline ([PPI scoring](docs/planet-parade-index.md))
- Interactive time-series chart plotting ranking metrics over time
- Visibility mode is PPI-first (with span context); Geometry mode is span-first (PPI hidden/disabled)
- Simple mode (overall best-of-day) and Advanced mode (per-count lines with toggleable count chips)
- Zoom and pan with mouse drag, Ctrl+wheel, or pinch gestures
- Click-to-navigate to any date; current-date indicator with PPI, span, and planet list
- Jump-to-peak buttons (Today/Prev/Next) navigate by observer-local day keys when timezone is set

### Ecliptic Strip
- Scatter plot of planet positions in ecliptic longitude and latitude
- Centerable on ecliptic longitude 0° or the Sun
- Per-kind shading bands (AM/PM/Straddle) with span annotations showing angular extent
- Non-combo planets dimmed to highlight the active cluster
- Planetary data table with ecliptic longitude, latitude, elongation, visual magnitude, and AM/PM sky classification
- Draggable separator to resize chart vs table; table toggleable
- X-axis zoom/pan with pinch and drag support

### Sky Charts ([Milky Way rendering](docs/milkyway-texture.md))
- Dual azimuthal-equidistant hemispheres for evening and morning reference frames
- Reference frame can be anchored by Sun altitude presets (`0°`, `-6°`, `-12°`) with a visible badge
- Observer location is shared with Planetarium and can be changed on demand from Sky Charts controls
- Sunrise/sunset anchors and AM/PM labels are computed from the current observer-local day window
- Sun, Moon (phase with sun-facing limb), planets, 192 stars, 39 constellations, dashed ecliptic, and Milky Way
- Shared atmosphere and star-photometry model with Planetarium: sunlight/twilight/moonlight sky wash, star attenuation, and Milky Way attenuation
- Stars are rendered via cached sprite stamps derived from the shared star profile, so Sky Charts visually track Planetarium/Solar System star styling while staying performant
- Toggleable layers: Stars, Milky Way, Atmosphere, Star Labels, Planet Labels, Moon, Constellation Edges, Constellation Labels, Alt/Az Grid, Ecliptic
- Milky Way style switch: `Poly` (d3-celestial polygons) or `Tex` (NASA texture), default `Tex`
- Poly and Tex Milky Way modes are playback-time-synchronized so switching styles does not introduce drift during animation
- Panel-level zoom/pan with touch support; mobile landscape can zoom out enough to show the full sky circle
- Desktop supports paired charts (default) or optional tabbed view; mobile uses AM/PM tabs

### Cross-Platform
- Desktop: draggable, resizable floating panels with z-ordering
- Mobile: full-screen tabbed interface with compact controls
- Desktop can emulate mobile-landscape layout via a playback-bar toggle
- Mobile landscape: two-column layouts for Align (controls | minima table) and Ecliptic Strip (chart | data table); full-width sky chart circle
- Scene tab behavior matches mode: Solar System shows main scene controls, Planetarium shows only the in-panel planetarium controls
- Touch gestures throughout (pinch-to-zoom, drag-to-pan)
- Guided tour with Quick Tour and Full Tour modes; auto-starts on first visit

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
