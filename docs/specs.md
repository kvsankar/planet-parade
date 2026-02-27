# Planet Parade — Specification

## 1. Needs

The application addresses the need for an interactive, browser-based visualization of our solar system and sky that uses real astronomical data. Users should be able to:

- See where the planets actually are (or were, or will be) at any point in time.
- Explore the solar system spatially — zoom, rotate, and look at it from any angle.
- Watch the planets move along their orbits in animated playback.
- Select individual bodies to inspect them and track their motion.
- Gain an intuitive sense of scale — how far apart the planets are, how fast they move relative to each other.
- Find planetary alignment events and understand morning/evening visibility.
- View the sky as it appears from any location at sunrise and sunset — planets, stars, constellations, and the Milky Way.

The target audience is anyone curious about planetary motion — students, educators, hobbyists — not professional astronomers. Accuracy matters, but approachability matters more.

---

## 2. Features

### 2.1 Celestial Bodies

The visualization includes **11 celestial bodies**:

| Body    | Notes                          |
|---------|--------------------------------|
| Sun     | Fixed at the center of the scene |
| Mercury | Innermost planet               |
| Venus   |                                |
| Earth   |                                |
| Mars    |                                |
| Jupiter |                                |
| Saturn  |                                |
| Uranus  |                                |
| Neptune |                                |
| Pluto   | Included despite dwarf planet reclassification |
| Moon    | Earth's Moon; orbits Earth     |

Each body is rendered as a colored sphere. No textures — color alone distinguishes them.

### 2.2 Accurate Positions

