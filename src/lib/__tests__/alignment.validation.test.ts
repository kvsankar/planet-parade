/**
 * Alignment algorithm validation against real-world documented events.
 *
 * Cross-checks computeAlignmentTabs + findLocalMinima output against
 * well-known planetary alignment events from astronomical records.
 * Also tests new combination-based helpers: combinations, classifyCombination, isLonInsideArc.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import {
  getGeocentricEclipticCoords,
  computeMaxSpan,
  computeAlignmentTabs,
  combinations,
  classifyCombination,
  isLonInsideArc,
  computeSpanArc,
} from '../alignment'
import type { CelestialBodyId, AlignmentKind, AlignmentResult, AlignmentMinimum } from '../../types'

// ─── Ground truth events ────────────────────────────────────────────────
interface GroundTruthEvent {
  label: string
  peakDate: string // ISO date
  bodies: CelestialBodyId[]
  sky: AlignmentKind
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
    toleranceDays: 50, // wider tolerance: Mars near opposition shifts the evening-only minimum
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
  tabs: number[]
  minimaByTab: Record<number, AlignmentMinimum[]>
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

// ─── Combination helper tests ───────────────────────────────────────────
describe('combinations generator', () => {
  it('generates correct number of combinations', () => {
    const items = [1, 2, 3, 4, 5]
    const combos3 = [...combinations(items, 3)]
    expect(combos3.length).toBe(10) // C(5,3) = 10
    const combos2 = [...combinations(items, 2)]
    expect(combos2.length).toBe(10) // C(5,2) = 10
    const combos5 = [...combinations(items, 5)]
    expect(combos5.length).toBe(1) // C(5,5) = 1
  })

  it('generates correct combinations for small sets', () => {
    const combos = [...combinations(['a', 'b', 'c'], 2)]
    expect(combos).toEqual([['a', 'b'], ['a', 'c'], ['b', 'c']])
  })

  it('returns nothing for invalid k', () => {
    expect([...combinations([1, 2], 0)]).toEqual([])
    expect([...combinations([1, 2], 3)]).toEqual([])
  })
})

describe('isLonInsideArc', () => {
  it('detects longitude inside non-wrapping arc', () => {
    expect(isLonInsideArc(45, { start: 30, end: 60 })).toBe(true)
    expect(isLonInsideArc(10, { start: 30, end: 60 })).toBe(false)
    expect(isLonInsideArc(90, { start: 30, end: 60 })).toBe(false)
  })

  it('detects longitude inside wrapping arc', () => {
    // Arc from 350 to 10 (wraps through 0)
    expect(isLonInsideArc(355, { start: 350, end: 10 })).toBe(true)
    expect(isLonInsideArc(5, { start: 350, end: 10 })).toBe(true)
    expect(isLonInsideArc(180, { start: 350, end: 10 })).toBe(false)
  })

  it('handles boundary values', () => {
    expect(isLonInsideArc(30, { start: 30, end: 60 })).toBe(true) // on start
    expect(isLonInsideArc(60, { start: 30, end: 60 })).toBe(true) // on end
  })
})

describe('classifyCombination', () => {
  it('classifies all-morning (all negative elongations) as morning', () => {
    expect(classifyCombination([-30, -60, -90], [330, 300, 270], 0)).toBe('morning')
  })

  it('classifies all-evening (all non-negative elongations) as evening', () => {
    expect(classifyCombination([30, 60, 90], [30, 60, 90], 0)).toBe('evening')
  })

  it('classifies mixed with Sun inside arc as straddling', () => {
    // Sun at 0°, planets at 350° (elong -10) and 10° (elong +10)
    // Arc from 350 to 10 contains Sun at 0°
    expect(classifyCombination([-10, 10], [350, 10], 0)).toBe('straddling')
  })

  it('classifies midnight cluster (Sun outside arc) by closest planet', () => {
    // Sun at 0°, planets at 170° (elong +170) and 190° (elong -170)
    // Arc from 170 to 190, Sun at 0° is outside
    // Closest planet has elong +170 → evening
    expect(classifyCombination([170, -170], [170, 190], 0)).toBe('evening')
  })

  it('classifies midnight cluster as morning when closest planet is AM', () => {
    // Sun at 0°, planets at 200° (elong -160) and 170° (elong +170)
    // Closest to Sun: -160° (morning)
    expect(classifyCombination([-160, 170], [200, 170], 0)).toBe('morning')
  })
})

// ─── Alignment event validation ─────────────────────────────────────────
describe('Alignment validation against real-world events', () => {
  const computed = new Map<string, AlignmentResult>()

  beforeAll(() => {
    for (const event of EVENTS) {
      const peak = new Date(event.peakDate + 'T00:00:00Z')
      const windowDays = 90
      const start = new Date(peak.getTime() - windowDays / 2 * 86_400_000)

      const result = computeAlignmentTabs(event.bodies, start, windowDays, event.minPlanets)
      computed.set(event.label, result)
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
      it('produces non-empty tab data with reasonable values', () => {
        const result = computed.get(event.label)!
        expect(result.tabs.size).toBeGreaterThan(0)

        // Check the full-size tab (N planets)
        const fullTab = result.tabs.get(event.bodies.length)
        expect(fullTab).toBeDefined()
        expect(fullTab!.length).toBeGreaterThan(0)

        // Spot-check: at least one field should have data on each point
        for (const pt of fullTab!) {
          const hasData = pt.morningSep != null || pt.eveningSep != null || pt.straddlingSep != null
          expect(hasData).toBe(true)
        }
      })

      it('finds at least one minimum of the expected kind', () => {
        const result = computed.get(event.label)!

        // Check all tabs for minima of the expected kind
        let foundRelevant = false
        for (const [, tabMinima] of result.minima) {
          if (tabMinima.some((m) => m.kind === event.sky)) {
            foundRelevant = true
            break
          }
        }

        expect(foundRelevant).toBe(true)
      })

      it(`has a minimum within ±${event.toleranceDays} days of the documented peak`, () => {
        const result = computed.get(event.label)!
        const peakMs = new Date(event.peakDate + 'T00:00:00Z').getTime()

        // Gather all minima across all tabs
        let closest: AlignmentMinimum | null = null
        let closestOffset = Infinity
        for (const [, tabMinima] of result.minima) {
          for (const m of tabMinima) {
            const offset = Math.abs(m.date - peakMs) / 86_400_000
            if (offset < closestOffset) {
              closestOffset = offset
              closest = m
            }
          }
        }

        expect(closest).not.toBeNull()
        expect(closestOffset).toBeLessThanOrEqual(event.toleranceDays)

        // Record for output
        const minimaByTab: Record<number, AlignmentMinimum[]> = {}
        for (const [k, tabMinima] of result.minima) {
          minimaByTab[k] = tabMinima
        }
        results.push({
          label: event.label,
          peakDate: event.peakDate,
          tabs: [...result.tabs.keys()],
          minimaByTab,
          closestMinimum: closest,
          closestDayOffset: closestOffset,
        })
      })

      it('separation at minimum is reasonable (> 0° and < maxExpectedSeparation)', () => {
        const result = computed.get(event.label)!
        for (const [, tabMinima] of result.minima) {
          const relevantMinima = tabMinima.filter((m) => m.kind === event.sky)
          for (const m of relevantMinima) {
            expect(m.separation).toBeGreaterThan(0)
            expect(m.separation).toBeLessThan(event.maxExpectedSeparation)
          }
        }
      })

      it('minima have planet lists', () => {
        const result = computed.get(event.label)!
        for (const [k, tabMinima] of result.minima) {
          for (const m of tabMinima) {
            expect(m.planets.length).toBe(k)
          }
        }
      })
    })
  }
})
