import {
  CelestialBodyId,
  AlignmentKind,
  PPIWeights,
  PPIDayPoint,
  PPIResult,
} from '../types'
import { MS_PER_DAY } from '../constants'
import {
  getGeocentricEclipticCoords,
  computeMaxSpan,
  wrap180,
  classifyCombination,
  combinations,
} from './alignment'
import { getBodyVisualMagnitude, SkyBodyId } from './astronomy'

export const DEFAULT_PPI_WEIGHTS: PPIWeights = { alpha: 1.2, beta: 1.2, gamma: 0.5, spanScale: 180 }

/** Per-planet brightness weight: maps visual magnitude to [0.01, 1.0] */
export function brightnessWeight(mag: number): number {
  return Math.max(0.01, Math.min(1.0, (6.5 - mag) / 6.5))
}

/** Per-planet elongation visibility gate */
export function elongationWeight(absElong: number): number {
  if (absElong < 10) return 0
  if (absElong < 20) return 0.3
  if (absElong < 30) return 0.7
  return 1.0
}

export interface ComboPPIResult {
  ppi: number
  brightness: number
  elongVisibility: number
}

/** Compute PPI for a single combination */
export function computeComboPPI(
  k: number,
  N: number,
  span: number,
  mags: number[],
  absElongs: number[],
  weights: PPIWeights,
): ComboPPIResult {
  // Geometric mean of brightness weights
  let logBright = 0
  for (let i = 0; i < k; i++) {
    logBright += Math.log(brightnessWeight(mags[i]))
  }
  const brightness = Math.exp(logBright / k)

  // Minimum elongation weight — the least-visible planet is the bottleneck
  let elongVisibility = Infinity
  for (let i = 0; i < k; i++) {
    const ew = elongationWeight(absElongs[i])
    if (ew === 0) return { ppi: 0, brightness, elongVisibility: 0 }
    if (ew < elongVisibility) elongVisibility = ew
  }

  const countFactor = Math.pow(k / N, weights.alpha)
  const compactFactor = Math.pow(Math.exp(-span / weights.spanScale), weights.beta)
  const brightFactor = Math.pow(brightness, weights.gamma)

  const ppi = countFactor * compactFactor * brightFactor * elongVisibility * 100

  return { ppi, brightness, elongVisibility }
}

/** Pre-computed ephemeris for PPI computation */
interface PPIDayEphemeris {
  dateMs: number
  sunLon: number
  bodyLons: number[]
  bodyElongs: number[]     // signed elongation from Sun
  bodyAbsElongs: number[]  // absolute elongation
  bodyMags: number[]       // visual magnitudes
}

/** Main PPI computation across all days and combinations */
export function computePPIResults(
  bodies: CelestialBodyId[],
  startDate: Date,
  durationDays: number,
  minPlanets: number,
  weights: PPIWeights,
): PPIResult {
  const N = bodies.length
  const lowK = Math.max(2, minPlanets)
  const numDays = durationDays + 1
  const startMs = startDate.getTime()

  if (N < 2) return { ppiSeries: [], ppiPeaks: [] }

  // Phase 1: Pre-compute ephemeris for all days
  const ephemeris: PPIDayEphemeris[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    const dateMs = startMs + d * MS_PER_DAY
    const date = new Date(dateMs)
    const sunLon = getGeocentricEclipticCoords('Sun', date).lon
    const bodyLons: number[] = new Array(N)
    const bodyElongs: number[] = new Array(N)
    const bodyAbsElongs: number[] = new Array(N)
    const bodyMags: number[] = new Array(N)
    for (let b = 0; b < N; b++) {
      bodyLons[b] = getGeocentricEclipticCoords(bodies[b], date).lon
      bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
      bodyAbsElongs[b] = Math.abs(bodyElongs[b])
      bodyMags[b] = getBodyVisualMagnitude(bodies[b] as SkyBodyId, date) ?? 6.5
    }
    ephemeris[d] = { dateMs, sunLon, bodyLons, bodyElongs, bodyAbsElongs, bodyMags }
  }

  // Phase 2: For each day, find the best-PPI combo across all k and all kinds
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  interface DayBest {
    ppi: number
    span: number
    kind: AlignmentKind
    planets: CelestialBodyId[]
    planetCount: number
    brightness: number
    elongVisibility: number
  }

  const dayBests: (DayBest | null)[] = new Array(numDays)

  for (let d = 0; d < numDays; d++) {
    const day = ephemeris[d]
    let best: DayBest | null = null

    for (let k = N; k >= lowK; k--) {
      const evaluate = (combo: number[]) => {
        const lons = combo.map((i) => day.bodyLons[i])
        const elongs = combo.map((i) => day.bodyElongs[i])
        const absElongs = combo.map((i) => day.bodyAbsElongs[i])
        const mags = combo.map((i) => day.bodyMags[i])
        const span = computeMaxSpan(lons)
        const kind = classifyCombination(elongs, lons, day.sunLon)

        if (kind === 'straddling') return

        const result = computeComboPPI(k, N, span, mags, absElongs, weights)
        if (result.ppi > (best?.ppi ?? 0)) {
          best = {
            ppi: result.ppi,
            span,
            kind,
            planets: combo.map((i) => bodies[i]),
            planetCount: k,
            brightness: result.brightness,
            elongVisibility: result.elongVisibility,
          }
        }
      }

      if (k === N) {
        evaluate(bodyIndices)
      } else {
        for (const combo of combinations(bodyIndices, k)) {
          evaluate(combo)
        }
      }
    }

    dayBests[d] = best
  }

  // Phase 3: Build ppiSeries
  const ppiSeries: { date: number; ppi: number }[] = new Array(numDays)
  for (let d = 0; d < numDays; d++) {
    ppiSeries[d] = { date: ephemeris[d].dateMs, ppi: dayBests[d]?.ppi ?? 0 }
  }

  // Phase 4: Find local maxima (peaks)
  const ppiPeaks = findPPIPeaks(ppiSeries, dayBests)

  return { ppiSeries, ppiPeaks }
}

