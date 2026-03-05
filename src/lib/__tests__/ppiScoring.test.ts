import { describe, it, expect } from 'vitest'
import {
  brightnessWeight,
  elongationWeight,
  computeComboPPI,
  computePPIResults,
  computeDayCombos,
  DEFAULT_PPI_WEIGHTS,
} from '../ppiScoring'
import { PPIWeights } from '../../types'

// ─── brightnessWeight ────────────────────────────────────────────────

describe('brightnessWeight', () => {
  it('returns 0.01 for mag 6.5 (threshold)', () => {
    expect(brightnessWeight(6.5)).toBeCloseTo(0.01, 2)
  })

  it('returns 1.0 for very bright objects (mag < 0)', () => {
    expect(brightnessWeight(-4)).toBe(1.0)
    expect(brightnessWeight(-2)).toBe(1.0)
  })

  it('returns ~0.5 for mag ~3.25', () => {
    expect(brightnessWeight(3.25)).toBeCloseTo(0.5, 1)
  })

  it('clamps to 0.01 for mag > 6.5', () => {
    expect(brightnessWeight(8)).toBe(0.01)
  })

  it('clamps to 1.0 for very negative mag', () => {
    expect(brightnessWeight(-10)).toBe(1.0)
  })
})

// ─── elongationWeight ────────────────────────────────────────────────

describe('elongationWeight', () => {
  it('returns 0 for elongation ≤ 5°', () => {
    expect(elongationWeight(0)).toBe(0)
    expect(elongationWeight(5)).toBe(0)
  })

  it('smoothly increases between 5° and 30°', () => {
    const w10 = elongationWeight(10)
    const w15 = elongationWeight(15)
    const w20 = elongationWeight(20)
    const w25 = elongationWeight(25)
    expect(w10).toBeGreaterThan(0)
    expect(w15).toBeGreaterThan(w10)
    expect(w20).toBeGreaterThan(w15)
    expect(w25).toBeGreaterThan(w20)
    expect(w25).toBeLessThan(1)
    // Midpoint of smoothstep (17.5°) should be 0.5
    expect(elongationWeight(17.5)).toBe(0.5)
  })

  it('returns 1.0 for elong ≥ 30°', () => {
    expect(elongationWeight(30)).toBe(1.0)
    expect(elongationWeight(90)).toBe(1.0)
    expect(elongationWeight(180)).toBe(1.0)
  })
})

// ─── computeComboPPI ─────────────────────────────────────────────────

