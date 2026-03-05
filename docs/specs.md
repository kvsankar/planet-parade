# Planet Parade — Specification

## 1. Purpose

Planetary alignment events — like the Feb 2025 and Feb 2026 "planet parades" — generate enormous media hype, but the reality is often underwhelming: planets spread across 90+ degrees of sky, some too faint to see, some lost in twilight. This app lets users investigate alignments themselves with real astronomical data.

The core question it answers: **When can I see the most planets at once without spending hours outside?**

If you observe the sky for 24 hours, all planets are visible (ignoring twilight/Sun/Moon effects). But can you see most of them at a single point in time — in the evening sky, or the morning sky? If not all, then how many, and when? Planet Parade lets you explore and find those times across months, years, or decades.

The target audience is astronomy educators, science communicators, and curious hobbyists — people who want to cut through hype and understand what planetary alignments really look like and when they actually happen.

---

## 2. Features

### 2.1 Alignment Analysis (Primary Feature)

The alignment analyzer is the heart of the app. The user selects bodies, defines a time range, and the app computes how tightly those bodies cluster in the sky over time.

#### Planet selection

Body availability is mode-dependent:

- **Visibility (PPI) mode**: Mercury through Neptune (7 planets).
- **Geometry (Span) mode**: Sun, Moon, and Mercury through Neptune (9 bodies).
- **Geometry default starter**: `Venus + Moon` with combination range `2–2` (optimized for responsive mode switching).

Any combination of at least 2 bodies can be selected within the active mode's allowed set.

#### Time range

- **Start date**: any date in the 1975–2075 range.
- **Duration presets**: 3 months, 6 months, 1, 2, 5, 10, 20, 50, or 100 years.
- **Custom duration**: exact number of days, months, or years.

#### Combination-based alignment analysis

The app uses a combination-based approach: given N selected bodies, it evaluates every k-body combination (where k ranges from N down to a user-set minimum) and finds the tightest ecliptic longitude cluster for each.

Each combination is classified as a whole unit based on its relationship to the Sun:

- **Morning (AM)**: all planets in the combination are west of the Sun (visible before sunrise).
- **Evening (PM)**: all planets in the combination are east of the Sun (visible after sunset).
- **Straddling**: the Sun falls inside the combination's ecliptic arc — planets span both sides of the Sun and cannot all be seen in a single pre-dawn or post-sunset session.

For each day and combination size, the app reports the tightest span per category across all combinations of that size. Day-level detail and date labels are keyed to observer-local day when a timezone is available (UTC fallback).

#### Ranking modes

- **Visibility (PPI)**:
  - Excludes straddling combinations from scoring.
  - Ranks results by Planet Parade Index (PPI), with span as supporting context.
  - Exposes Parade Scoring presets `Practical` (default) and `Hyped`, plus manual weight sliders.
- **Geometry (Span)**:
  - Includes straddling combinations.
  - Ranks results by smallest angular span (PPI disabled).
  - Uses intraday sampling across the full local day (daytime allowed) to pick best geometry.

#### Minimum planet count

The user can set a combination-size range to analyze (minimum and maximum). With 7 selected bodies and range 5–7, the app computes/plots 7-, 6-, and 5-body combinations.

#### Closest alignments

The app automatically finds ranked event dates (PPI peaks or span minima, depending on mode). These are shown in a sortable table with body count, body symbols (hover for names), span, category, and score context. Clicking a row jumps the entire app to that date. Previous/Next buttons follow observer-local day ordering.

#### Colors

Consistent across all views:
- **AM**: warm golden orange (evoking sunrise)
- **PM**: deep indigo blue (evoking night sky)
- **Straddling**: light red (cluster spans the Sun)

### 2.2 Parade Timeline

An interactive line chart plotting the active ranking metrics over time (see [planet-parade-index.md](planet-parade-index.md)). Visibility mode is PPI-first with span context; Geometry mode is span-first (PPI disabled). Simple mode shows the overall best-of-day line; Advanced mode shows per-count lines with toggleable count chips.
- Click any point to jump to that date.
- Zoom (Ctrl+scroll, pinch) and pan (drag) when zoomed.
- Current-date indicator (vertical line) shows PPI, span, and planet list.
- Navigation mode (PPI peaks or Span minima) with Today/Prev/Next buttons; Geometry mode defaults to Span minima.
- Peak/minima navigation deduplicates by local day key when observer timezone is available.