- Planetary positions are computed from real ephemeris data (astronomy-engine, VSOP87 models), not simplified circular orbits.
- Positions use the **ecliptic coordinate system** (the plane of Earth's orbit as the reference plane).
- Orbits are **to-scale** in distance: the relative spacing between planets reflects their true distances in AU.
- The Moon's position is computed relative to Earth and offset accordingly.

### 2.3 Orbit Lines

- Each body's orbital path is drawn as a line tracing one full orbital period.
- Orbit lines can be **toggled on/off** globally.

### 2.4 Labels

- Each body has a text label showing its name.
- Labels can be **toggled on/off** globally.
- The selected body's label appears bold.
- Labels have overlap detection to avoid cluttering.

### 2.5 Dynamic Body Sizing

- Bodies are **not to scale** in physical radius — they would be invisible at true scale.
- Instead, each body maintains a roughly consistent **apparent size on screen** regardless of zoom level.
- Selected bodies appear slightly larger than unselected ones.

### 2.6 Time Controls

Users can control the simulation date through:

- **Date picker**: type or pick an exact date.
- **Timeline slider**: scrub across the full date range.
- **Play/Pause**: animate time progression.
- **Speed selector**: choose how many simulated days pass per real second.
- **Navigation buttons**: ±1 day, ±5 days, Today.

**Date range**: 1975-01-01 to 2075-01-01 (100 years).

**Speed presets**: 1, 5, 10, 30, 100, 365, 1000, 3650 days/second.

**Default speed**: 10 days/second.

Animation must be **smooth** — bodies should glide along their orbits without visible jitter or stuttering.

### 2.7 Camera Controls

- **Rotate**: drag to orbit the camera around the scene.
- **Zoom**: scroll to zoom in and out.
- **Pan**: right-drag or shift-drag to pan.
- **Default view**: top-down, looking at the Sun from above the ecliptic (north ecliptic pole).

### 2.8 Body Selection

- **Click** a body in the 3D scene to select it.
- **Body list** in the control panel: click a name to select it.
- When a body is selected:
  - The camera smoothly animates to center on it.
  - An info panel shows the body's name and its current distance from the Sun (in AU).

### 2.9 Follow Mode

- When a body is selected, a **Follow** toggle becomes available.
- When Follow is on, the camera continuously tracks the selected body, keeping it centered as time advances.
- When Follow is off, the camera animates to the body once and then stays put.

### 2.10 Celestial Background

The scene includes several toggleable background layers:

- **Milky Way sphere**: A 949-unit radius sphere textured with a NASA Deep Star Maps 2020 JPEG (Gaia DR2, 1.7 billion stars), rendered via a custom ShaderMaterial to bypass Three.js color management. See `docs/milkyway-texture.md` for full details.
- **Real stars**: 192 bright stars from the Yale BSC/Hipparcos catalog, rendered as point sprites with accurate B-V color mapping (spectral class → effective temperature → sRGB via Planck/CIE chromaticity).
- **Constellation lines**: 39 constellation stick figures connecting catalog stars.
- **Constellation boundaries**: Dashed lines showing official IAU constellation boundaries.

### 2.11 Planetary Alignment Detection

The alignment panel allows users to:

- Select which planets to analyze (8 analyzable, excluding Earth).
- Set a time range (3 months to 100 years).
- Compute angular separation series (ecliptic longitude span) at daily intervals.
- View total, morning, and evening alignment series on an interactive timeline chart.
- Find local minima (closest-alignment dates) with jump-to-date navigation.
- Classify planets as morning or evening objects based on elongation from the Sun.
- Set minimum planet count for AM/PM groupings.

### 2.12 Sky View (Ecliptic Scatter)

A 2D projection of planets in ecliptic longitude (X) and latitude (Y):

- Centerable on ecliptic longitude 0° or the Sun.
- Morning/evening visibility shading with angular span annotations.
- Planet data table showing ecliptic longitude, latitude, elongation, visual magnitude, and AM/PM classification.
- X-axis zoom/pan with pinch and drag support.

### 2.13 Stereographic Sky Charts

Dual hemispheric projections showing the sky at sunrise (morning) and sunset (evening):

- **Azimuthal equidistant projection**: altitude maps linearly to radius, azimuth maps to angle.
- **Rendered elements**: Sun, Moon (with accurate phase visualization), planets, 192 stars, 39 constellations (edges and labels), ecliptic curve, Milky Way.
- **Milky Way dual rendering**:
  - **Polygons**: Multi-layer SVG fills from d3-celestial data (5 opacity layers).
  - **Texture**: Real-time reprojection of NASA Deep Star Maps JPEG via Web Worker with bilinear sampling.
  - Toggle between modes with `[Poly | Tex]` pills in the layer menu.
- **Toggleable layers**: Stars, constellation edges, constellation labels, Milky Way (with style sub-toggle), Sun, planets, Moon.
- **Visual magnitude scaling**: Planet and star dot sizes scale with brightness.
- **Panel zoom**: 1× to 16× zoom expands charts while preserving label/dot sizes.
- **Smooth animation**: Continuous updates as date changes; rotation matrices update per-frame, expensive Milky Way polygons update on coarser 2-minute quantization.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID    | Requirement |
|-------|-------------|
| FR-1  | The app shall display the Sun, eight planets, Pluto, and Earth's Moon as distinct colored spheres in 3D space. |
| FR-2  | Body positions shall be computed from astronomical ephemeris data for the current simulation date. |
| FR-3  | Positions shall use ecliptic coordinates, with orbits to-scale in AU. |
| FR-4  | The Moon shall orbit Earth at its correct geocentric position, offset by Earth's heliocentric position. |
| FR-5  | Orbit lines shall trace one full orbital period for each body and be toggleable. |
| FR-6  | Text labels shall be toggleable and displayed above each body with overlap detection. |
| FR-7  | Bodies shall maintain a consistent apparent screen size (in pixels) regardless of camera distance. |
| FR-8  | The user shall be able to set the simulation date via a date picker, a timeline slider, or animated playback. |
| FR-9  | Playback speed shall be selectable from a set of presets. |
| FR-10 | Animation shall update body positions every render frame for smooth motion (no per-frame jitter). |
| FR-11 | The camera shall support rotate, zoom, and pan interactions. |
| FR-12 | Clicking a body (in the scene or body list) shall select it and animate the camera toward it. |
| FR-13 | Follow mode shall continuously track the selected body's position each frame. |
| FR-14 | An info panel shall show the selected body's name and distance from the Sun in AU. |
| FR-15 | The simulation date range shall span 1975-01-01 to 2075-01-01. |
| FR-16 | The app shall compute and display planetary alignment series with morning/evening classification. |
| FR-17 | Stereographic sky charts shall show the sky as seen from any location at sunrise/sunset with toggleable layers. |
| FR-18 | The Milky Way shall be renderable in both polygon (SVG) and texture (NASA JPEG reprojection) modes. |
| FR-19 | The celestial background shall include real stars, constellation lines, and constellation boundaries, all toggleable. |

### 3.2 Non-Functional Requirements

| ID     | Requirement |
|--------|-------------|
| NFR-1  | The app shall run in modern desktop browsers (Chrome, Firefox, Edge, Safari). |
| NFR-2  | Animation shall maintain 60fps on mid-range hardware. |
| NFR-3  | UI control updates (date display, slider position) may be throttled to ~10/sec to avoid input lag, but 3D positions must update every frame. |
| NFR-4  | Orbit path computations shall be memoized to avoid redundant recalculation. |
| NFR-5  | The app shall be a single-page client-side application with no backend. |
| NFR-6  | The app shall be responsive — desktop uses floating draggable panels, mobile uses a tabbed interface with landscape two-column layouts. |
| NFR-7  | Expensive computations (Milky Way texture reprojection) shall be offloaded to Web Workers to keep the main thread responsive. |

---

## 4. Design Decisions

This section captures high-level architectural and technology choices made during implementation. These are not requirements — alternative choices could satisfy the same needs.

- **Tech stack**: Vite + React + TypeScript, with Three.js via `@react-three/fiber` and `@react-three/drei`.
- **Ephemeris source**: The `astronomy-engine` npm package provides position calculations.
- **Coordinate pipeline**: J2000 equatorial (EQJ) from astronomy-engine → ecliptic rotation (23.44° obliquity) → Three.js Y-up axis mapping (ecliptic X→X, ecliptic Z→Y, ecliptic Y→-Z).
- **Scale**: 1 AU = 10 Three.js scene units. Celestial sphere radius = 950.
- **State management**: React contexts for UI state (selection, display toggles, time controls); a module-level mutable store for the live simulation date, shared between React and the Three.js render loop without context bridging.
- **Animation architecture**: Time is advanced inside Three.js's `useFrame` loop. Each body recomputes its position from the shared store every frame. React state is updated at a throttled rate for the UI panel only.
- **Dynamic sizing**: Per-frame calculation using camera distance, FOV, and a target pixel size. Applied via `mesh.scale` to avoid React re-renders.
- **Orbit sampling**: Positions sampled at N evenly-spaced points over one orbital period (180 for inner planets, 360 for outer, 60 for Moon). Memoized by coarsened date (year for planets, month for Moon).
- **Camera**: OrbitControls from drei. Selection triggers a lerp animation toward the target body. Follow mode overrides the controls target each frame.
- **Body rendering**: Bodies use flat-colored materials for simplicity and fast loading. No planet textures.
- **Milky Way sphere**: Custom ShaderMaterial with raw texture passthrough to bypass Three.js color management. `phiStart=π` on SphereGeometry aligns RA=0h with scene +X.
- **Sky chart texture**: Web Worker with inline blob source, shared across chart instances with reference counting and instance-ID isolation. Canvas dimensions managed imperatively to avoid React clearing the buffer.
- **Asset paths**: All references to `public/` assets use `import.meta.env.BASE_URL` so URLs resolve correctly under Vite's `base: './'` configuration, regardless of deployment subdirectory.
- **Responsive layout**: Desktop uses `react-rnd` for floating, draggable, resizable panels with z-ordering. Mobile uses a tab bar (portrait) or two-column layouts (landscape).
- **Onboarding**: Guided tours via `driver.js` with auto-launch on first visit.

---

## 5. Project Structure

```
src/
├── App.tsx                    Main app, context providers, desktop/mobile layout
├── App.css                    Global styles
├── types.ts                   CelestialBodyId, AlignmentDataPoint, DisplaySettings, etc.
├── constants.ts               Body metadata, speed/time presets, formatting
├── components/
│   ├── scene/                 3D solar system visualization
│   │   ├── SolarSystemScene.tsx   Canvas setup, camera, scene wrapper
│   │   ├── CelestialBody.tsx      Planet mesh with dynamic sizing and labels
│   │   ├── Sun.tsx                Central star
│   │   ├── OrbitLine.tsx          Orbital path line segments
│   │   ├── AlignmentCones.tsx     3D cones connecting selected planets
│   │   ├── CameraController.tsx   OrbitControls, follow mode, selection animation
│   │   ├── MilkyWaySphere.tsx     NASA texture background sphere
│   │   ├── RealStars.tsx          192-star point sprites with B-V colors
│   │   ├── ConstellationLines3D.tsx   39 constellation stick figures
│   │   └── ConstellationBoundaries3D.tsx  IAU boundary dashed lines
│   ├── panels/                Floating wrappers (desktop) + sheet panels (mobile)
│   │   ├── AlignmentPanel.tsx     Planet picker, time range, series toggles, minima table
│   │   ├── ChartPanel.tsx         Separation timeline with zoom/pan
│   │   ├── SkyViewPanel.tsx       Ecliptic scatter chart + planet data table
│   │   ├── SkyChartPanel.tsx      Dual sky charts with layer toggles
│   │   └── FloatingPanel.tsx      Desktop panel shell (react-rnd)
│   ├── alignment/             Charts, pickers, tables, sky views
│   │   ├── StereoSkyChart.tsx     Core stereographic projection SVG renderer
│   │   ├── MilkyWayTextureCanvas.tsx  Web Worker texture reprojection
│   │   ├── SeparationChart.tsx    Recharts alignment timeline
│   │   ├── SkyView.tsx            Ecliptic scatter + data table
│   │   ├── PlanetPicker.tsx       Multi-select planet checkboxes
│   │   ├── TimeRangeSelector.tsx  Start date + duration presets
│   │   ├── SeriesToggle.tsx       Total/Morning/Evening visibility
│   │   └── MinimaTable.tsx        Local minima with click-to-navigate
│   └── ui/                    Playback, toggles, selector, mobile tabs, help
│       ├── PlaybackBar.tsx        Date input, play/pause, speed, navigation
│       ├── DisplayToggles.tsx     3D scene layer checkboxes
│       ├── BodySelector.tsx       Quick-select planet focus buttons
│       ├── InfoDisplay.tsx        Selection info card
│       ├── MobileTabBar.tsx       Bottom tab navigation
│       └── HelpButton.tsx         Guided tour launcher
├── hooks/                     State management and utilities
│   ├── useSimulationTime.ts   Date, playback, speed (context)
│   ├── useSelection.ts        Body selection, follow mode (context)
│   ├── useDisplaySettings.ts  Toggle states for all display layers (context)
│   ├── useAlignmentState.ts   Alignment computation, series, minima
│   ├── usePanelManager.ts     Panel layout, z-ordering, drag/resize
│   ├── usePlanetPositions.ts  Memoized heliocentric positions
│   ├── useOrbitPaths.ts       Memoized orbit polylines
│   ├── useLabelRegistry.ts    Label overlap detection
│   ├── useSimulationStore.ts  Global non-React store for R3F performance
│   ├── useTour.ts             Guided tour state (driver.js)
│   ├── useIsMobile.ts         Responsive breakpoint detection
│   └── useIsLandscape.ts      Orientation detection
├── lib/                       Core computation libraries
│   ├── astronomy.ts           Positions, alt-az, moon phase, magnitude, MW polygons, HOR↔EQJ
│   ├── alignment.ts           Series computation, local minima, angular spans, ephemeris cache
│   ├── coordinateConversion.ts EQJ↔Scene, RA/Dec↔XYZ, ecliptic transforms
│   └── orbitSampler.ts        Orbit path sampling via Kepler
├── data/                      Static catalogs and data files
│   ├── starCatalog.ts         192 stars (RA, Dec, magnitude, spectral class)
│   ├── constellationLines.ts  39 constellation stick figures
│   ├── constellationBoundaries.ts  IAU boundary segments
│   └── mw.json                Milky Way 5-layer polygon rings (d3-celestial)
├── vite-env.d.ts              Vite client type declarations
└── index.html                 Vite entry point

public/
└── starmap_4k.jpg             NASA Deep Star Maps 2020 (4096×2048, Gaia DR2)

docs/
├── specs.md                   This file
├── milkyway-texture.md        NASA texture source, conversion, rendering pipeline
└── alignment-algorithm-analysis.md  Alignment computation research and validation
```
