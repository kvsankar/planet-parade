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
  showStars: boolean
  showMilkyWay: boolean
  showConstellations: boolean
  showConstellationBoundaries: boolean
  showCones: boolean
  toggleOrbits: () => void
  toggleLabels: () => void
  toggleForceInner: () => void
  toggleStars: () => void
  toggleMilkyWay: () => void
  toggleConstellations: () => void
  toggleConstellationBoundaries: () => void
  toggleCones: () => void
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

export interface AlignmentTabDataPoint {
  date: number                 // ms timestamp
  morningSep: number | null    // tightest AM span across all combos of this size
  eveningSep: number | null    // tightest PM span
  straddlingSep: number | null // tightest Straddling span
}

export interface ObserverLocation {
  lat: number    // degrees
  lon: number    // degrees
  height: number // meters
}

export type AlignmentKind = 'morning' | 'evening' | 'straddling'

export interface AlignmentMinimum {
  date: number // ms timestamp
  separation: number // degrees
  kind: AlignmentKind
  planetCount: number // number of planets in this grouping at this date
  planets: CelestialBodyId[] // which planets form this minimum
}

export interface AlignmentResult {
  tabs: Map<number, AlignmentTabDataPoint[]>  // keyed by planet count
  minima: Map<number, AlignmentMinimum[]>     // keyed by planet count
}
