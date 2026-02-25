# Solar System Visualization — Specification

## 1. Needs

The application addresses the need for an interactive, browser-based 3D visualization of our solar system that uses real astronomical data. Users should be able to:

- See where the planets actually are (or were, or will be) at any point in time.
- Explore the solar system spatially — zoom, rotate, and look at it from any angle.
- Watch the planets move along their orbits in animated playback.
- Select individual bodies to inspect them and track their motion.
- Gain an intuitive sense of scale — how far apart the planets are, how fast they move relative to each other.

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

- Planetary positions are computed from real ephemeris data, not simplified circular orbits.
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

### 2.10 Starfield Background

- The scene has a dark space background with a procedural starfield for immersion.

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
| FR-6  | Text labels shall be toggleable and displayed above each body. |
| FR-7  | Bodies shall maintain a consistent apparent screen size (in pixels) regardless of camera distance. |
| FR-8  | The user shall be able to set the simulation date via a date picker, a timeline slider, or animated playback. |
| FR-9  | Playback speed shall be selectable from a set of presets. |
| FR-10 | Animation shall update body positions every render frame for smooth motion (no per-frame jitter). |
| FR-11 | The camera shall support rotate, zoom, and pan interactions. |
| FR-12 | Clicking a body (in the scene or body list) shall select it and animate the camera toward it. |
| FR-13 | Follow mode shall continuously track the selected body's position each frame. |
| FR-14 | An info panel shall show the selected body's name and distance from the Sun in AU. |
| FR-15 | The simulation date range shall span 1975-01-01 to 2075-01-01. |

### 3.2 Non-Functional Requirements

| ID     | Requirement |
|--------|-------------|
| NFR-1  | The app shall run in modern desktop browsers (Chrome, Firefox, Edge, Safari). |
| NFR-2  | Animation shall maintain 60fps on mid-range hardware. |
| NFR-3  | UI control updates (date display, slider position) may be throttled to ~10/sec to avoid input lag, but 3D positions must update every frame. |
| NFR-4  | Orbit path computations shall be memoized to avoid redundant recalculation. |
| NFR-5  | The app shall be a single-page client-side application with no backend. |

---

## 4. Design Decisions

This section captures high-level architectural and technology choices made during implementation. These are not requirements — alternative choices could satisfy the same needs.

- **Tech stack**: Vite + React + TypeScript, with Three.js via `@react-three/fiber` and `@react-three/drei`.
- **Ephemeris source**: The `astronomy-engine` npm package provides position calculations.
- **Coordinate pipeline**: J2000 equatorial (EQJ) from astronomy-engine → ecliptic rotation (23.44° obliquity) → Three.js Y-up axis mapping (ecliptic X→X, ecliptic Z→Y, ecliptic Y→-Z).
- **Scale**: 1 AU = 10 Three.js scene units.
- **State management**: React contexts for UI state (selection, display toggles, time controls); a module-level mutable store for the live simulation date, shared between React and the Three.js render loop without context bridging.
- **Animation architecture**: Time is advanced inside Three.js's `useFrame` loop. Each body recomputes its position from the shared store every frame. React state is updated at a throttled rate for the UI panel only.
- **Dynamic sizing**: Per-frame calculation using camera distance, FOV, and a target pixel size. Applied via `mesh.scale` to avoid React re-renders.
- **Orbit sampling**: Positions sampled at N evenly-spaced points over one orbital period (180 for inner planets, 360 for outer, 60 for Moon). Memoized by coarsened date (year for planets, month for Moon).
- **Camera**: OrbitControls from drei. Selection triggers a lerp animation toward the target body. Follow mode overrides the controls target each frame.
- **No textures**: Bodies use flat-colored materials for simplicity and fast loading.
