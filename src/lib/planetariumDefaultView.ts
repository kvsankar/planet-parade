import { ObserverLocation } from '../types'
import { findSunrise, findSunset, getAltAz, SkyBodyId } from './astronomy'
import { getTimeZoneDayKey, getTimeZoneDayRange } from './timeZoneDay'

const MS_PER_DAY = 86_400_000
const TIME_SCAN_STEP_MS = 5 * 60 * 1000 // 5 minutes
const TARGET_VISIBLE_ALT_DEG = 0
const TARGET_ELEVATED_ALT_DEG = 2
const MAX_DARKNESS_SCORE_DEG = 18 // astronomical twilight ceiling

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
 * Select the best instant in the day containing `baseDate`.
 * If `timeZone` is provided, that day is evaluated in local-zone boundaries.
 *
 * Objective order:
 * - maximize number of targets above horizon,
 * - maximize number above a small safety altitude,
 * - then (for ties) minimize solar/twilight interference,
 * - then favor higher target altitudes.
 *
 * Preference rule:
 * - if at least one nighttime sample has any visible target, prefer the
 *   best nighttime sample; otherwise use the overall best sample.
 */
export function findBestPlanetariumNightTime(
  baseDate: Date,
  observer: ObserverLocation,
  targets: SkyBodyId[],
  timeZone?: string | null,
  preferNightVisible: boolean = true,
): NightViewChoice | null {
  if (targets.length === 0) return null

  const { startMs, endMs } = getTimeZoneDayRange(baseDate, timeZone)
  let bestAny: NightCandidate | null = null
  let bestNight: NightCandidate | null = null

  for (let t = startMs; t < endMs; t += TIME_SCAN_STEP_MS) {
    const dt = new Date(t)
    const sunAltitude = getAltAz('Sun', dt, observer).altitude
    const isNight = sunAltitude < 0

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

    if (isBetterNightCandidate(candidate, bestAny)) bestAny = candidate
    if (isNight && isBetterNightCandidate(candidate, bestNight)) bestNight = candidate
  }

  const chosen = preferNightVisible
    ? (bestNight && bestNight.visibleCount > 0 ? bestNight : bestAny)
    : bestAny
  return chosen
    ? {
      date: new Date(chosen.dateMs),
      visibleCount: chosen.visibleCount,
      elevatedCount: chosen.elevatedCount,
      darknessScore: chosen.darknessScore,
      minAltitude: chosen.minAltitude,
      meanAltitude: chosen.meanAltitude,
    }
    : null
}

/**
 * Closest sunrise/sunset crossing in the same evaluated day window, used as
 * fallback when no useful cluster view exists.
 */
export function findFirstSunOnHorizon(
  baseDate: Date,
  observer: ObserverLocation,
  timeZone?: string | null,
): Date | null {
  const { dayKey, startMs, endMs } = getTimeZoneDayRange(baseDate, timeZone)
  const searchAnchorsMs = [startMs - MS_PER_DAY, startMs, endMs]

  const candidates = searchAnchorsMs
    .flatMap((anchorMs) => {
      const anchorDate = new Date(anchorMs)
      return [
        findSunrise(anchorDate, observer),
        findSunset(anchorDate, observer),
      ]
    })
    .filter((d): d is Date => d != null)
    .filter((d) => getTimeZoneDayKey(d, timeZone) === dayKey)
    .filter((d) => d.getTime() >= startMs && d.getTime() < endMs)

  if (candidates.length === 0) return null

  const uniqueCandidates = Array.from(new Map(candidates.map((d) => [d.getTime(), d])).values())
  uniqueCandidates.sort((a, b) =>
    Math.abs(a.getTime() - baseDate.getTime()) - Math.abs(b.getTime() - baseDate.getTime()),
  )

  return uniqueCandidates[0] ?? null
}
