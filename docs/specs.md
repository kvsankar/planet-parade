# Planet Parade — Specification

## 1. Purpose

Planetary alignment events — like the Feb 2025 and Feb 2026 "planet parades" — generate enormous media hype, but the reality is often underwhelming: planets spread across 90+ degrees of sky, some too faint to see, some lost in twilight. This app lets users investigate alignments themselves with real astronomical data.

The core question it answers: **When can I see the most planets at once without spending hours outside?**

If you observe the sky for 24 hours, all planets are visible (ignoring twilight/Sun/Moon effects). But can you see most of them at a single point in time — in the evening sky, or the morning sky? If not all, then how many, and when? Planet Parade lets you explore and find those times across months, years, or decades.

The target audience is astronomy educators, science communicators, and curious hobbyists — people who want to cut through hype and understand what planetary alignments really look like and when they actually happen.

---

## 2. Features

### 2.1 Alignment Analysis (Primary Feature)

The alignment analyzer is the heart of the app. The user selects a set of planets (up to 8, excluding Earth), defines a time range, and the app computes how tightly those planets cluster in the sky over time.

#### Planet selection

The user picks which planets to analyze. Default: Mercury through Neptune (7 planets). Any combination of 2–7 planets can be selected.

#### Time range

- **Start date**: any date in the 1975–2075 range.
- **Duration presets**: 3 months, 6 months, 1, 2, 5, 10, 20, 50, or 100 years.
- **Custom duration**: exact number of days, months, or years.

#### Combination-based alignment analysis

The app uses a combination-based approach: given N selected planets, it evaluates every k-planet combination (where k ranges from N down to a user-set minimum) and finds the tightest ecliptic longitude cluster for each. Results are organized in tabs by combination size (e.g., best 7, best 6, best 5 from 7 selected).

Each combination is classified as a whole unit based on its relationship to the Sun:

- **Morning (AM)**: all planets in the combination are west of the Sun (visible before sunrise).
- **Evening (PM)**: all planets in the combination are east of the Sun (visible after sunset).
- **Straddling**: the Sun falls inside the combination's ecliptic arc — planets span both sides of the Sun and cannot all be seen in a single pre-dawn or post-sunset session.

For each day and combination size, the app reports the tightest span per category across all combinations of that size.

#### Minimum planet count

The user can set the minimum combination size to analyze. With 7 planets selected and min 5, the app computes tabs for 7-, 6-, and 5-planet combinations. This is capped at N−3 to keep computation tractable.

#### Closest alignments

The app automatically finds local minima — dates when the selected planets cluster tightest — for each combination size and category. These are shown in a sortable table with planet count, planet symbols (hover for names), span, and category. Clicking a row jumps the entire app to that date and switches to the appropriate combination tab. Planet count filter chips let the user show/hide specific sizes. Previous/Next buttons step through minima within the active tab.

#### Colors

Consistent across all views:
- **AM**: warm golden orange (evoking sunrise)
- **PM**: deep indigo blue (evoking night sky)
- **Straddling**: light red (cluster spans the Sun)

### 2.2 Parade Timeline

An interactive line chart plotting PPI (Planet Parade Index — see [planet-parade-index.md](planet-parade-index.md)) and angular span over time. Simple mode shows the overall best-of-day line; Advanced mode shows per-count lines (e.g., best 7, best 6, best 5) with toggleable count chips. PPI and Span metrics can be toggled independently.
- Click any point to jump to that date.
- Zoom (Ctrl+scroll, pinch) and pan (drag) when zoomed.
- Current-date indicator (vertical line) shows PPI, span, and planet list.
- Navigation mode (PPI peaks or Span minima) with Today/Prev/Next buttons.

### 2.3 Ecliptic Strip (Ecliptic Projection)

A 2D scatter plot of planet positions in ecliptic longitude (X) and latitude (Y):

- **Center modes**: Longitude 0° at center, or Sun at center.
- **Per-kind shading bands**: colored regions show the best AM, PM, and Straddling cluster spans with degree annotations. Planets not in the active combination are dimmed.
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
- **Toggleable layers**: Stars, Milky Way, Atmosphere, Star Labels, Planet Labels, Moon, Constellation Edges, Constellation Labels, Alt/Az Grid, Ecliptic.
- **Layout modes**: desktop paired AM/PM charts by default with optional tabbed mode; mobile always tabbed.
- **Zoom/Pan**: 1–16× with mouse/touch. Mobile landscape allows zooming out enough to fit the full circular sky.

### 2.5 Space & Sky Panel

The Scene panel has two tabs: **Solar System** and **Planetarium**.

#### Solar System tab

