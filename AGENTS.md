# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React 19 + TypeScript app for planetary alignment and sky visualization.

- `src/components/scene/`: Three.js/R3F rendering (solar system + planetarium views).
- `src/components/alignment/`, `src/components/panels/`, `src/components/ui/`: analysis UI, panel shells, and shared controls.
- `src/lib/`: core astronomy, alignment, mode-aware ranking (Visibility/PPI + Geometry/Span), visibility, and coordinate math.
- `src/hooks/`: state and behavior hooks (`useSimulationStore`, `useAlignmentState`, etc.).
- `src/data/`: star catalogs, constellation data, Milky Way assets metadata.
- `docs/`: algorithm and performance notes.
- `scripts/perf/`: Playwright profiling and regression checks.

## Build, Test, and Development Commands
Use Node `24.x` (`nvm use`), then:

- `npm install`: install dependencies.
- `npm run dev`: start local dev server (`http://localhost:5173`).
- `npm run build`: type-check (`tsc`) and create production build in `dist/`.
- `npm run preview`: serve built assets locally.
- `npm run test`: run all Vitest tests once.
- `npm run test:watch`: run tests in watch mode.
- `npm run perf:profile:repeat`: run repeat Playwright profiling and generate median summary.
- `npm run perf:profile:check`: compare profiling results to committed baseline.

## Coding Style & Naming Conventions
- TypeScript is strict-mode gated (`tsconfig.json`); keep types explicit at module boundaries.
- Follow existing code style: 2-space indentation, single quotes, no trailing semicolons.
- Components and types: `PascalCase`; hooks/functions/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep astronomy/domain logic in `src/lib/`; keep rendering concerns in `src/components/scene/`.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`), with tests included via `src/**/*.test.ts`.
- Place tests in `__tests__/` folders or as `*.test.ts` beside modules.
- Add/adjust tests for any change to alignment math, ranking modes (Visibility/Geometry), coordinate conversion, or time/day logic.
- Run a single file when iterating: `npx vitest run src/lib/__tests__/alignment.validation.test.ts`.

## Commit & Pull Request Guidelines
- Recent history favors short, typed commit subjects: `fix: ...`, `perf: ...`, `docs: ...`, `chore: ...`.
- Keep commits focused; separate refactors from behavior changes.
- PRs should include: clear summary, linked issue (if applicable), test evidence (`npm run test`, `npm run build`), and screenshots for UI changes (`screenshots/`).
- For performance-impacting changes, include profiling results and note whether baseline files in `scripts/perf/` were intentionally updated.
