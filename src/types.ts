export type CelestialBodyId =
  | 'Sun'
  | 'Mercury'
  | 'Venus'
  | 'Earth'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'
  | 'Moon'

export interface BodyMeta {
  id: CelestialBodyId
  color: string
  orbitalPeriodDays: number
  orbitSamples: number
}

export interface SimulationTime {
  currentDate: Date
  isPlaying: boolean
  speed: number // days per real second
  setDate: (d: Date) => void
  togglePlay: () => void
  setSpeed: (s: number) => void
}

export interface SelectionState {
  selectedBodyId: CelestialBodyId | null
  followMode: boolean
  selectBody: (id: CelestialBodyId | null) => void
  toggleFollow: () => void
}

export interface DisplaySettings {
  showOrbits: boolean
  showLabels: boolean
  toggleOrbits: () => void
  toggleLabels: () => void
}

export interface AlignmentDataPoint {
  date: number // ms timestamp
  separation: number // degrees — total span
  morningSep: number | null // span of morning planets (west of Sun), null if not all in window
  eveningSep: number | null // span of evening planets (east of Sun), null if not all in window
}

export type AlignmentKind = 'total' | 'morning' | 'evening'

export interface AlignmentMinimum {
  date: number // ms timestamp
  separation: number // degrees
  kind: AlignmentKind
}