- **Accurate positions**: computed from `astronomy-engine` ephemeris data (VSOP87 models) in ecliptic coordinates, to-scale in AU.
- **Orbits**: one full orbital period per body, toggleable.
- **Labels**: toggleable, with overlap detection.
- **Dynamic sizing**: bodies maintain a consistent apparent pixel size regardless of zoom.
- **Per-kind alignment cones**: when alignment analysis is active, separate cones from Earth visualize the best AM (orange), PM (blue), and Straddling (grey) clusters for the active combination size.
- **Celestial background** (all toggleable):
  - NASA Deep Star Maps Milky Way sphere (custom ShaderMaterial, see `docs/milkyway-texture.md`).
  - 192 bright stars with accurate B-V color mapping.
  - 39 constellation stick figures.
  - IAU constellation boundary lines.
- **Camera**: rotate (drag), zoom (scroll), pan (right-drag). Body selection animates camera toward the body. Follow mode tracks the selected body continuously.
- **Inner planets**: auto-hide when zoomed far out to avoid crowding; toggleable override.

#### Planetarium tab

- **Observer-centric sky dome** with horizon, cardinal markers, Alt/Az grid (15° intervals), dashed ecliptic, stars, Milky Way, constellations, Sun/Moon/planets.
- **Integrated atmosphere** shared with Sky Charts (daylight, twilight, moonlight wash and attenuation).
- **Stable interaction model**: drag rotates the full sky frame (not independent overlays), axis-lock behavior reduces accidental horizon tilt, wheel/pinch zoom uses FoV range 20°–120°.
- **Deterministic startup framing**: on mount or combo change, chooses a nighttime instant for the active cluster and frames a wide horizon-to-horizon ecliptic view (see `docs/planetarium-default-view.md`).
- **Observer location control**: user-invoked only; supports browser geolocation permission prompt, OpenStreetMap map/search selection, and manual coordinate entry.
- **Timezone inference**: infer IANA timezone from observer coordinates for local sunrise/sunset and panel time labels (fallback UTC).

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
| FR-1  | The user shall be able to select a subset of planets and compute their ecliptic longitude span over a configurable time range using combination-based analysis. |
| FR-2  | The app shall classify each combination as morning (all west of Sun), evening (all east of Sun), or straddling (Sun inside the arc) and compute separate series per category. |
| FR-3  | The app shall detect local minima (closest-alignment dates) per combination size and category, and present them in a navigable, filterable table with planet symbols. |
| FR-4  | The user shall be able to set a minimum combination size; results shall be organized in tabs by planet count. |
| FR-5  | An interactive timeline chart shall display AM, PM, and Straddling separation series with combination size tabs, zoom, pan, and click-to-navigate. |
| FR-6  | A sky view shall plot planet positions in ecliptic longitude/latitude with per-kind shading bands, combination size tabs, and span annotations. Non-combo planets shall be dimmed. |
| FR-7  | A planet data table shall show ecliptic longitude, latitude, elongation, visual magnitude, and AM/PM classification. |
| FR-8  | Dual azimuthal-equidistant sky charts shall show evening/morning Sun-referenced frames with stars, constellations, Milky Way, Moon phase, and planets. |
| FR-9  | The Milky Way shall be renderable in both polygon and NASA texture modes, toggled by the user. |
| FR-10 | A 3D solar system view shall display all bodies at their real heliocentric positions with to-scale orbits. |
| FR-11 | Per-kind alignment cones from Earth shall visualize the best AM, PM, and Straddling clusters for the active combination size in the 3D view. |
| FR-12 | The celestial background shall include real stars, constellation lines, and constellation boundaries, all toggleable. |
| FR-13 | Body positions shall be computed from astronomical ephemeris data for the current simulation date. |
| FR-14 | The user shall be able to control the simulation date via date picker, timeline slider, or animated playback with selectable speed. |
| FR-15 | The simulation date range shall span 1975-01-01 to 2075-01-01. |
| FR-16 | Animation shall update positions every render frame for smooth motion. |
| FR-17 | Clicking a body shall select it and animate the camera toward it; Follow mode shall track it continuously. |
| FR-18 | The Scene panel shall provide a Planetarium mode with horizon/cardinal framing and stable drag/zoom controls. |
| FR-19 | Planetarium startup shall auto-select a deterministic nighttime instant that prioritizes active-cluster visibility while minimizing solar interference. |

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
- **Ephemeris**: `astronomy-engine` npm package. Geocentric ecliptic coordinates for alignment computations, J2000 equatorial for star/sky positions.
- **Alignment algorithm**: combination-based — evaluates every k-planet combination, classifies each as AM/PM/Straddling based on whether the Sun falls inside the ecliptic arc, and reports the tightest span per category per day. Results organized in tabs by combination size. See `docs/alignment-algorithm-analysis.md`.
- **Coordinate pipeline**: J2000 equatorial (EQJ) from astronomy-engine → ecliptic rotation (23.44° obliquity) → Three.js Y-up mapping.
- **Scale**: 1 AU = 10 scene units. Celestial sphere radius = 950.
- **State management**: React contexts for UI state; a module-level mutable store for the live simulation date shared between React and the Three.js render loop.
- **Animation**: time advanced in Three.js `useFrame` loop. Per-frame position updates from the shared store. React UI updated at throttled rate (~10/sec).
- **Planetarium view model**: drag updates a shared yaw/pitch store applied to a parent scene group, so sky layers and horizon remain rigidly aligned.
- **Planetarium default-time strategy**: daylight-rejecting UTC day scan (5-minute steps), lexicographic ranking by visibility/darkness/altitude, with Sun-on-horizon fallback. See `docs/planetarium-default-view.md`.
- **Sky chart reference frame**: virtual longitudes selected via `sunHorizonLongitude` so Sun is at configurable reference altitude (`0°`, `-6°`, `-12°`) rather than fixed civil sunrise/sunset.
- **Atmosphere rendering**: shared sky-visibility and chromatic atmosphere model used by both Planetarium and Sky Charts.
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
│   │   ├── AlignmentPanel.tsx     Planet picker, time range, PPI sliders, minima table
│   │   ├── ChartPanel.tsx         PPI/span timeline with zoom/pan and count toggles
│   │   ├── SkyViewPanel.tsx       Ecliptic scatter chart + planet data table
│   │   ├── SkyChartPanel.tsx      Dual sky charts with layer toggles
│   │   └── FloatingPanel.tsx      Desktop panel shell (react-rnd)
│   ├── alignment/             Charts, pickers, tables, sky views
│   │   ├── StereoSkyChart.tsx     Core azimuthal equidistant projection SVG renderer
│   │   ├── MilkyWayTextureCanvas.tsx  Web Worker texture reprojection
│   │   ├── SeparationChart.tsx    Recharts PPI/span timeline (per-count lines)
│   │   ├── SkyView.tsx            Ecliptic scatter + shading bands
│   │   ├── PlanetPicker.tsx       Multi-select planet checkboxes
│   │   ├── TimeRangeSelector.tsx  Start date + duration presets
│   │   ├── PlanetCountRange.tsx   Min/max planet count range selector
│   │   ├── PPISliders.tsx         PPI weight sliders and preset buttons
│   │   ├── PlanetaryDataTable.tsx Ecliptic coordinates, magnitude, AM/PM table
│   │   ├── AlignmentTimeSlider.tsx  Timeline range scrubber
│   │   └── MinimaTable.tsx        PPI peaks with click-to-navigate and day-detail combos
│   └── ui/                    Playback, toggles, selector, mobile tabs, help
│       ├── PlaybackBar.tsx        Date input, play/pause, speed, step navigation
│       ├── PlaybackControls.tsx   Compact playback controls (mobile)
│       ├── PlanetariumTimeControls.tsx  In-panel minute stepping + local play/speed
│       ├── TimeControls.tsx       Date picker + timeline slider
│       ├── DisplayToggles.tsx     3D scene layer checkboxes
│       ├── BodySelector.tsx       Quick-select planet focus buttons
│       ├── InfoDisplay.tsx        Selection info card
│       ├── MobileTabBar.tsx       Bottom tab navigation
│       └── HelpButton.tsx         Guided tour launcher
├── hooks/                     State management and utilities
│   ├── useSimulationTime.ts   Date, playback, speed (context)
│   ├── useSelection.ts        Body selection, follow mode (context)
│   ├── useDisplaySettings.ts  Toggle states for all display layers (context)
│   ├── useAlignmentState.ts   Alignment computation, PPI state, chart data, navigation
│   ├── usePanelManager.ts     Panel layout, z-ordering, drag/resize
│   ├── usePlanetPositions.ts  Memoized heliocentric positions
│   ├── useOrbitPaths.ts       Memoized orbit polylines
│   ├── useSimulationStore.ts  Global non-React store for R3F performance
│   ├── usePlanetariumStore.ts Shared yaw/pitch/FoV state for Planetarium view group
│   ├── useTour.ts             Guided tour state (driver.js)
│   ├── useIsMobile.ts         Responsive breakpoint detection
│   └── useIsLandscape.ts      Orientation detection
├── lib/                       Core computation libraries
│   ├── astronomy.ts           Positions, alt-az, moon phase, magnitude, MW polygons, HOR↔EQJ
│   ├── alignment.ts           Combination-based alignment (computeAlignmentTabs, findBestPerKind, classifyCombination), local minima, ephemeris cache
│   ├── ppiScoring.ts          Planet Parade Index (computePPIResults, computeComboPPI), presets
│   ├── coordinateConversion.ts EQJ↔Scene, RA/Dec↔XYZ, ecliptic transforms
│   ├── planetariumDefaultView.ts Planetarium default-time chooser
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
