# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Type-check (tsc) then production build
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run preview      # Serve the production build locally
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/alignment.validation.test.ts
```

There is no linter or formatter configured. TypeScript strict mode (`"strict": true`) is the primary code quality gate.

## Architecture

### State Management — Three Layers

The app uses three distinct state layers to bridge React and Three.js:

1. **React Context** — UI-driven global state defined in `App.tsx` and consumed via hooks:
   - `SimulationTimeContext` (currentDate, isPlaying, speed)
   - `SelectionContext` (selectedBodyId, followMode)
   - `DisplaySettingsContext` (8 boolean toggles for orbits, labels, stars, etc.)

2. **Module-level singleton store** (`hooks/useSimulationStore.ts`) — A plain mutable object (`simulationStore`) that mirrors simulation time state. Three.js Canvas components import this directly instead of using Context, because React Context doesn't reliably cross the R3F Canvas boundary. Mutations are synchronous.

3. **Domain hooks** (`hooks/useAlignmentState.ts`) — Self-contained state for alignment computation with heavy `useMemo` for expensive astronomy calculations. Owns `activeTab` (combination size), `bestPerKind` (best combo per AM/PM/Straddling), and feeds both SkyView and AlignmentCones via props.

### Animation Loop

`App.tsx` runs a `requestAnimationFrame` loop that:
- Advances `simulationStore.date` every frame when playing (smooth 60fps)
- Throttles React state updates to ~10/sec (every 100ms) to drive UI without overwhelming re-renders
- Three.js scene components read `simulationStore.date` directly in `useFrame()` callbacks — they never depend on React Context for time

### Responsive Layout

Two modes detected via `useIsMobile()` (breakpoint: 768px or landscape+coarse pointer):
- **Desktop**: Five floating draggable/resizable panels via `react-rnd`, managed by `usePanelManager`
- **Mobile portrait**: Tabbed single-panel interface (5 tabs: scene, align, timeline, sky, charts)
- **Mobile landscape**: Two-column layouts where appropriate

### Coordinate Pipeline

astronomy-engine (J2000 equatorial) → ecliptic rotation (23.44° obliquity) → Three.js Y-up scene coordinates. Scale: 1 AU = 10 scene units. Celestial sphere radius = 950.

### Key Libraries

- `lib/alignment.ts` — Combination-based alignment computation (`computeAlignmentTabs`, `findBestPerKind`), classification (`classifyCombination`), local minima detection, ecliptic span math. Uses a FIFO ephemeris cache (200k entries) keyed by `"bodyId:dateMs"`.
- `lib/astronomy.ts` — Heliocentric/geocentric positions, alt-az, moon phase, magnitude via astronomy-engine.
- `lib/coordinateConversion.ts` — EQJ↔scene, RA/Dec↔XYZ, ecliptic transforms.

### Component Organization

- `components/scene/` — Three.js Canvas children. Use `useFrame()` and read `simulationStore` directly.
- `components/panels/` — Floating panel wrappers. `FloatingPanel` for desktop, sheet-based for mobile.
- `components/alignment/` — Charts and analysis UI (Recharts-based + custom SVG/Canvas).
- `components/ui/` — Standalone controls (playback bar, toggles, selectors, tabs).

## Key Conventions

- All body/planet identifiers use the `CelestialBodyId` union type from `types.ts`
- Colors for AM/PM/Straddling series are defined once in `SERIES_COLORS` in `constants.ts`
- Body metadata (color, orbital period, orbit samples) lives in `BODY_META` in `constants.ts`
- Date range is 1975–2075 (`DATE_MIN`/`DATE_MAX` constants)
- Asset paths use `import.meta.env.BASE_URL` prefix (Vite `base: './'`)
- Test timeout is 60 seconds (astronomy computations can be slow)
- Tests live in `__tests__/` subdirectories as `*.test.ts` files
