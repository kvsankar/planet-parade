import { ObserverLocation } from '../types'

export type ObserverSource = 'default' | 'browser' | 'osm' | 'manual'

export interface ObserverLocationState {
  observer: ObserverLocation
  source: ObserverSource
  accuracyM: number | null
  timeZone: string | null
  label: string | null
  updatedAt: number
}

export const OBSERVER_LOCATION_STORAGE_KEY = 'solar-observer-location-v1'

export const DEFAULT_OBSERVER_LOCATION: ObserverLocation = Object.freeze({
  lat: 0,
  lon: 0,
  height: 0,
})

const MIN_LAT_DEG = -90
const MAX_LAT_DEG = 90
const MIN_HEIGHT_M = -500
const MAX_HEIGHT_M = 12_000
const VALID_SOURCES = new Set<ObserverSource>(['default', 'browser', 'osm', 'manual'])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeLongitudeDeg(lonDeg: number): number {
  const lon = finiteOrDefault(lonDeg, 0)
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180
  return Object.is(wrapped, -0) ? 0 : wrapped
}

export function sanitizeObserverLocation(value: Partial<ObserverLocation> | ObserverLocation): ObserverLocation {
  return {
    lat: clamp(finiteOrDefault(value.lat, DEFAULT_OBSERVER_LOCATION.lat), MIN_LAT_DEG, MAX_LAT_DEG),
    lon: normalizeLongitudeDeg(finiteOrDefault(value.lon, DEFAULT_OBSERVER_LOCATION.lon)),
    height: clamp(
      finiteOrDefault(value.height, DEFAULT_OBSERVER_LOCATION.height),
      MIN_HEIGHT_M,
      MAX_HEIGHT_M,
    ),
  }
}

export function makeDefaultObserverLocationState(): ObserverLocationState {
  return {
    observer: { ...DEFAULT_OBSERVER_LOCATION },
    source: 'default',
    accuracyM: null,
    timeZone: null,
    label: null,
    updatedAt: Date.now(),
  }
}

export function sanitizeTimeZone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    // Validate that the environment recognizes this IANA zone id.
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return trimmed
  } catch {
    return null
  }
}

export function sanitizeObserverLocationState(
  value: Partial<ObserverLocationState> | null | undefined,
): ObserverLocationState {
  const source = VALID_SOURCES.has(value?.source as ObserverSource)
    ? (value?.source as ObserverSource)
    : 'default'

  const accuracyM = typeof value?.accuracyM === 'number' && Number.isFinite(value.accuracyM) && value.accuracyM >= 0
    ? value.accuracyM
    : null

  const label = typeof value?.label === 'string'
    ? value.label.trim().slice(0, 240) || null
    : null

  const updatedAt = typeof value?.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
    ? value.updatedAt
    : Date.now()

  return {
    observer: sanitizeObserverLocation(value?.observer ?? DEFAULT_OBSERVER_LOCATION),
    source,
    accuracyM,
    timeZone: sanitizeTimeZone(value?.timeZone),
    label,
    updatedAt,
  }
}

export function parseObserverLocationState(raw: string | null): ObserverLocationState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ObserverLocationState>
    return sanitizeObserverLocationState(parsed)
  } catch {
    return null
  }
}

export function serializeObserverLocationState(state: ObserverLocationState): string {
  return JSON.stringify(sanitizeObserverLocationState(state))
}

export function formatObserverLatLon(observer: ObserverLocation, decimals = 1): string {
  const latDir = observer.lat >= 0 ? 'N' : 'S'
  const lonDir = observer.lon >= 0 ? 'E' : 'W'
  return `${Math.abs(observer.lat).toFixed(decimals)}°${latDir} ${Math.abs(observer.lon).toFixed(decimals)}°${lonDir}`
}
