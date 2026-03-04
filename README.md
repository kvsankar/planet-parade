# Planet Parade

An interactive planetary alignment analyzer and sky visualization tool. Find the best dates to see multiple planets at once, visualize their positions in 3D, and explore the sky as seen from Earth — all in the browser.

**Live:** [kvsankar.github.io/planet-parade](https://kvsankar.github.io/planet-parade/) | [sankara.net/astro/planet-parade](https://sankara.net/astro/planet-parade/)

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
- Planetarium mode provides Stellarium-style drag/zoom navigation with horizon, cardinal markers, Alt/Az grid, dashed ecliptic, stars, Milky Way, and constellations
- Planetarium startup auto-selects the best instant inside the observer-local day (nighttime preferred, then overall best visibility sample if needed), then frames a wide horizon-to-horizon ecliptic view
- Planetarium includes independent mini time controls (play/pause, ±1/±5 min, 1 min/s to 1 hr/s), separate from the main playback bar
- Observer location is progressive/opt-in and user-triggered: set via browser geolocation permission, OpenStreetMap map/search widget, or manual coordinates
- Timezone is inferred from chosen observer coordinates, persisted with location state, and used in sky-time labels/day boundaries (UTC fallback)

### Planetary Alignments ([algorithm](docs/alignment-algorithm-analysis.md))
- Select any combination of planets and compute the tightest cluster for every combination size
- Combination-based classification: AM (pre-dawn), PM (post-sunset), or Straddling (spanning the Sun)
- Tabbed results by combination size (e.g. best 7, best 6, best 5 from 7 selected)
- Automatic detection of closest-alignment dates with sortable minima table
- Day-level combo detail and date formatting follow observer local day when a timezone is available
- Planet count filter chips, planet symbols with tooltips, click-to-navigate and switch tabs
- Configurable time ranges from 3 months to 100 years

### Parade Timeline ([PPI scoring](docs/planet-parade-index.md))
- Interactive time-series chart plotting PPI and angular span over time
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
- Shared atmosphere model with Planetarium: sunlight/twilight/moonlight sky wash, star attenuation, and Milky Way attenuation
- Toggleable layers: Stars, Milky Way, Atmosphere, Star Labels, Planet Labels, Moon, Constellation Edges, Constellation Labels, Alt/Az Grid, Ecliptic
- Milky Way style switch: `Poly` (d3-celestial polygons) or `Tex` (NASA texture), default `Tex`
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
| [Planet Parade Index](docs/planet-parade-index.md) | PPI scoring formula, presets, parameter sweep calibration, and design rationale |
| [Alignment Algorithm](docs/alignment-algorithm-analysis.md) | Combination-based alignment computation, classification logic, and validation |
| [Milky Way Texture](docs/milkyway-texture.md) | NASA Deep Star Maps source, EXR conversion, Three.js rendering, and Web Worker reprojection |
| [Planetarium Default View](docs/planetarium-default-view.md) | Time-selection and framing algorithm for Planetarium startup (timezone-aware local-day scan, visibility/darkness ranking) |

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
