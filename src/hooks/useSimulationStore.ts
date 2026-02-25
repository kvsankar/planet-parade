/**
 * Module-level singleton store for simulation state.
 * Uses plain mutable objects instead of React context so it works
 * reliably across the React ↔ R3F Canvas boundary.
 */
export const simulationStore = {
  date: new Date() as Date,
  isPlaying: false,
  speed: 10,
}