### 2.3 Ecliptic Strip (Ecliptic Projection)

A 2D scatter plot of planet positions in ecliptic longitude (X) and latitude (Y):

- **Center modes**: Longitude 0° at center, or Sun at center.
- **Per-kind shading bands**: colored regions show the best AM, PM, and Straddling cluster spans with degree annotations. In Visibility mode, straddling is context-only (not ranked); in Geometry mode it participates in ranking.
- **Active-combo emphasis**: bodies not in the active combination are dimmed.
- **Zoom/pan**: X-axis zoom (1–16×) with drag and pinch support.
- **Planet data table**: ecliptic longitude, latitude, elongation from Sun, visual magnitude, and AM/PM classification for each body.

### 2.4 Sky Charts (Azimuthal Equidistant Projection)

Dual hemispheric sky charts showing evening and morning reference frames from a default observer latitude (equator by default, user-overridable via opt-in location controls), with virtual longitudes chosen so the Sun is at a selected altitude:

- **Projection**: azimuthal equidistant — zenith at center, horizon at edge, cardinal directions labeled.
- **Reference frame presets**: Sun altitude pills (`0°`, `-6°`, `-12°`) plus a badge showing the active preset.
- **Rendered elements**: Sun, Moon (with physically oriented phase limb), planets, 192 bright stars (with spectral color), 39 constellation stick figures and labels, dashed ecliptic curve, Milky Way.
- **Milky Way rendering**: two modes toggled via `[Poly | Tex]` pills:
  - Polygons — multi-layer SVG fills from d3-celestial data.
  - Texture — real-time reprojection of a NASA Deep Star Maps JPEG (Gaia DR2, 1.7 billion stars) via Web Worker.
- **Atmosphere model**: optional integrated sunlight/twilight/moonlight rendering shared with Planetarium; dims stars/planets and attenuates Milky Way contrast.
- **Star appearance parity**: Sky Charts reuse the shared star-photometry/appearance pipeline (spectral color, effective magnitude, contrast, local sky wash), rendered through cached sprite stamps for 2D performance.
- **Toggleable layers**: Stars, Milky Way, Atmosphere, Star Labels, Planet Labels, Moon, Constellation Edges, Constellation Labels, Alt/Az Grid, Ecliptic.
- **Layout modes**: desktop paired AM/PM charts by default with optional tabbed mode; mobile always tabbed.
- **Zoom/Pan**: 1–16× with mouse/touch. Mobile landscape allows zooming out enough to fit the full circular sky.
- **Local-day anchoring**: sunrise/sunset labels and moon/magnitude daily sampling are evaluated in observer-local day boundaries when timezone is known (UTC fallback).

### 2.5 Space & Sky Panel

The Scene panel has two tabs: **Solar System** and **Planetarium**.

#### Solar System tab

- **Accurate positions**: computed from `astronomy-engine` ephemeris data (VSOP87 models) in ecliptic coordinates, to-scale in AU.
- **Orbits**: one full orbital period per body, toggleable.
- **Labels**: toggleable, with overlap detection.
- **Dynamic sizing**: bodies maintain a consistent apparent pixel size regardless of zoom.
- **Per-kind alignment cones**: when alignment analysis is active, separate cones from Earth visualize the best AM (orange), PM (blue), and Straddling (grey) clusters for the active combo.
- **Celestial background** (all toggleable):
  - NASA Deep Star Maps Milky Way sphere (custom ShaderMaterial, see `docs/milkyway-texture.md`).
  - 192 bright stars with accurate B-V color mapping, rendered in explicit `space` mode (no atmospheric extinction/twilight wash).
  - 39 constellation stick figures.
  - IAU constellation boundary lines.
- **Camera**: rotate (drag), zoom (scroll), pan (right-drag). Body selection animates camera toward the body. Follow mode tracks the selected body continuously.
- **Inner planets**: auto-hide when zoomed far out to avoid crowding; toggleable override.

#### Planetarium tab

