/**
 * Alignment algorithm validation against real-world documented events.
 *
 * Cross-checks computeAlignmentSeries + findLocalMinima output against
 * well-known planetary alignment events from astronomical records.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import {
  getGeocentricEclipticCoords,
  computeMaxSpan,
  computeAlignmentSeries,
  findLocalMinima,
} from '../alignment'
import type { CelestialBodyId } from '../../types'
import type { AlignmentDataPoint, AlignmentMinimum } from '../../types'

// ─── Ground truth events ────────────────────────────────────────────────
interface GroundTruthEvent {
  label: string
  peakDate: string // ISO date
  bodies: CelestialBodyId[]
  sky: 'morning' | 'evening' | 'total'
  minPlanets: number
  toleranceDays: number
  maxExpectedSeparation: number // degrees — the minimum's separation should be below this
}

const EVENTS: GroundTruthEvent[] = [
  {
    label: '5 naked-eye planets morning (Jun 2022)',
    peakDate: '2022-06-03',
    bodies: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    sky: 'morning',
    minPlanets: 4, // N-1: Mercury may cross AM/PM boundary
    toleranceDays: 15,
    maxExpectedSeparation: 130, // documented ~91° visual arc; ecliptic lon span is wider
  },
  {
    label: '6-planet evening alignment (Jan 2025)',
    peakDate: '2025-01-21',
    bodies: ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    sky: 'evening',
    minPlanets: 5,
    toleranceDays: 15,
    maxExpectedSeparation: 180,
  },
  {
    label: '7-planet grand parade (Feb 2025)',
    peakDate: '2025-02-28',
    bodies: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    sky: 'evening',
    minPlanets: 6,
    toleranceDays: 15,
    maxExpectedSeparation: 180,
  },
  {
    label: '6-planet evening alignment (Feb 2026)',
    peakDate: '2026-02-28',
    bodies: ['Mercury', 'Venus', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    sky: 'evening',
    minPlanets: 5,
    toleranceDays: 15,
    maxExpectedSeparation: 180,
  },
]

// ─── Computed results (populated in beforeAll) ──────────────────────────
interface EventResult {
  label: string
  peakDate: string
  series: { length: number; firstDate: string; lastDate: string }
  totalMinima: AlignmentMinimum[]
  morningMinima: AlignmentMinimum[]
  eveningMinima: AlignmentMinimum[]
  closestMinimum: AlignmentMinimum | null
  closestDayOffset: number | null
}

const results: EventResult[] = []

// ─── Ephemeris sanity checks ────────────────────────────────────────────
describe('Ephemeris sanity checks', () => {
  it('getGeocentricEclipticCoords returns plausible longitudes', () => {
    const date = new Date('2025-01-01T00:00:00Z')
    const bodies: CelestialBodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    for (const body of bodies) {
      const coords = getGeocentricEclipticCoords(body, date)
      expect(coords.lon).toBeGreaterThanOrEqual(0)
      expect(coords.lon).toBeLessThan(360)
      expect(coords.lat).toBeGreaterThanOrEqual(-90)
      expect(coords.lat).toBeLessThanOrEqual(90)
    }
  })

  it('computeMaxSpan handles basic cases correctly', () => {
    expect(computeMaxSpan([0, 90])).toBe(90)
    expect(computeMaxSpan([10, 20, 30])).toBe(20)
    // Wraparound: 350° and 10° → span should be 20°
    expect(computeMaxSpan([350, 10])).toBe(20)
    expect(computeMaxSpan([350, 355, 5, 10])).toBe(20)
  })

  it('computeMaxSpan returns 0 for fewer than 2 values', () => {
    expect(computeMaxSpan([])).toBe(0)
    expect(computeMaxSpan([42])).toBe(0)
  })
})

// ─── Alignment event validation ─────────────────────────────────────────
describe('Alignment validation against real-world events', () => {
  // Pre-compute all event series (expensive)
  const computed = new Map<
    string,
    { series: AlignmentDataPoint[]; totalMin: AlignmentMinimum[]; morningMin: AlignmentMinimum[]; eveningMin: AlignmentMinimum[] }
  >()

  beforeAll(() => {
    for (const event of EVENTS) {
      const peak = new Date(event.peakDate + 'T00:00:00Z')
      const windowDays = 90
      const start = new Date(peak.getTime() - windowDays / 2 * 86_400_000)

      const series = computeAlignmentSeries(event.bodies, start, windowDays, event.minPlanets)
      const totalMin = findLocalMinima(series, 'separation', 'total')
      const morningMin = findLocalMinima(series, 'morningSep', 'morning')
      const eveningMin = findLocalMinima(series, 'eveningSep', 'evening')

      computed.set(event.label, { series, totalMin, morningMin, eveningMin })
    }
  })

  afterAll(() => {
    // Write computed results to JSON for inspection
    const outDir = resolve(__dirname, '..', '..', '..', 'test-output')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      resolve(outDir, 'alignment-validation.json'),
      JSON.stringify(results, null, 2),
    )
  })

  for (const event of EVENTS) {
    describe(event.label, () => {
      it('produces a non-empty series with reasonable values', () => {
        const { series } = computed.get(event.label)!
        expect(series.length).toBeGreaterThan(0)

        // Spot-check: total separation should be in [0, 360]
        for (const pt of series) {
          expect(pt.separation).toBeGreaterThanOrEqual(0)
          expect(pt.separation).toBeLessThanOrEqual(360)
        }
      })

      it('finds at least one minimum of the expected kind', () => {
        const data = computed.get(event.label)!
        const relevantMinima =
          event.sky === 'morning' ? data.morningMin :
          event.sky === 'evening' ? data.eveningMin :
          data.totalMin

        expect(relevantMinima.length).toBeGreaterThan(0)
      })

      it(`has a minimum within ±${EVENTS[0].toleranceDays} days of the documented peak`, () => {
        const data = computed.get(event.label)!
        const peakMs = new Date(event.peakDate + 'T00:00:00Z').getTime()

        // Gather all minima from the relevant sky + total as fallback
        const relevantMinima =
          event.sky === 'morning' ? data.morningMin :
          event.sky === 'evening' ? data.eveningMin :
          data.totalMin
        const allMinima = [...relevantMinima, ...data.totalMin]

        let closest: AlignmentMinimum | null = null
        let closestOffset = Infinity
        for (const m of allMinima) {
          const offset = Math.abs(m.date - peakMs) / 86_400_000
          if (offset < closestOffset) {
            closestOffset = offset
            closest = m
          }
        }

        expect(closest).not.toBeNull()
        expect(closestOffset).toBeLessThanOrEqual(event.toleranceDays)

        // Record for output
        results.push({
          label: event.label,
          peakDate: event.peakDate,
          series: {
            length: data.series.length,
            firstDate: new Date(data.series[0].date).toISOString().slice(0, 10),
            lastDate: new Date(data.series[data.series.length - 1].date).toISOString().slice(0, 10),
          },
          totalMinima: data.totalMin,
          morningMinima: data.morningMin,
          eveningMinima: data.eveningMin,
          closestMinimum: closest,
          closestDayOffset: closestOffset,
        })
      })

      it('separation at minimum is reasonable (> 0° and < maxExpectedSeparation)', () => {
        const data = computed.get(event.label)!
        const relevantMinima =
          event.sky === 'morning' ? data.morningMin :
          event.sky === 'evening' ? data.eveningMin :
          data.totalMin

        for (const m of relevantMinima) {
          expect(m.separation).toBeGreaterThan(0)
          expect(m.separation).toBeLessThan(event.maxExpectedSeparation)
        }
      })

      it('planet count at peak is plausible', () => {
        const data = computed.get(event.label)!
        const peakMs = new Date(event.peakDate + 'T00:00:00Z').getTime()

        // Find the data point closest to the peak date
        let closestPt = data.series[0]
        let closestDist = Infinity
        for (const pt of data.series) {
          const dist = Math.abs(pt.date - peakMs)
          if (dist < closestDist) {
            closestDist = dist
            closestPt = pt
          }
        }

        if (event.sky === 'morning') {
          expect(closestPt.morningCount).toBeGreaterThanOrEqual(event.minPlanets)
        } else if (event.sky === 'evening') {
          expect(closestPt.eveningCount).toBeGreaterThanOrEqual(event.minPlanets)
        }
        expect(closestPt.totalCount).toBe(event.bodies.length)
      })
    })
  }
})
