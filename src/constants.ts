import { BodyMeta, CelestialBodyId } from './types'

export const AU_TO_SCENE = 10 // 1 AU = 10 Three.js units
export const MS_PER_DAY = 86_400_000

export const DATE_MIN = new Date('1975-01-01T00:00:00Z')
export const DATE_MAX = new Date('2075-01-01T00:00:00Z')

export const BODY_LIST: CelestialBodyId[] = [
  'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune',
]

export const BODY_META: Record<CelestialBodyId, BodyMeta> = {
  Sun:     { id: 'Sun',     color: '#FDB813', orbitalPeriodDays: 0,       orbitSamples: 0 },
  Moon:    { id: 'Moon',    color: '#BFC7D5', orbitalPeriodDays: 27.32,   orbitSamples: 180 },
  Mercury: { id: 'Mercury', color: '#B5B5B5', orbitalPeriodDays: 87.97,   orbitSamples: 180 },
  Venus:   { id: 'Venus',   color: '#E8CDA0', orbitalPeriodDays: 224.7,   orbitSamples: 180 },
  Earth:   { id: 'Earth',   color: '#6B93D6', orbitalPeriodDays: 365.25,  orbitSamples: 360 },
  Mars:    { id: 'Mars',    color: '#C1440E', orbitalPeriodDays: 687.0,   orbitSamples: 360 },
  Jupiter: { id: 'Jupiter', color: '#C88B3A', orbitalPeriodDays: 4332.59, orbitSamples: 360 },
  Saturn:  { id: 'Saturn',  color: '#EAD6B8', orbitalPeriodDays: 10759.2, orbitSamples: 360 },
  Uranus:  { id: 'Uranus',  color: '#D1E7E7', orbitalPeriodDays: 30688.5, orbitSamples: 360 },
  Neptune: { id: 'Neptune', color: '#5B5DDF', orbitalPeriodDays: 60182,   orbitSamples: 360 },
}

export interface SpeedOption {
  value: number
  label: string
}

export const SPEED_OPTIONS: SpeedOption[] = [
  { label: '1 min/s', value: 1 / 1440 },
  { label: '5 min/s', value: 5 / 1440 },
  { label: '15 min/s', value: 15 / 1440 },
  { label: '1 hr/s', value: 1 / 24 },
  { label: '6 hr/s', value: 6 / 24 },
  { label: '1 d/s', value: 1 },
  { label: '5 d/s', value: 5 },
  { label: '10 d/s', value: 10 },
  { label: '30 d/s', value: 30 },
  { label: '100 d/s', value: 100 },
  { label: '365 d/s', value: 365 },
  { label: '1000 d/s', value: 1000 },
  { label: '3650 d/s', value: 3650 },
]

export const DEFAULT_TIMELINE_SPEED = 1
export const DEFAULT_SKY_TIME_SPEED = SPEED_OPTIONS[1].value
export const DEFAULT_PLAYBACK_SPEED = DEFAULT_TIMELINE_SPEED

export const ANALYZABLE_BODIES: CelestialBodyId[] = [
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

export const GEOMETRY_ANALYZABLE_BODIES: CelestialBodyId[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

export const GEOMETRY_DEFAULT_BODIES: CelestialBodyId[] = [
  'Venus', 'Moon',
]

export const GEOMETRY_DEFAULT_MIN_PLANETS = 2
export const GEOMETRY_DEFAULT_MAX_PLANETS = 2

export const ANALYSIS_BODY_ORDER: CelestialBodyId[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

/** Per-count colors for the timeline chart */
export const COUNT_COLORS: Record<number, string> = {
  9: '#ffd54f',  // amber
  8: '#ffb74d',  // orange
  7: '#e8d44d',  // gold
  6: '#4fc3f7',  // sky blue
  5: '#66bb6a',  // green
  4: '#ff8a65',  // coral
  3: '#ce93d8',  // purple
  2: '#90a4ae',  // gray
}

/** Alignment series colors — single source of truth */
export const SERIES_COLORS = {
  straddling: '#CC6666', // light red — cluster straddles the Sun
  morning:    '#D4943A', // warm golden orange (sunrise / daytime)
  evening:    '#4466AA', // deep indigo blue (night sky)
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format a Date or ms timestamp as dd-Mmm-yyyy */
export function formatDate(d: Date | number, timeZone?: string | null): string {
  const dt = typeof d === 'number' ? new Date(d) : d
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).formatToParts(dt)
      const byType = new Map(parts.map((part) => [part.type, part.value]))
      const day = byType.get('day')
      const mon = byType.get('month')
      const year = byType.get('year')
      if (day && mon && year) return `${day}-${mon}-${year}`
    } catch {
      // Fall back to UTC formatting below.
    }
  }
  const day = String(dt.getUTCDate()).padStart(2, '0')
  const mon = MONTH_ABBR[dt.getUTCMonth()]
  const year = dt.getUTCFullYear()
  return `${day}-${mon}-${year}`
}

export const DURATION_PRESETS = [
  { label: '3 months', days: 91 },
  { label: '6 months', days: 182 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
  { label: '5 years', days: 1826 },
  { label: '10 years', days: 3652 },
  { label: '20 years', days: 7305 },
  { label: '50 years', days: 18262 },
  { label: '100 years', days: 36525 },
]
