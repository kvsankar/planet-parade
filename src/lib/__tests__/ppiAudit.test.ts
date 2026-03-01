/**
 * PPI Visibility Audit — Manual inspection of algo picks vs alternatives.
 *
 * Computes PPI over 2000–2026 with two gamma settings (0 and 0.5), takes the
 * top 50 peaks from each, and shows the algo's best combo alongside runner-up
 * combos. This lets a human judge whether brightness weighting improves picks.
 *
 * Run:  npx vitest run src/lib/__tests__/ppiAudit.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  computePPIResults,
  computeDayCombos,
  DEFAULT_PPI_WEIGHTS,
} from '../ppiScoring'
import { CelestialBodyId, PPIWeights, PPIDayPoint } from '../../types'
import { formatDate } from '../../constants'

const ALL_BODIES: CelestialBodyId[] = [
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

const START = new Date('2000-01-01T00:00:00Z')
const END = new Date('2026-12-31T00:00:00Z')
const DURATION = Math.round(
  (END.getTime() - START.getTime()) / (24 * 60 * 60 * 1000),
)

function wStr(w: PPIWeights): string {
  return `α=${w.alpha} β=${w.beta} γ=${w.gamma} δ=${w.delta}`
}

function runAudit(label: string, weights: PPIWeights) {
  console.log(`\nComputing PPI over ${DURATION} days (2000–2026) — ${label}...`)
  console.log(`Weights: ${wStr(weights)}`)

  const t0 = Date.now()
  const result = computePPIResults(ALL_BODIES, START, DURATION, 2, weights)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`Done in ${elapsed}s — ${result.ppiPeaks.length} peaks found\n`)

  const topPeaks = [...result.ppiPeaks]
    .sort((a, b) => b.ppi - a.ppi)
    .slice(0, 50)

  const W = 120
  console.log('═'.repeat(W))
  console.log(`TOP 50 PPI PEAKS — ${label} [${wStr(weights)}]`)
  console.log(
    'For each peak date, top 5 combos are shown. Check if #1 is the most visually impressive.',
  )
  console.log('═'.repeat(W))

  for (let i = 0; i < topPeaks.length; i++) {
    const peak = topPeaks[i]
    const date = new Date(peak.date)
    const combos = computeDayCombos(ALL_BODIES, date, 2, weights)

    const planets = peak.planets.map((b) => b.slice(0, 3)).join(',')
    console.log(
      `\n#${(i + 1).toString().padStart(2)}  ${formatDate(peak.date)}  ` +
        `Best: PPI=${peak.ppi.toFixed(1)}  ${peak.planetCount}p ${peak.kind}  ` +
        `span=${peak.span.toFixed(0)}°  bright=${peak.brightness.toFixed(2)}  [${planets}]`,
    )

    const showCount = Math.min(5, combos.length)
    for (let j = 0; j < showCount; j++) {
      const c = combos[j]
      const cPlanets = c.planets.map((b) => b.slice(0, 3)).join(',')
      const marker = j === 0 ? '  ← BEST' : ''
      console.log(
        `     ${(j + 1).toString().padStart(2)}. ` +
          `${c.planetCount}p ${c.kind.padEnd(7)} ` +
          `${cPlanets.padEnd(32)} ` +
          `span=${c.span.toFixed(0).padStart(3)}°  ` +
          `PPI=${c.ppi.toFixed(1).padStart(5)}  ` +
          `bright=${c.brightness.toFixed(2)}  ` +
          `elong=${c.elongVisibility.toFixed(2)}` +
          marker,
      )
    }
  }

  console.log('\n' + '═'.repeat(W))
  return topPeaks
}

describe('PPI visibility audit (2000–2026)', () => {
  it('γ=0 vs γ=0.25 vs γ=0.5', () => {
    const gammas = [0, 0.25, 0.5] as const
    const labels = ['γ=0 (all equal)', 'γ=0.25 (mild)', 'γ=0.5 (strong)']
    const allPeaks: PPIDayPoint[][] = []

    for (let g = 0; g < gammas.length; g++) {
      const w: PPIWeights = { ...DEFAULT_PPI_WEIGHTS, gamma: gammas[g] }
      allPeaks.push(runAudit(labels[g], w))
    }

    // Summary comparison
    const hasOuter = (p: PPIDayPoint) =>
      p.planets.some((b) => b === 'Uranus' || b === 'Neptune')

    console.log('\n' + '═'.repeat(80))
    console.log('COMPARISON SUMMARY')
    console.log('═'.repeat(80))
    console.log(
      ''.padEnd(20) +
        gammas.map((g) => `γ=${g}`.padEnd(16)).join(''),
    )
    console.log('─'.repeat(68))
    console.log(
      'Ura/Nep in top 50:  ' +
        allPeaks
          .map((p) => `${p.filter(hasOuter).length}/50`.padEnd(16))
          .join(''),
    )
    console.log(
      'Mean brightness:    ' +
        allPeaks
          .map((p) =>
            (p.reduce((s, x) => s + x.brightness, 0) / p.length)
              .toFixed(3)
              .padEnd(16),
          )
          .join(''),
    )
    console.log(
      'Mean planet count:  ' +
        allPeaks
          .map((p) =>
            (p.reduce((s, x) => s + x.planetCount, 0) / p.length)
              .toFixed(2)
              .padEnd(16),
          )
          .join(''),
    )
    console.log(
      'Mean PPI:           ' +
        allPeaks
          .map((p) =>
            (p.reduce((s, x) => s + x.ppi, 0) / p.length)
              .toFixed(1)
              .padEnd(16),
          )
          .join(''),
    )

    for (const peaks of allPeaks) {
      expect(peaks.length).toBe(50)
    }
  }, 300_000)
})