- **Observer-centric sky dome** with horizon, cardinal markers, Alt/Az grid (15° intervals), dashed ecliptic, stars, Milky Way, constellations, Sun/Moon/planets.
- **Integrated atmosphere** shared with Sky Charts (daylight, twilight, moonlight wash and attenuation), including atmospheric star photometry mode.
- **Stable interaction model**: drag rotates the full sky frame (not independent overlays), axis-lock behavior reduces accidental horizon tilt, wheel/pinch zoom uses FoV range 20°–120°.
- **Deterministic startup framing**: on mount/day-key/location/combo context changes, evaluates the observer-local day (5-minute samples), then picks a best sample using mode-aware policy: Visibility mode prefers usable nighttime slots, Geometry mode allows all-day best picks. It then frames a wide horizon-to-horizon ecliptic view (see `docs/planetarium-default-view.md`).
- **Observer location control**: user-invoked only; supports browser geolocation permission prompt, OpenStreetMap map/search selection, and manual coordinate entry.
- **Timezone inference**: infer IANA timezone from observer coordinates for local sunrise/sunset, panel time labels, and day-keyed date navigation (fallback UTC).

### 2.6 Time Controls

Two complementary control layers:

- **Global playback bar** (shared app timeline):
  - Date picker, timeline slider, play/pause, speed presets (1–3650 d/s), ±1/±5 day, Today, Prev/Next.
  - Changes update all panels in sync.
- **Planetarium mini controls** (local to Planetarium tab):
  - ±1/±5 minute stepping, local play/pause, speeds from 1 min/s to 1 hr/s.
  - Intentionally independent from global play/pause state.
  - Auto-offsets vertically to avoid overlap with playback/tab bars.

### 2.7 Responsive Layout

- **Desktop**: floating, draggable, resizable panels with z-ordering. All five views visible simultaneously.
- **Desktop mobile emulation**: playback bar toggle can switch to a landscape-mobile style layout for testing.
- **Mobile (portrait)**: tabbed interface — Align, Timeline, Scene, Sky, Charts. One panel at a time.
- **Mobile scene behavior**: Scene tab supports Solar System and Planetarium sub-tabs; each mode shows only its relevant control overlay.
- **Mobile (landscape)**: two-column layouts where appropriate (chart + table, controls + results).
- **Touch**: pinch-to-zoom and drag-to-pan on all interactive charts.

### 2.8 Guided Tours

- Quick Tour (introductory) and Full Tour (comprehensive), powered by `driver.js`.
- Auto-launches on first visit.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID    | Requirement |
|-------|-------------|
| FR-1  | The user shall be able to select a subset of analyzable bodies and compute their ecliptic span behavior over a configurable time range using combination-based analysis. |
| FR-2  | The app shall provide two ranking modes: Visibility (PPI, straddling excluded) and Geometry (span-first, straddling included). |
| FR-3  | The app shall classify each combination as morning (all west of Sun), evening (all east of Sun), or straddling (Sun inside the arc) and compute separate category series. |
| FR-4  | The app shall present ranked event dates (PPI peaks or span minima, mode-dependent) in a navigable table with body symbols and sortable metrics. |
| FR-5  | The user shall be able to set minimum/maximum combination size; timeline/chart views shall support per-count breakdowns. |
| FR-6  | An interactive timeline chart shall display mode-appropriate ranking metrics with zoom, pan, and click-to-navigate. |
| FR-7  | A sky view shall plot body positions in ecliptic longitude/latitude with per-kind shading bands and span annotations. Non-active-combo bodies shall be dimmed. |
| FR-8  | A body data table shall show ecliptic longitude, latitude, elongation, visual magnitude, and AM/PM classification. |
| FR-9  | Dual azimuthal-equidistant sky charts shall show evening/morning Sun-referenced frames with stars, constellations, Milky Way, Moon phase, and planets. |
| FR-10 | The Milky Way shall be renderable in both polygon and NASA texture modes, toggled by the user. |
| FR-11 | A 3D solar system view shall display all bodies at their real heliocentric positions with to-scale orbits. |
| FR-12 | Per-kind alignment cones from Earth shall visualize the best AM, PM, and Straddling clusters for the active combo in the 3D view. |
| FR-13 | The celestial background shall include real stars, constellation lines, and constellation boundaries, all toggleable. |
| FR-14 | Body positions shall be computed from astronomical ephemeris data for the current simulation date. |
| FR-15 | The user shall be able to control the simulation date via date picker, timeline slider, or animated playback with selectable speed. |
| FR-16 | The simulation date range shall span 1975-01-01 to 2075-01-01. |
| FR-17 | Animation shall update positions every render frame for smooth motion. |
| FR-18 | Clicking a body shall select it and animate the camera toward it; Follow mode shall track it continuously. |
| FR-19 | The Scene panel shall provide a Planetarium mode with horizon/cardinal framing and stable drag/zoom controls. |
| FR-20 | Planetarium startup shall auto-select a deterministic best-view instant using mode-aware policy (night-preferred in Visibility mode; all-day best in Geometry mode). |
| FR-21 | Observer location changes shall be user-invoked only (browser permission, map/search, or manual coordinates), with inferred timezone applied to day-keyed labels/navigation and sky-day computations. |