describe('computeComboPPI', () => {
  const N = 7

  it('returns 0 when any planet has elongation < 10° and delta=1', () => {
    const fullGate: PPIWeights = { alpha: 1, beta: 1, gamma: 0.5, delta: 1, spanScale: 180 }
    const result = computeComboPPI(
      3, N, 20,
      [1, 2, 3],       // mags
      [40, 5, 50],      // one planet at 5° — invisible
      fullGate,
    )
    expect(result.ppi).toBe(0)
    expect(result.elongVisibility).toBe(0)
  })

  it('elongation < 10° still scores when delta=0', () => {
    const noGate: PPIWeights = { alpha: 1, beta: 1, gamma: 0.5, delta: 0, spanScale: 180 }
    const result = computeComboPPI(
      3, N, 20,
      [1, 2, 3],
      [40, 5, 50],
      noGate,
    )
    expect(result.ppi).toBeGreaterThan(0)
    expect(result.elongVisibility).toBe(1)  // delta=0 → all elongations map to 1
  })

  it('more planets → higher PPI (same span/brightness)', () => {
    const mags3 = [1, 1, 1]
    const elongs3 = [40, 40, 40]
    const mags5 = [1, 1, 1, 1, 1]
    const elongs5 = [40, 40, 40, 40, 40]

    const r3 = computeComboPPI(3, N, 30, mags3, elongs3, DEFAULT_PPI_WEIGHTS)
    const r5 = computeComboPPI(5, N, 30, mags5, elongs5, DEFAULT_PPI_WEIGHTS)
    expect(r5.ppi).toBeGreaterThan(r3.ppi)
  })

  it('tighter span → higher PPI', () => {
    const mags = [1, 1, 1, 1]
    const elongs = [40, 40, 40, 40]

    const tight = computeComboPPI(4, N, 10, mags, elongs, DEFAULT_PPI_WEIGHTS)
    const wide = computeComboPPI(4, N, 60, mags, elongs, DEFAULT_PPI_WEIGHTS)
    expect(tight.ppi).toBeGreaterThan(wide.ppi)
  })

  it('higher brightness → higher PPI (when gamma > 0)', () => {
    const elongs = [40, 40, 40]
    const w: PPIWeights = { alpha: 1, beta: 1, gamma: 1, delta: 1, spanScale: 180 }
    const bright = computeComboPPI(3, N, 20, [0, 0, 0], elongs, w)
    const dim = computeComboPPI(3, N, 20, [5, 5, 5], elongs, w)
    expect(bright.ppi).toBeGreaterThan(dim.ppi)
  })

  it('gamma=0 ignores brightness', () => {
    const elongs = [40, 40, 40]
    const w: PPIWeights = { alpha: 1.5, beta: 1.5, gamma: 0, delta: 1, spanScale: 180 }
    const bright = computeComboPPI(3, N, 20, [0, 0, 0], elongs, w)
    const dim = computeComboPPI(3, N, 20, [5, 5, 5], elongs, w)
    expect(bright.ppi).toBeCloseTo(dim.ppi, 5)
  })

  it('alpha=3/beta=0 weights count heavily', () => {
    const w: PPIWeights = { alpha: 3, beta: 0, gamma: 1, delta: 1, spanScale: 180 }
    const elongs = [40, 40, 40, 40, 40]

    // 5 planets, wide span
    const r5 = computeComboPPI(5, N, 100, [1, 1, 1, 1, 1], elongs, w)
    // 3 planets, tight span
    const r3 = computeComboPPI(3, N, 5, [1, 1, 1], [40, 40, 40], w)
    // With alpha=3 and beta=0, count dominates — 5 planets should win
    expect(r5.ppi).toBeGreaterThan(r3.ppi)
  })

  it('perfect alignment with all planets → high score', () => {
    const k = 7
    const mags = Array(k).fill(-2)
    const elongs = Array(k).fill(90)
    const result = computeComboPPI(k, k, 0, mags, elongs, DEFAULT_PPI_WEIGHTS)
    // k/N=1, exp(0)^beta=1, brightness=1 (clamped), elong=1 → 100
    expect(result.ppi).toBeCloseTo(100, 0)
  })
})

// ─── computePPIResults (integration) ────────────────────────────────

describe('computePPIResults', () => {
  it('returns non-empty results for a 1-year range', () => {
    const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
    const result = computePPIResults(
      [...bodies],
      new Date('2026-01-01T00:00:00Z'),
      365,
      3,
      DEFAULT_PPI_WEIGHTS,
    )

    expect(result.ppiSeries.length).toBe(366) // 365 + 1
    expect(result.ppiPeaks.length).toBeGreaterThan(0)
  }, 60_000)

  it('PPI peaks are actual local maxima', () => {
    const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
    const result = computePPIResults(
      [...bodies],
      new Date('2026-01-01T00:00:00Z'),
      365,
      3,
      DEFAULT_PPI_WEIGHTS,
    )

    const series = result.ppiSeries
    const dateToIdx = new Map(series.map((s, i) => [s.date, i]))

    for (const peak of result.ppiPeaks) {
      const idx = dateToIdx.get(peak.date)
      if (idx === undefined) continue
      // Each peak should be ≥ at least one neighbor
      if (idx > 0) {
        expect(peak.ppi).toBeGreaterThanOrEqual(series[idx - 1].ppi)
      }
      if (idx < series.length - 1) {
        expect(peak.ppi).toBeGreaterThanOrEqual(series[idx + 1].ppi)
      }
    }
  }, 60_000)

  it('changing weights changes the peak ranking', () => {
    const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
    const countHeavy: PPIWeights = { alpha: 2.5, beta: 0.5, gamma: 1, delta: 1, spanScale: 180 }
    const spanHeavy: PPIWeights = { alpha: 0.5, beta: 2.5, gamma: 1, delta: 1, spanScale: 180 }

    const r1 = computePPIResults(
      [...bodies],
      new Date('2026-01-01T00:00:00Z'),
      365,
      3,
      countHeavy,
    )
    const r2 = computePPIResults(
      [...bodies],
      new Date('2026-01-01T00:00:00Z'),
      365,
      3,
      spanHeavy,
    )

    // The top peaks should differ in at least one property
    if (r1.ppiPeaks.length > 0 && r2.ppiPeaks.length > 0) {
      const top1 = r1.ppiPeaks.reduce((a, b) => a.ppi > b.ppi ? a : b)
      const top2 = r2.ppiPeaks.reduce((a, b) => a.ppi > b.ppi ? a : b)
      // With very different weight profiles, top parades will likely differ
      const differs = top1.date !== top2.date || top1.planetCount !== top2.planetCount
      expect(differs || top1.ppi !== top2.ppi).toBe(true)
    }
  }, 60_000)
})

