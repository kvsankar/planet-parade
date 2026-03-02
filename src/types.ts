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
  showPPIOverlay: boolean
  toggleOrbits: () => void
  toggleLabels: () => void
  toggleForceInner: () => void
  toggleStars: () => void
  toggleMilkyWay: () => void
  toggleConstellations: () => void
  toggleConstellationBoundaries: () => void
  toggleCones: () => void
  togglePPIOverlay: () => void
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

export interface PPIWeights {
  alpha: number      // count exponent (default 1.2)
  beta: number       // compactness exponent (default 1.2); alpha + beta = 2.4
  gamma: number      // brightness exponent (default 0.5)
  delta: number      // elongation gate strength 0–1 (0 = pure geometry, 1 = full visibility gate)
  spanScale: number  // span decay constant in degrees (default 180)
}

export interface PPIDayPoint {
  date: number
  ppi: number
  span: number
  kind: AlignmentKind
  planetCount: number
  planets: CelestialBodyId[]
  brightness: number
  elongVisibility: number
}

export type ChartMetric = 'ppi' | 'span'
export type NavMode = 'ppi' | 'span'

export interface CountDayBest {
  ppi: number
  span: number
  kind: AlignmentKind
  planets: CelestialBodyId[]
}

export interface PPIResult {
  ppiSeries: { date: number; ppi: number }[]
  ppiPeaks: PPIDayPoint[]
  spanMinima: PPIDayPoint[]
  dates: number[]
  countBests: Map<number, (CountDayBest | null)[]>
}