### 3.2 Non-Functional Requirements

| ID     | Requirement |
|--------|-------------|
| NFR-1  | The app shall run in modern desktop browsers (Chrome, Firefox, Edge, Safari) and on mobile. |
| NFR-2  | Animation shall maintain 60 fps on mid-range hardware. |
| NFR-3  | Ephemeris computations shall be cached to avoid redundant recalculation during animation. |
| NFR-4  | Expensive computations (Milky Way texture reprojection) shall be offloaded to Web Workers. |
| NFR-5  | The app shall be a single-page client-side application with no backend. |
| NFR-6  | Desktop shall use floating draggable panels; mobile shall use a tabbed interface with landscape-optimized layouts. |

---

## 4. Design Decisions

These are architectural and technology choices — not requirements. Alternative choices could satisfy the same needs.

- **Tech stack**: Vite + React + TypeScript, with Three.js via `@react-three/fiber` and `@react-three/drei`. Recharts for the alignment timeline.
- **Runtime/tooling baseline**: Node 24.x LTS; React 19; Three.js 0.183; `@react-three/fiber` 9; `@react-three/drei` 10; Vite 7; TypeScript 5.9.
- **Performance reference ledger**: `docs/performance-profiling.md` includes a maintained "Optimization Measures (Reference)" section with commit-traceable runtime and CI profiling optimizations.
- **Ephemeris**: `astronomy-engine` npm package. Geocentric ecliptic coordinates for alignment computations, J2000 equatorial for star/sky positions.
- **Alignment algorithm**: combination-based — evaluates every k-body combination, classifies each as AM/PM/Straddling based on whether the Sun falls inside the ecliptic arc, and reports tightest spans per category per day.
- **Mode model**: Visibility mode applies PPI ranking with straddling excluded; Geometry mode applies span ranking with straddling included and Sun/Moon selectable.
- **Coordinate pipeline**: J2000 equatorial (EQJ) from astronomy-engine → ecliptic rotation (23.44° obliquity) → Three.js Y-up mapping.
- **Scale**: 1 AU = 10 scene units. Celestial sphere radius = 950.
- **State management**: React contexts for UI state; a module-level mutable store for the live simulation date shared between React and the Three.js render loop.
- **Animation**: time advanced in Three.js `useFrame` loop. Per-frame position updates from the shared store. React UI updated at throttled rate (~10/sec).
- **Planetarium view model**: drag updates a shared yaw/pitch store applied to a parent scene group, so sky layers and horizon remain rigidly aligned.
- **Planetarium default-time strategy**: timezone-aware day-window scan (5-minute steps), lexicographic ranking by visibility/darkness/altitude, with mode-aware night preference (Visibility mode prefers night, Geometry mode allows all-day best). See `docs/planetarium-default-view.md`.
- **Observer location/timezone model**: progressive opt-in location picker (browser/OSM/manual), persisted `ObserverLocationState`, and inferred IANA timezone (`tz-lookup`) with UTC fallback.
- **Local day-key model**: shared `timeZoneDay` helpers drive chart/minima day grouping, peak navigation, and day-bound sky computations for Planetarium/Sky Charts.
- **Sky chart reference frame**: virtual longitudes selected via `sunHorizonLongitude` so Sun is at configurable reference altitude (`0°`, `-6°`, `-12°`) rather than fixed civil sunrise/sunset.
- **Atmosphere rendering**: shared sky-visibility and chromatic atmosphere model used by both Planetarium and Sky Charts.
- **Star rendering model**: shared `starAppearance` pipeline across Solar System, Planetarium, and Sky Charts with explicit photometry modes (`space` vs `atmospheric`) and renderer-adaptive outputs (3D shader points vs 2D sprite stamps).
- **Sky chart texture**: Web Worker with inline blob source, shared across chart instances with reference counting and instance-ID isolation. See `docs/milkyway-texture.md`.
- **Milky Way sphere**: custom ShaderMaterial bypassing Three.js color management. `phiStart=π` on SphereGeometry for RA alignment.
- **Asset paths**: `import.meta.env.BASE_URL` prefix for all `public/` assets (Vite `base: './'`).
- **Responsive layout**: `react-rnd` for desktop panels. Tab bar + two-column landscape layouts for mobile.
- **Onboarding**: `driver.js` guided tours.

