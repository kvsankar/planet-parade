/**
 * PPI Parameter Sweep — find optimal knobs for Visibility and Media presets.
 *
 * Evaluates a grid of (alpha, beta, gamma, delta) against known events:
 *   - Media preset goal: find the right planet count AND minimize date offset
 *   - Visibility preset goal: rank tight/bright events higher than wide/dim ones
 *
 * Media evaluation uses "closest count-matched peak" — for each event, find the
 * nearest PPI peak (local maximum) that has >= expected planet count.  This
 * measures "does the formula peak with the right count near the media date?"
 * rather than "where is the overall highest PPI?"
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
const BETAS  = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5]
const GAMMAS = [0, 0.25, 0.5, 1.0]
const DELTAS = [0, 0.25, 0.5, 0.75, 1.0]

// ─── Evaluation helpers ──────────────────────────────────────────────

interface EventResult {
  event: CalibEvent
  // Overall best PPI peak in ±30d window
  bestPeak: PPIDayPoint | null
  offsetDays: number | null
  ppiAtPublicDate: number
  countMatch: boolean  // best peak planet count >= expected
  // Closest count-matched peak to public date (for media date scoring)
  closestCountPeak: PPIDayPoint | null
  countPeakOffset: number | null
}

function evaluateWeights(w: PPIWeights): EventResult[] {
  const results: EventResult[] = []
  for (const event of EVENTS) {
    const eventDate = new Date(event.date)
    const eventMs = eventDate.getTime()

    // PPI at the exact public date
    const dayCombos = computeDayCombos(ALL_BODIES, eventDate, 2, w)
    const ppiAtPublicDate = dayCombos[0]?.ppi ?? 0

    // All peaks within ±30 days
    const windowStart = new Date(eventMs - 30 * MS_PER_DAY)
    const result = computePPIResults(ALL_BODIES, windowStart, 60, 2, w)

    // Overall best peak (for vis scoring)
    const bestPeak = [...result.ppiPeaks].sort((a, b) => b.ppi - a.ppi)[0] ?? null
    const offsetDays = bestPeak ? Math.round((bestPeak.date - eventMs) / MS_PER_DAY) : null

    // Closest count-matched peak to public date (for media date scoring)
    const countPeaks = result.ppiPeaks.filter(p => p.planetCount >= event.planets)
    const closestCountPeak = countPeaks.length > 0
      ? countPeaks.sort((a, b) => Math.abs(a.date - eventMs) - Math.abs(b.date - eventMs))[0]
      : null
    const countPeakOffset = closestCountPeak
      ? Math.round((closestCountPeak.date - eventMs) / MS_PER_DAY)
      : null

    results.push({
      event,
      bestPeak,
      offsetDays,
      ppiAtPublicDate,
      countMatch: bestPeak ? bestPeak.planetCount >= event.planets : false,
      closestCountPeak,
      countPeakOffset,
    })
  }
  return results
}

// ─── Scoring functions ───────────────────────────────────────────────

interface MediaScore {
  // Count-matched peak metrics (primary for media)
  planetCountMatches: number  // events where ANY peak has >= expected count
  countPeakCloseCount: number // events where closest count-matched peak is ≤5d
  countPeakMeanOffset: number // mean |offset| of closest count-matched peaks
  countPeakMaxOffset: number
  // Overall best peak metrics (secondary)
  meanAbsOffset: number
  matchCount: number
}

function scoreMedia(results: EventResult[]): MediaScore {
  const visible = results.filter(r => !r.event.invisible)

  // Count-matched peak metrics
  const countOffsets = visible
    .map(r => r.countPeakOffset)
    .filter((d): d is number => d !== null)
  const countAbsOffsets = countOffsets.map(Math.abs)

  // Overall best peak metrics
  const offsets = visible.map(r => r.offsetDays).filter((d): d is number => d !== null)
  const absOffsets = offsets.map(Math.abs)

  return {
    planetCountMatches: visible.filter(r => r.closestCountPeak !== null).length,
    countPeakCloseCount: countAbsOffsets.filter(d => d <= 5).length,
    countPeakMeanOffset: countAbsOffsets.length > 0
      ? countAbsOffsets.reduce((a, b) => a + b, 0) / countAbsOffsets.length : 999,
    countPeakMaxOffset: countAbsOffsets.length > 0 ? Math.max(...countAbsOffsets) : 999,
    meanAbsOffset: absOffsets.length > 0 ? absOffsets.reduce((a, b) => a + b, 0) / absOffsets.length : 999,
    matchCount: absOffsets.filter(d => d <= 5).length,
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

// ─── Sorting helpers ──────────────────────────────────────────────────

function sortMedia(a: { mediaScore: MediaScore }, b: { mediaScore: MediaScore }): number {
  const as = a.mediaScore, bs = b.mediaScore
  // 1. Most events where a count-matched peak exists
  if (bs.planetCountMatches !== as.planetCountMatches)
    return bs.planetCountMatches - as.planetCountMatches
  // 2. Most count-matched peaks within ±5d of public date
  if (bs.countPeakCloseCount !== as.countPeakCloseCount)
    return bs.countPeakCloseCount - as.countPeakCloseCount
  // 3. Lowest mean offset of count-matched peaks
  return as.countPeakMeanOffset - bs.countPeakMeanOffset
}

function sortVis(a: { visScore: VisScore }, b: { visScore: VisScore }): number {
  if (Math.abs(b.visScore.tightnessGap - a.visScore.tightnessGap) > 1)
    return b.visScore.tightnessGap - a.visScore.tightnessGap
  return b.visScore.meanPPI - a.visScore.meanPPI
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

  it('report: best media presets (count-matched peaks, minimize offset)', () => {
    const mediaCandidates = [...all]
      .filter(c => c.mediaScore.countPeakMeanOffset < 999)
      .sort(sortMedia)

    console.log('\n' + '═'.repeat(155))
    console.log('TOP 20 MEDIA PRESETS (closest count-matched peak: count matches → ≤5d → mean offset)')
    console.log('═'.repeat(155))
    console.log(
      '#'.padStart(3) + '  ' +
      'α'.padEnd(5) + 'β'.padEnd(5) + 'γ'.padEnd(5) + 'δ'.padEnd(5) +
      '│ ' + 'CntOK'.padEnd(6) + '≤5d'.padEnd(5) + 'Mean|Δ|'.padEnd(9) + 'Max|Δ|'.padEnd(8) +
      '│ Per-event: offset (found count → expected, ✓/✗)'
    )
    console.log('─'.repeat(28) + '┼' + '─'.repeat(29) + '┼' + '─'.repeat(95))

    for (let i = 0; i < Math.min(20, mediaCandidates.length); i++) {
      const c = mediaCandidates[i]
      const details = c.results
        .filter(r => !r.event.invisible)
        .map(r => {
          if (!r.closestCountPeak) {
            return `—(0→${r.event.planets}✗)`
          }
          const d = r.countPeakOffset!
          const off = `${d >= 0 ? '+' : ''}${d}`
          const found = r.closestCountPeak.planetCount
          const ok = '✓'
          return `${off}(${found}→${r.event.planets}${ok})`
        })
        .join(' ')

      console.log(
        `${(i + 1).toString().padStart(3)}  ` +
        `${c.w.alpha.toFixed(1).padEnd(5)}${c.w.beta.toFixed(1).padEnd(5)}` +
        `${c.w.gamma.toFixed(2).padEnd(5)}${c.w.delta.toFixed(2).padEnd(5)}` +
        `│ ${c.mediaScore.planetCountMatches.toString().padStart(3)}/9 ` +
        `${c.mediaScore.countPeakCloseCount.toString().padStart(2)}/9 ` +
        `${c.mediaScore.countPeakMeanOffset.toFixed(1).padStart(5)}d ` +
        `${c.mediaScore.countPeakMaxOffset.toString().padStart(3)}d  ` +
        `│ ${details}`
      )
    }

    expect(mediaCandidates.length).toBeGreaterThan(0)
  })

  it('report: best visibility presets (tight bright clusters win)', () => {
    // Filter: tight must beat wide, all visible events non-zero
    const visCandidates = [...all]
      .filter(c => c.visScore.tightnessGap > 0 && c.visScore.allNonZero)
      .sort(sortVis)

    console.log('\n' + '═'.repeat(120))
    console.log('TOP 15 VISIBILITY PRESETS (tight bright clusters rank higher)')
    console.log('═'.repeat(120))
    console.log(
      '#'.padStart(3) + '  ' +
      'α'.padEnd(4) + 'β'.padEnd(4) + 'γ'.padEnd(5) + 'δ'.padEnd(5) +
      '│ ' + 'Apr22'.padEnd(7) + 'Jun22'.padEnd(7) + 'Gap'.padEnd(7) + 'MeanPPI'.padEnd(9) +
      '│ Per-event PPI at public date'
    )
    console.log('─'.repeat(26) + '┼' + '─'.repeat(31) + '┼' + '─'.repeat(60))

    for (let i = 0; i < Math.min(15, visCandidates.length); i++) {
      const c = visCandidates[i]
      const ppis = c.results
        .filter(r => !r.event.invisible)
        .map(r => r.ppiAtPublicDate.toFixed(0).padStart(4))
        .join(' ')

      console.log(
        `${(i + 1).toString().padStart(3)}  ` +
        `${c.w.alpha.toFixed(1).padEnd(4)}${c.w.beta.toFixed(1).padEnd(4)}${c.w.gamma.toFixed(2).padEnd(5)}${c.w.delta.toFixed(2).padEnd(5)}` +
        `│ ${c.visScore.apr2022ppi.toFixed(1).padStart(5)} ${c.visScore.jun2022ppi.toFixed(1).padStart(5)} ${c.visScore.tightnessGap.toFixed(1).padStart(5)} ${c.visScore.meanPPI.toFixed(1).padStart(7)}` +
        `  │ ${ppis}`
      )
    }

    expect(visCandidates.length).toBeGreaterThan(0)
  })

  it('unified report: compare current vs sweep-best presets', () => {
    // Pick the top media candidate
    const bestMedia = [...all]
      .filter(c => c.mediaScore.countPeakMeanOffset < 999)
      .sort(sortMedia)[0]

    // Pick the top visibility candidate
    const bestVis = [...all]
      .filter(c => c.visScore.tightnessGap > 0 && c.visScore.allNonZero)
      .sort(sortVis)[0]

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
    const ms = bestMedia.mediaScore
    console.log(`  Count matches=${ms.planetCountMatches}/9, ≤5d=${ms.countPeakCloseCount}/9, mean offset=${ms.countPeakMeanOffset.toFixed(1)}d, max=${ms.countPeakMaxOffset}d`)

    // Side-by-side comparison — use closestCountPeak for media column
    const W_NAME = 30
    const W_COL = 48
    console.log(`\n${'Event'.padEnd(W_NAME)} │ ${'Visibility (sweep-best)'.padEnd(W_COL)} │ ${'Media — closest count-matched peak'.padEnd(W_COL)}`)
    console.log('─'.repeat(W_NAME) + '─┼─' + '─'.repeat(W_COL) + '─┼─' + '─'.repeat(W_COL))

    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i]
      const vr = bestVis.results[i]
      const mr = bestMedia.results[i]

      function visPeakStr(r: EventResult): string {
        if (!r.bestPeak) return '—'
        const p = r.bestPeak
        const off = r.offsetDays !== null ? ` Δ=${r.offsetDays >= 0 ? '+' : ''}${r.offsetDays}d` : ''
        return `${formatDate(p.date)} PPI=${p.ppi.toFixed(1)} ${p.planetCount}p ${p.span.toFixed(0)}°${off}`
      }

      function mediaPeakStr(r: EventResult): string {
        const p = r.closestCountPeak
        if (!p) {
          // Fall back to overall best
          if (!r.bestPeak) return '—'
          const bp = r.bestPeak
          return `${formatDate(bp.date)} PPI=${bp.ppi.toFixed(1)} ${bp.planetCount}p (no ${r.event.planets}p peak)`
        }
        const off = r.countPeakOffset !== null ? ` Δ=${r.countPeakOffset >= 0 ? '+' : ''}${r.countPeakOffset}d` : ''
        return `${formatDate(p.date)} PPI=${p.ppi.toFixed(1)} ${p.planetCount}p ${p.span.toFixed(0)}°${off}`
      }

      console.log(
        `${ev.name.padEnd(W_NAME)} │ ${visPeakStr(vr).padEnd(W_COL)} │ ${mediaPeakStr(mr).padEnd(W_COL)}`
      )
    }

    console.log('─'.repeat(W_NAME) + '─┴─' + '─'.repeat(W_COL) + '─┴─' + '─'.repeat(W_COL))

    // Final recommendation
    console.log('\n── RECOMMENDED PRESET VALUES ──')
    console.log(`Visibility: { alpha: ${bestVis.w.alpha}, beta: ${bestVis.w.beta}, gamma: ${bestVis.w.gamma}, delta: ${bestVis.w.delta}, spanScale: 180 }`)
    console.log(`Media:      { alpha: ${bestMedia.w.alpha}, beta: ${bestMedia.w.beta}, gamma: ${bestMedia.w.gamma}, delta: ${bestMedia.w.delta}, spanScale: 180 }`)
  })
})
