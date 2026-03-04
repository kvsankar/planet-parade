import { ObserverLocation } from '../types'
import { findSunrise, findSunset, getAltAz, SkyBodyId } from './astronomy'

const MS_PER_DAY = 86_400_000
const TIME_SCAN_STEP_MS = 5 * 60 * 1000 // 5 minutes
const TARGET_VISIBLE_ALT_DEG = 0
const TARGET_ELEVATED_ALT_DEG = 2
const MAX_DARKNESS_SCORE_DEG = 18 // astronomical twilight ceiling

function dayStartUtc(baseDate: Date): Date {
  return new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    0, 0, 0, 0,
  ))
}

interface NightCandidate {
  dateMs: number
  visibleCount: number
  elevatedCount: number
  darknessScore: number
  minAltitude: number
  meanAltitude: number
}

export interface NightViewChoice {
  date: Date
  visibleCount: number
  elevatedCount: number
  darknessScore: number
  minAltitude: number
  meanAltitude: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isBetterNightCandidate(next: NightCandidate, prev: NightCandidate | null): boolean {
  if (!prev) return true

  // 1) Show as many cluster bodies as possible.
  if (next.visibleCount !== prev.visibleCount) return next.visibleCount > prev.visibleCount

  // 2) Prefer solutions where bodies clear the horizon with margin.
  if (next.elevatedCount !== prev.elevatedCount) return next.elevatedCount > prev.elevatedCount

  // 3) Minimize solar interference (darker sky), capped at astronomical darkness.
  if (next.darknessScore !== prev.darknessScore) return next.darknessScore > prev.darknessScore

  // 4) Keep the weakest body as high as possible.
  if (next.minAltitude !== prev.minAltitude) return next.minAltitude > prev.minAltitude

  // 5) Then maximize overall average altitude.
  if (next.meanAltitude !== prev.meanAltitude) return next.meanAltitude > prev.meanAltitude

  // 6) Deterministic tie-breaker.
  return next.dateMs < prev.dateMs
}

/**
 * Select the best nighttime instant in the given UTC day for showing a target cluster.
 *
 * Objective order:
 * - maximize number of targets above horizon,
 * - maximize number above a small safety altitude,
 * - minimize sunlight/twilight interference,
 * - then favor higher target altitudes.
 */
export function findBestPlanetariumNightTime(
  baseDate: Date,
  observer: ObserverLocation,
  targets: SkyBodyId[],
): NightViewChoice | null {
  if (targets.length === 0) return null

  const dayStart = dayStartUtc(baseDate).getTime()
  const dayEnd = dayStart + MS_PER_DAY
  let best: NightCandidate | null = null

  for (let t = dayStart; t < dayEnd; t += TIME_SCAN_STEP_MS) {
    const dt = new Date(t)
    const sunAltitude = getAltAz('Sun', dt, observer).altitude
    if (sunAltitude >= 0) continue

    let visibleCount = 0
    let elevatedCount = 0
    let minAltitude = Number.POSITIVE_INFINITY
    let sumAltitude = 0

    for (const bodyId of targets) {
      const altitude = getAltAz(bodyId, dt, observer).altitude
      if (altitude > TARGET_VISIBLE_ALT_DEG) visibleCount++
      if (altitude >= TARGET_ELEVATED_ALT_DEG) elevatedCount++
      minAltitude = Math.min(minAltitude, altitude)
      sumAltitude += altitude
    }

    const meanAltitude = sumAltitude / targets.length
    const darknessScore = clamp(-sunAltitude, 0, MAX_DARKNESS_SCORE_DEG)

    const candidate: NightCandidate = {
      dateMs: t,
      visibleCount,
      elevatedCount,
      darknessScore,
      minAltitude,
      meanAltitude,
    }

    if (isBetterNightCandidate(candidate, best)) {
      best = candidate
    }
  }

  return best
    ? {
      date: new Date(best.dateMs),
      visibleCount: best.visibleCount,
      elevatedCount: best.elevatedCount,
      darknessScore: best.darknessScore,
      minAltitude: best.minAltitude,
      meanAltitude: best.meanAltitude,
    }
    : null
}

/**
 * Earliest sunrise/sunset crossing in the UTC day, used as fallback when
 * no useful nighttime cluster view exists.
 */
export function findFirstSunOnHorizon(baseDate: Date, observer: ObserverLocation): Date | null {
  const start = dayStartUtc(baseDate)
  const dayStart = start.getTime()
  const dayEnd = dayStart + MS_PER_DAY

  const sunrise = findSunrise(start, observer)
  const sunset = findSunset(start, observer)
  const candidates = [sunrise, sunset]
    .filter((d): d is Date => d != null)
    .filter((d) => d.getTime() >= dayStart && d.getTime() < dayEnd)
    .sort((a, b) => a.getTime() - b.getTime())

  return candidates[0] ?? null
}