---

## 5. Project Structure

```
src/
├── App.tsx                    Main app, context providers, desktop/mobile layout
├── App.css                    Global styles
├── types.ts                   CelestialBodyId, AlignmentTabDataPoint, AlignmentKind, etc.
├── constants.ts               Body metadata, speed/time presets, colors, formatting
├── components/
│   ├── scene/                 Space & Sky renderers (Solar System + Planetarium)
│   │   ├── SolarSystemScene.tsx   Canvas setup, camera, scene wrapper
│   │   ├── CelestialBody.tsx      Planet mesh with dynamic sizing and labels
│   │   ├── Sun.tsx                Central star
│   │   ├── OrbitLine.tsx          Orbital path line segments
│   │   ├── AlignmentCones.tsx     Per-kind 3D cones (AM/PM/Straddling) from Earth
│   │   ├── CameraController.tsx   OrbitControls, follow mode, selection animation
│   │   ├── InnerPlanetsInset.tsx   Zoomed-in inner-planets view
│   │   ├── PlanetariumScene.tsx   Observer sky dome wrapper + layer controls
│   │   ├── PlanetariumCameraController.tsx  Drag/zoom + default framing logic
│   │   ├── PlanetariumWorldRotation.tsx  Sidereal sky rotation in observer frame
│   │   ├── PlanetariumHorizon.tsx  Horizon ring, ground dome, NESW labels
│   │   ├── PlanetariumAltAzGrid.tsx  15° Alt/Az grid lines and labels
│   │   ├── PlanetariumEclipticGrid.tsx  Dashed ecliptic in horizontal coordinates
│   │   ├── PlanetariumPlanets.tsx  Sun/Moon/planet sprites + labels + attenuation
│   │   ├── PlanetariumAtmosphere.tsx  Sky tint + twilight glow dome
│   │   ├── MilkyWaySphere.tsx     NASA texture background sphere
│   │   ├── RealStars.tsx          192-star point sprites with B-V colors
│   │   ├── ConstellationLines3D.tsx   39 constellation stick figures
│   │   └── ConstellationBoundaries3D.tsx  IAU boundary dashed lines
│   ├── panels/                Floating wrappers (desktop) + sheet panels (mobile)
│   │   ├── AlignmentPanel.tsx     Ranking mode toggle, body picker, time range, scoring controls, minima table
│   │   ├── ChartPanel.tsx         Mode-aware ranking timeline (PPI/span) with zoom/pan and count toggles
│   │   ├── SkyViewPanel.tsx       Ecliptic scatter chart + planet data table
│   │   ├── SkyChartPanel.tsx      Dual sky charts with layer toggles
│   │   └── FloatingPanel.tsx      Desktop panel shell (react-rnd)
│   ├── alignment/             Charts, pickers, tables, sky views
│   │   ├── StereoSkyChart.tsx     Core azimuthal equidistant projection SVG renderer
│   │   ├── MilkyWayTextureCanvas.tsx  Web Worker texture reprojection
│   │   ├── SeparationChart.tsx    Recharts ranking timeline (mode-aware per-count lines)
│   │   ├── SkyView.tsx            Ecliptic scatter + shading bands
│   │   ├── PlanetPicker.tsx       Multi-select body checkboxes
│   │   ├── TimeRangeSelector.tsx  Start date + duration presets
│   │   ├── PlanetCountRange.tsx   Min/max planet count range selector
│   │   ├── PPISliders.tsx         Visibility-mode PPI sliders with Practical/Hyped presets
│   │   ├── PlanetaryDataTable.tsx Ecliptic coordinates, magnitude, AM/PM table
│   │   ├── AlignmentTimeSlider.tsx  Timeline range scrubber
│   │   └── MinimaTable.tsx        Mode-aware ranked events with click-to-navigate and day-detail combos
│   └── ui/                    Playback, toggles, selector, mobile tabs, help
│       ├── PlaybackBar.tsx        Date input, play/pause, speed, step navigation
│       ├── PlaybackControls.tsx   Compact playback controls (mobile)
│       ├── PlanetariumTimeControls.tsx  In-panel minute stepping + local play/speed
│       ├── TimeControls.tsx       Date picker + timeline slider
│       ├── DisplayToggles.tsx     3D scene layer checkboxes
│       ├── BodySelector.tsx       Quick-select planet focus buttons
│       ├── InfoDisplay.tsx        Selection info card
│       ├── MobileTabBar.tsx       Bottom tab navigation
│       ├── HelpButton.tsx         Guided tour launcher
│       ├── LocationPickerModal.tsx Observer location modal (browser/map/search/manual)
│       └── OsmMiniMap.tsx         Leaflet OpenStreetMap picker
├── hooks/                     State management and utilities
│   ├── useSimulationTime.ts   Date, playback, speed (context)
│   ├── useSelection.ts        Body selection, follow mode (context)
│   ├── useDisplaySettings.ts  Toggle states for all display layers (context)
│   ├── useAlignmentState.ts   Alignment computation, mode/ranking state, chart data, navigation
│   ├── usePanelManager.ts     Panel layout, z-ordering, drag/resize
│   ├── usePlanetPositions.ts  Memoized heliocentric positions
│   ├── useOrbitPaths.ts       Memoized orbit polylines
│   ├── useSimulationStore.ts  Global non-React store for R3F performance
│   ├── usePlanetariumStore.ts Shared yaw/pitch/FoV state for Planetarium view group
│   ├── useTour.ts             Guided tour state (driver.js)
│   ├── useObserverLocation.ts Progressive observer location + timezone inference
│   ├── useIsMobile.ts         Responsive breakpoint detection
│   └── useIsLandscape.ts      Orientation detection
├── lib/                       Core computation libraries
│   ├── astronomy.ts           Positions, alt-az, moon phase, magnitude, MW polygons, HOR↔EQJ
│   ├── alignment.ts           Combination-based alignment (computeAlignmentTabs, findBestPerKind, classifyCombination), local minima, ephemeris cache
│   ├── ppiScoring.ts          Planet Parade Index + span ranking (mode-aware), presets
│   ├── coordinateConversion.ts EQJ↔Scene, RA/Dec↔XYZ, ecliptic transforms
│   ├── planetariumDefaultView.ts Planetarium default-time chooser
│   ├── observerLocation.ts    Observer location state sanitization/serialization
│   ├── timeZoneDay.ts         Timezone day-key/day-range helpers
│   ├── skyVisibility.ts       Shared twilight/moon wash -> visibility factors
│   ├── atmosphereColor.ts     Shared sky color model (day/twilight/night/moon)
│   ├── moonGlow.ts            Moon glow strength from phase/magnitude/airmass
│   └── orbitSampler.ts        Orbit path sampling via Kepler
├── data/                      Static catalogs and data files
│   ├── starCatalog.ts         192 stars (RA, Dec, magnitude, spectral class)
│   ├── constellationLines.ts  39 constellation stick figures
│   ├── constellationBoundaries.ts  IAU boundary segments
│   └── mw.json                Milky Way 5-layer polygon rings (d3-celestial)
├── vite-env.d.ts              Vite client type declarations
└── index.html                 Vite entry point

public/
└── starmap_4k.jpg             NASA Deep Star Maps 2020 (4096x2048, Gaia DR2)

docs/
├── specs.md                   This file
├── planet-parade-index.md     PPI scoring formula, presets, calibration, design decisions
├── milkyway-texture.md        NASA texture source, conversion, rendering pipeline
├── planetarium-default-view.md Planetarium default-time and framing strategy
└── alignment-algorithm-analysis.md  Alignment computation research and validation
```