/** Compute ALL non-zero PPI combos for a single date */
export function computeDayCombos(
  bodies: CelestialBodyId[],
  date: Date,
  minPlanets: number,
  weights: PPIWeights,
): PPIDayPoint[] {
  const N = bodies.length
  if (N < 2) return []

  const lowK = Math.max(2, minPlanets)
  const dateMs = date.getTime()

  // Pre-compute ephemeris for this single day
  const sunLon = getGeocentricEclipticCoords('Sun', date).lon
  const bodyLons: number[] = new Array(N)
  const bodyElongs: number[] = new Array(N)
  const bodyAbsElongs: number[] = new Array(N)
  const bodyMags: number[] = new Array(N)
  for (let b = 0; b < N; b++) {
    bodyLons[b] = getGeocentricEclipticCoords(bodies[b], date).lon
    bodyElongs[b] = wrap180(bodyLons[b] - sunLon)
    bodyAbsElongs[b] = Math.abs(bodyElongs[b])
    bodyMags[b] = getBodyVisualMagnitude(bodies[b] as SkyBodyId, date) ?? 6.5
  }

  const results: PPIDayPoint[] = []
  const bodyIndices = Array.from({ length: N }, (_, i) => i)

  for (let k = N; k >= lowK; k--) {
    const evaluate = (combo: number[]) => {
      const lons = combo.map((i) => bodyLons[i])
      const elongs = combo.map((i) => bodyElongs[i])
      const absElongs = combo.map((i) => bodyAbsElongs[i])
      const mags = combo.map((i) => bodyMags[i])
      const span = computeMaxSpan(lons)
      const kind = classifyCombination(elongs, lons, sunLon)

      if (kind === 'straddling') return

      const result = computeComboPPI(k, N, span, mags, absElongs, weights)
      if (result.ppi > 0) {
        results.push({
          date: dateMs,
          ppi: result.ppi,
          span,
          kind,
          planetCount: k,
          planets: combo.map((i) => bodies[i]),
          brightness: result.brightness,
          elongVisibility: result.elongVisibility,
        })
      }
    }

    if (k === N) {
      evaluate(bodyIndices)
    } else {
      for (const combo of combinations(bodyIndices, k)) {
        evaluate(combo)
      }
    }
  }

  // Sort by PPI descending
  results.sort((a, b) => b.ppi - a.ppi)
  return results
}

/** Find local maxima in the PPI time series */
export function findPPIPeaks(
  series: { date: number; ppi: number }[],
  dayDetails: (PPIDayPoint | { ppi: number; span: number; kind: AlignmentKind; planets: CelestialBodyId[]; planetCount: number; brightness: number; elongVisibility: number } | null)[],
): PPIDayPoint[] {
  if (series.length < 3) return []

  const val = (i: number) => series[i].ppi
  const peaks: PPIDayPoint[] = []

  const addPeak = (i: number) => {
    const detail = dayDetails[i]
    if (!detail || detail.ppi <= 0) return
    peaks.push({
      date: series[i].date,
      ppi: detail.ppi,
      span: detail.span,
      kind: detail.kind,
      planetCount: detail.planetCount,
      planets: detail.planets,
      brightness: detail.brightness,
      elongVisibility: detail.elongVisibility,
    })
  }

  // Check start
  if (val(0) > 0 && val(0) >= val(1)) {
    addPeak(0)
  }

  // Interior points
  let i = 1
  while (i < series.length - 1) {
    if (val(i) >= val(i - 1)) {
      let j = i
      while (j < series.length - 1 && val(j + 1) === val(i)) j++
      const leftHigher = val(i) > val(i - 1)
      const rightHigher = j >= series.length - 1 || val(i) > val(j + 1)
      if (leftHigher && rightHigher) {
        const mid = Math.floor((i + j) / 2)
        addPeak(mid)
      }
      i = j + 1
    } else {
      i++
    }
  }

  // Check end
  const last = series.length - 1
  if (val(last) > 0 && val(last) >= val(last - 1)) {
    addPeak(last)
  }

  return peaks
}
