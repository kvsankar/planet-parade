/**
 * PPI Parameter Sweep — find optimal knobs for Visibility and Media presets.
 *
 * Evaluates a grid of (alpha, beta, gamma, delta) against known events:
 *   - Media preset goal: minimize date offset from public event dates
 *   - Visibility preset goal: rank tight/bright events higher than wide/dim ones
 *
 * Produces a unified report with the top candidates for each preset.
 */
import { describe, it, expect } from 'vitest'
import { computePPIResults, computeDayCombos } from '../ppiScoring'
import { CelestialBodyId, PPIWeights, PPIDayPoint } from '../../types'
import { formatDate, MS_PER_DAY } from '../../constants'

const ALL_BODIES: CelestialBodyId[] = [
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

// ─── Known events for calibration ────────────────────────────────────

interface CalibEvent {
  name: string
  date: string
  planets: number  // expected planet count
  kind: 'morning' | 'evening'
  invisible?: boolean
}

const EVENTS: CalibEvent[] = [
  { name: 'Massing May 2000',       date: '2000-05-05T00:00:00Z', planets: 5, kind: 'morning', invisible: true },
  { name: '5p evening Apr 2002',     date: '2002-04-20T00:00:00Z', planets: 5, kind: 'evening' },
  { name: '5p morning Jan 2005',     date: '2005-01-01T00:00:00Z', planets: 5, kind: 'morning' },
  { name: '6p morning May 2011',     date: '2011-05-11T00:00:00Z', planets: 6, kind: 'morning' },
  { name: '5p morning Feb 2016',     date: '2016-02-05T00:00:00Z', planets: 5, kind: 'morning' },
  { name: '4p tight Apr 2022',       date: '2022-04-15T00:00:00Z', planets: 4, kind: 'morning' },
  { name: '5p morning Jun 2022',     date: '2022-06-24T00:00:00Z', planets: 5, kind: 'morning' },
  { name: '6p evening Jan 2025',     date: '2025-01-21T00:00:00Z', planets: 6, kind: 'evening' },
  { name: '7p evening Feb 2025',     date: '2025-02-28T00:00:00Z', planets: 7, kind: 'evening' },
  { name: '6p evening Feb 2026',     date: '2026-02-28T00:00:00Z', planets: 6, kind: 'evening' },
]

// ─── Grid ────────────────────────────────────────────────────────────

const ALPHAS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
const BETAS  = [0, 0.5, 1.0, 1.5, 2.0, 2.5]
const GAMMAS = [0, 0.5, 1.0, 1.5]
const DELTAS = [0, 0.25, 0.5, 0.75, 1.0]

// ─── Evaluation helpers ──────────────────────────────────────────────

interface EventResult {
  event: CalibEvent
  bestPeak: PPIDayPoint | null
  offsetDays: number | null
  ppiAtPublicDate: number
  countMatch: boolean  // peak planet count >= public count
}

function evaluateWeights(w: PPIWeights): EventResult[] {
  const results: EventResult[] = []
  for (const event of EVENTS) {
    const eventDate = new Date(event.date)
    const eventMs = eventDate.getTime()

    // PPI at the exact public date
    const dayCombos = computeDayCombos(ALL_BODIES, eventDate, 2, w)
    const ppiAtPublicDate = dayCombos[0]?.ppi ?? 0

    // Best peak within ±30 days
    const windowStart = new Date(eventMs - 30 * MS_PER_DAY)
    const result = computePPIResults(ALL_BODIES, windowStart, 60, 2, w)
    const bestPeak = [...result.ppiPeaks].sort((a, b) => b.ppi - a.ppi)[0] ?? null
    const offsetDays = bestPeak ? Math.round((bestPeak.date - eventMs) / MS_PER_DAY) : null

    results.push({
      event,
      bestPeak,
      offsetDays,
      ppiAtPublicDate,
      countMatch: bestPeak ? bestPeak.planetCount >= event.planets : false,
    })
  }
  return results
}

// ─── Scoring functions ───────────────────────────────────────────────

interface MediaScore {
  meanAbsOffset: number
  maxAbsOffset: number
  matchCount: number      // events where offset ≤ 5 days
  planetCountMatches: number
}

function scoreMedia(results: EventResult[]): MediaScore {
  const visible = results.filter(r => !r.event.invisible)
  const offsets = visible.map(r => r.offsetDays).filter((d): d is number => d !== null)
  const absOffsets = offsets.map(Math.abs)
  return {
    meanAbsOffset: absOffsets.length > 0 ? absOffsets.reduce((a, b) => a + b, 0) / absOffsets.length : 999,
    maxAbsOffset: absOffsets.length > 0 ? Math.max(...absOffsets) : 999,
    matchCount: absOffsets.filter(d => d <= 5).length,
    planetCountMatches: visible.filter(r => r.countMatch).length,
  }
}

interface VisScore {
  apr2022ppi: number
  jun2022ppi: number
  tightnessGap: number  // apr2022 - jun2022 (positive = tight wins)
  meanPPI: number       // average PPI at public dates for visible events
  allNonZero: boolean
}

function scoreVis(results: EventResult[]): VisScore {
  const visible = results.filter(r => !r.event.invisible)
  const apr = results.find(r => r.event.name.includes('Apr 2022'))
  const jun = results.find(r => r.event.name.includes('Jun 2022'))
  const ppis = visible.map(r => r.ppiAtPublicDate)
  return {
    apr2022ppi: apr?.ppiAtPublicDate ?? 0,
    jun2022ppi: jun?.ppiAtPublicDate ?? 0,
    tightnessGap: (apr?.ppiAtPublicDate ?? 0) - (jun?.ppiAtPublicDate ?? 0),
    meanPPI: ppis.length > 0 ? ppis.reduce((a, b) => a + b, 0) / ppis.length : 0,
    allNonZero: ppis.every(p => p > 0),
  }
}

// ─── The sweep ───────────────────────────────────────────────────────

describe('PPI parameter sweep', () => {
  interface Candidate {
    w: PPIWeights
    mediaScore: MediaScore
    visScore: VisScore
    results: EventResult[]
  }

  const all: Candidate[] = []

  it('sweep all weight combinations', () => {
    const total = ALPHAS.length * BETAS.length * GAMMAS.length * DELTAS.length
    console.log(`\nSweeping ${total} weight combinations across ${EVENTS.length} known events...`)

    let count = 0
    for (const alpha of ALPHAS) {
      for (const beta of BETAS) {
        for (const gamma of GAMMAS) {
          for (const delta of DELTAS) {
            const w: PPIWeights = { alpha, beta, gamma, delta, spanScale: 180 }
            const results = evaluateWeights(w)
            all.push({
              w,
              mediaScore: scoreMedia(results),
              visScore: scoreVis(results),
              results,
            })
            count++
          }
        }
      }
      // Progress
      console.log(`  ... ${count}/${total} (α=${alpha} done)`)
    }

    expect(all.length).toBe(total)
  }, 600_000)

  it('report: best media presets (minimize offset from public dates)', () => {
    // Sort by: most close matches first, then lowest mean offset
    const mediaCandidates = [...all]
      .filter(c => c.mediaScore.meanAbsOffset < 999)
      .sort((a, b) => {
        // Primary: most events within 5 days
        if (b.mediaScore.matchCount !== a.mediaScore.matchCount) return b.mediaScore.matchCount - a.mediaScore.matchCount
        // Secondary: lowest mean offset
        return a.mediaScore.meanAbsOffset - b.mediaScore.meanAbsOffset
      })

    console.log('\n' + '═'.repeat(120))
    console.log('TOP 15 MEDIA PRESETS (minimize offset from public event dates)')
    console.log('═'.repeat(120))
    console.log(
      '#'.padStart(3) + '  ' +
      'α'.padEnd(4) + 'β'.padEnd(4) + 'γ'.padEnd(4) + 'δ'.padEnd(5) +
      '│ ' + 'Mean|Δ|'.padEnd(9) + 'Max|Δ|'.padEnd(8) + '≤5d'.padEnd(5) + 'CountOK'.padEnd(9) +
      '│ Per-event offsets'
    )
    console.log('─'.repeat(25) + '┼' + '─'.repeat(32) + '┼' + '─'.repeat(60))

    for (let i = 0; i < Math.min(15, mediaCandidates.length); i++) {
      const c = mediaCandidates[i]
      const offsets = c.results
        .filter(r => !r.event.invisible)
        .map(r => {
          const d = r.offsetDays
          if (d === null) return '—'
          return `${d >= 0 ? '+' : ''}${d}`
        })
        .join(' ')

      console.log(
        `${(i + 1).toString().padStart(3)}  ` +
        `${c.w.alpha.toFixed(1).padEnd(4)}${c.w.beta.toFixed(1).padEnd(4)}${c.w.gamma.toFixed(1).padEnd(4)}${c.w.delta.toFixed(2).padEnd(5)}` +
        `│ ${c.mediaScore.meanAbsOffset.toFixed(1).padStart(5)}d  ${c.mediaScore.maxAbsOffset.toString().padStart(3)}d  ${c.mediaScore.matchCount.toString().padStart(2)}/9 ${c.mediaScore.planetCountMatches.toString().padStart(4)}/9  ` +
        `│ ${offsets}`
      )
    }

    expect(mediaCandidates.length).toBeGreaterThan(0)
  })

  it('report: best visibility presets (tight bright clusters win)', () => {
    // Filter: tight must beat wide, all visible events non-zero
    const visCandidates = [...all]
      .filter(c => c.visScore.tightnessGap > 0 && c.visScore.allNonZero)
      .sort((a, b) => {
        // Primary: largest tightness gap
        if (Math.abs(b.visScore.tightnessGap - a.visScore.tightnessGap) > 1) {
          return b.visScore.tightnessGap - a.visScore.tightnessGap
        }
        // Secondary: highest mean PPI
        return b.visScore.meanPPI - a.visScore.meanPPI
      })

    console.log('\n' + '═'.repeat(120))
    console.log('TOP 15 VISIBILITY PRESETS (tight bright clusters rank higher)')
    console.log('═'.repeat(120))
    console.log(
      '#'.padStart(3) + '  ' +
      'α'.padEnd(4) + 'β'.padEnd(4) + 'γ'.padEnd(4) + 'δ'.padEnd(5) +
      '│ ' + 'Apr22'.padEnd(7) + 'Jun22'.padEnd(7) + 'Gap'.padEnd(7) + 'MeanPPI'.padEnd(9) +
      '│ Per-event PPI at public date'
    )
    console.log('─'.repeat(25) + '┼' + '─'.repeat(31) + '┼' + '─'.repeat(60))

    for (let i = 0; i < Math.min(15, visCandidates.length); i++) {
      const c = visCandidates[i]
      const ppis = c.results
        .filter(r => !r.event.invisible)
        .map(r => r.ppiAtPublicDate.toFixed(0).padStart(4))
        .join(' ')

      console.log(
        `${(i + 1).toString().padStart(3)}  ` +
        `${c.w.alpha.toFixed(1).padEnd(4)}${c.w.beta.toFixed(1).padEnd(4)}${c.w.gamma.toFixed(1).padEnd(4)}${c.w.delta.toFixed(2).padEnd(5)}` +
        `│ ${c.visScore.apr2022ppi.toFixed(1).padStart(5)} ${c.visScore.jun2022ppi.toFixed(1).padStart(5)} ${c.visScore.tightnessGap.toFixed(1).padStart(5)} ${c.visScore.meanPPI.toFixed(1).padStart(7)}` +
        `  │ ${ppis}`
      )
    }

    expect(visCandidates.length).toBeGreaterThan(0)
  })

  it('unified report: compare current vs sweep-best presets', () => {
    // Pick the top media candidate
    const bestMedia = [...all]
      .filter(c => c.mediaScore.meanAbsOffset < 999)
      .sort((a, b) => {
        if (b.mediaScore.matchCount !== a.mediaScore.matchCount) return b.mediaScore.matchCount - a.mediaScore.matchCount
        return a.mediaScore.meanAbsOffset - b.mediaScore.meanAbsOffset
      })[0]

    // Pick the top visibility candidate
    const bestVis = [...all]
      .filter(c => c.visScore.tightnessGap > 0 && c.visScore.allNonZero)
      .sort((a, b) => {
        if (Math.abs(b.visScore.tightnessGap - a.visScore.tightnessGap) > 1) {
          return b.visScore.tightnessGap - a.visScore.tightnessGap
        }
        return b.visScore.meanPPI - a.visScore.meanPPI
      })[0]

    if (!bestMedia || !bestVis) {
      console.log('No candidates found')
      return
    }

    function wStr(w: PPIWeights): string {
      return `α=${w.alpha} β=${w.beta} γ=${w.gamma} δ=${w.delta}`
    }

    console.log('\n' + '═'.repeat(140))
    console.log('UNIFIED REPORT: Sweep-Optimal Presets vs Known Events')
    console.log('═'.repeat(140))
    console.log(`\nBest VISIBILITY: ${wStr(bestVis.w)}`)
    console.log(`  Apr 2022 PPI=${bestVis.visScore.apr2022ppi.toFixed(1)}, Jun 2022 PPI=${bestVis.visScore.jun2022ppi.toFixed(1)}, gap=${bestVis.visScore.tightnessGap.toFixed(1)}, mean PPI=${bestVis.visScore.meanPPI.toFixed(1)}`)
    console.log(`\nBest MEDIA:      ${wStr(bestMedia.w)}`)
    console.log(`  Mean offset=${bestMedia.mediaScore.meanAbsOffset.toFixed(1)}d, max=${bestMedia.mediaScore.maxAbsOffset}d, ≤5d matches=${bestMedia.mediaScore.matchCount}/9, count matches=${bestMedia.mediaScore.planetCountMatches}/9`)

    // Side-by-side comparison
    const W_NAME = 30
    const W_COL = 48
    console.log(`\n${'Event'.padEnd(W_NAME)} │ ${'Visibility (sweep-best)'.padEnd(W_COL)} │ ${'Media (sweep-best)'.padEnd(W_COL)}`)
    console.log('─'.repeat(W_NAME) + '─┼─' + '─'.repeat(W_COL) + '─┼─' + '─'.repeat(W_COL))

    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i]
      const vr = bestVis.results[i]
      const mr = bestMedia.results[i]

      const vPeak = vr.bestPeak
      const mPeak = mr.bestPeak

      function peakStr(r: EventResult): string {
        if (!r.bestPeak) return '—'
        const p = r.bestPeak
        const off = r.offsetDays !== null ? ` Δ=${r.offsetDays >= 0 ? '+' : ''}${r.offsetDays}d` : ''
        const planets = p.planets.map(b => b.slice(0, 3)).join(',')
        return `${formatDate(p.date)} PPI=${p.ppi.toFixed(1)} ${p.planetCount}p ${p.span.toFixed(0)}°${off}`
      }

      console.log(
        `${ev.name.padEnd(W_NAME)} │ ${peakStr(vr).padEnd(W_COL)} │ ${peakStr(mr).padEnd(W_COL)}`
      )
    }

    console.log('─'.repeat(W_NAME) + '─┴─' + '─'.repeat(W_COL) + '─┴─' + '─'.repeat(W_COL))

    // Final recommendation
    console.log('\n── RECOMMENDED PRESET VALUES ──')
    console.log(`Visibility: { alpha: ${bestVis.w.alpha}, beta: ${bestVis.w.beta}, gamma: ${bestVis.w.gamma}, delta: ${bestVis.w.delta}, spanScale: 180 }`)
    console.log(`Media:      { alpha: ${bestMedia.w.alpha}, beta: ${bestMedia.w.beta}, gamma: ${bestMedia.w.gamma}, delta: ${bestMedia.w.delta}, spanScale: 180 }`)
  })
})