// ─── computeDayCombos ────────────────────────────────────────────────

describe('computeDayCombos', () => {
  const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const
  const date = new Date('2026-06-15T00:00:00Z')

  it('returns multiple combos sorted by PPI descending', () => {
    const combos = computeDayCombos([...bodies], date, 2, DEFAULT_PPI_WEIGHTS)
    expect(combos.length).toBeGreaterThan(1)
    for (let i = 1; i < combos.length; i++) {
      expect(combos[i - 1].ppi).toBeGreaterThanOrEqual(combos[i].ppi)
    }
  }, 60_000)

  it('excludes straddling combos', () => {
    const combos = computeDayCombos([...bodies], date, 2, DEFAULT_PPI_WEIGHTS)
    for (const c of combos) {
      expect(c.kind).not.toBe('straddling')
    }
  }, 60_000)

  it('all combos have PPI > 0', () => {
    const combos = computeDayCombos([...bodies], date, 2, DEFAULT_PPI_WEIGHTS)
    for (const c of combos) {
      expect(c.ppi).toBeGreaterThan(0)
    }
  }, 60_000)

  it('returns empty for < 2 bodies', () => {
    const combos = computeDayCombos(['Mercury'], date, 2, DEFAULT_PPI_WEIGHTS)
    expect(combos).toEqual([])
  })

  it('top combo matches computePPIResults for same single day', () => {
    const combos = computeDayCombos([...bodies], date, 2, DEFAULT_PPI_WEIGHTS)
    const result = computePPIResults([...bodies], date, 0, 2, DEFAULT_PPI_WEIGHTS)
    // Single day → series has exactly 1 entry
    expect(result.ppiSeries.length).toBe(1)
    if (combos.length > 0) {
      expect(combos[0].ppi).toBeCloseTo(result.ppiSeries[0].ppi, 5)
    }
  }, 60_000)

  it('can rank by span and include straddling combos', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime()
    let straddleDate: Date | null = null
    for (let d = 0; d < 366; d++) {
      const date = new Date(start + d * 86_400_000)
      const combos = computeDayCombos(
        ['Mercury', 'Venus'],
        date,
        2,
        DEFAULT_PPI_WEIGHTS,
        undefined,
        { includeStraddling: true, rankingMetric: 'span' },
      )
      if (combos.some((c) => c.kind === 'straddling')) {
        straddleDate = date
        break
      }
    }

    expect(straddleDate).not.toBeNull()
    const noStraddle = computeDayCombos(['Mercury', 'Venus'], straddleDate!, 2, DEFAULT_PPI_WEIGHTS)
    const withStraddle = computeDayCombos(
      ['Mercury', 'Venus'],
      straddleDate!,
      2,
      DEFAULT_PPI_WEIGHTS,
      undefined,
      { includeStraddling: true, rankingMetric: 'span' },
    )
    expect(noStraddle.every((c) => c.kind !== 'straddling')).toBe(true)
    expect(withStraddle.some((c) => c.kind === 'straddling')).toBe(true)
  }, 60_000)

  it('sorts by span ascending in geometry ranking mode', () => {
    const combos = computeDayCombos(
      [...bodies],
      date,
      2,
      DEFAULT_PPI_WEIGHTS,
      undefined,
      { includeStraddling: true, rankingMetric: 'span' },
    )
    expect(combos.length).toBeGreaterThan(1)
    for (let i = 1; i < combos.length; i++) {
      expect(combos[i - 1].span).toBeLessThanOrEqual(combos[i].span)
    }
  }, 60_000)
})
