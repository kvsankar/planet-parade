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
  forceInner: boolean
  toggleOrbits: () => void
  toggleLabels: () => void
  toggleForceInner: () => void
}

export interface AlignmentDataPoint {
  date: number // ms timestamp
  separation: number // degrees — total span
  morningSep: number | null // span of morning planets (west of Sun), null if not all in window
  eveningSep: number | null // span of evening planets (east of Sun), null if not all in window
  morningCount: number // number of planets west of Sun
  eveningCount: number // number of planets east of Sun
  totalCount: number // total number of selected planets
}

export type AlignmentKind = 'total' | 'morning' | 'evening'

export interface AlignmentMinimum {
  date: number // ms timestamp
  separation: number // degrees
  kind: AlignmentKind
  planetCount: number // number of planets in this grouping at this date
}
