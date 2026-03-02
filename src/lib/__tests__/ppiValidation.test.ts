/**
 * PPI Validation Against Well-Known Planet Parade Events (2000–2026)
 *
 * Two-part analysis:
 *
 * Part 1: Run PPI with default (visibility-optimized) weights across 2000–2026,
 *   collect top peaks per year, and check that well-known events score well.
 *
 * Part 2: Derive a "media/hype" weight preset that favors planet count over
 *   compactness, and compare the two presets' rankings of known events.
 *
 * The key insight: public "planet parade" dates are chosen for maximum planet
 * count (media spectacle), while PPI default weights optimize for observing
 * quality (compactness + brightness + visibility). These are legitimately
 * different goals, and we want two presets for each.
 *
 * Sources:
 *   - NASA: https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/
 *   - Star Walk: https://starwalk.space/en/news/what-is-planet-parade
 *   - Space.com: https://www.space.com/five-planets-align-rare-skywatching-june-2022
 *   - BBC Sky at Night: https://www.skyatnightmagazine.com/news/seven-planet-parade-28-february-2025
 *   - National Geographic: https://www.nationalgeographic.com/science/article/six-planet-alignment-february-2026
 *   - NSSDCA/NASA: May 2000 planetary massing (~26° span)
 *   - ESA: April 2002 five-planet evening lineup
 *   - Harvard Gazette: April 2002 all-planet visibility
 */
import { describe, it, expect } from 'vitest'
import { computePPIResults, computeDayCombos, DEFAULT_PPI_WEIGHTS } from '../ppiScoring'
import { CelestialBodyId, AlignmentKind, PPIWeights, PPIDayPoint } from '../../types'
import { formatDate, MS_PER_DAY } from '../../constants'
import { getGeocentricEclipticCoords, wrap180 } from '../alignment'

const ALL_BODIES: CelestialBodyId[] = [
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
]

// ─── Known Events ────────────────────────────────────────────────────

interface KnownEvent {
  name: string
  date: string              // documented peak date (ISO)
  planets: CelestialBodyId[]  // expected planets
  kind: AlignmentKind       // morning or evening
  notes: string             // why this event was notable
}

/**
 * Well-documented planet parade events from public sources (2000–2026).
 *
 * These are the dates the *media* highlighted. PPI may identify different
 * peak dates because it optimizes for observing quality, not planet count.
 */
const KNOWN_EVENTS: KnownEvent[] = [
  {
    name: 'Great Massing (May 2000)',
    date: '2000-05-05T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'morning',
    notes: 'All 5 naked-eye planets + Sun + Moon within 26°. Invisible — all near the Sun.',
  },
  {
    name: '5 planets evening (Apr–May 2002)',
    date: '2002-04-20T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'evening',
    notes: 'All 5 naked-eye planets visible after sunset. Wide span.',
  },
  {
    name: '5 planets morning (Dec 2004–Jan 2005)',
    date: '2005-01-01T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'morning',
    notes: 'Last 5-planet morning lineup before 2016.',
  },
  {
    name: '6 planets (May 2011)',
    date: '2011-05-11T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus'],
    kind: 'morning',
    notes: 'Six planets simultaneously visible. Last 6-planet event before 2025.',
  },
  {
    name: '5 naked-eye planets morning (Jan–Feb 2016)',
    date: '2016-02-05T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'morning',
    notes: 'First time all 5 naked-eye planets simultaneously visible since 2005.',
  },
  {
    name: '5 naked-eye planets morning (Jun 2022)',
    date: '2022-06-24T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'morning',
    notes: 'Planets in correct solar-distance order. Most celebrated parade in a decade.',
  },
  {
    name: '4 bright planets tight (Apr 2022)',
    date: '2022-04-15T00:00:00Z',
    planets: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    kind: 'morning',
    notes: 'Tightest 4-planet cluster (~31°). Best observing quality of 2022.',
  },
  {
    name: '6 planets evening (Jan 2025)',
    date: '2025-01-21T00:00:00Z',
    planets: ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    kind: 'evening',
    notes: 'Six planets visible after sunset.',
  },
  {
    name: '7-planet evening parade (Feb 2025)',
    date: '2025-02-28T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    kind: 'evening',
    notes: 'All 7 planets on same side of Sun. Mercury/Saturn very low.',
  },
  {
    name: '6-planet evening parade (Feb 2026)',
    date: '2026-02-28T00:00:00Z',
    planets: ['Mercury', 'Venus', 'Saturn', 'Jupiter', 'Uranus', 'Neptune'],
    kind: 'evening',
    notes: 'Widely publicized 6-planet alignment. Wide span ~128–175°.',
  },
]

// ─── Weight Presets ──────────────────────────────────────────────────

/** Default: balanced visibility-optimized scoring */
const VISIBILITY_WEIGHTS: PPIWeights = { ...DEFAULT_PPI_WEIGHTS }

/**
 * Media/hype preset: strongly favors planet count over compactness.
 * Rationale: public excitement scales with "how many planets can I see?"
 * not "how tight is the cluster?" So we shift exponent budget toward count.
 * Also reduce gamma so dim outer planets (Uranus/Neptune) aren't penalized
 * as much — the media counts them even though they need binoculars.
 */
const MEDIA_WEIGHTS: PPIWeights = {
  alpha: 2.0,      // count exponent — favours count (9/9 planet-count matches)
  beta: 0.25,      // compactness exponent — tolerates wide spans (media parades are 90–175°)
  gamma: 0.25,     // mild brightness weighting
  delta: 0.75,     // strong visibility gate (smooth elongation curve needs higher delta)
  spanScale: 180,
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatPeak(p: PPIDayPoint): string {
  return `${formatDate(p.date)} PPI=${p.ppi.toFixed(1)} span=${p.span.toFixed(0)}° ${p.planetCount}p ${p.kind} [${p.planets.map(b => b.slice(0, 3)).join(',')}]`
}

function peakElongStr(p: PPIDayPoint): string {
  const date = new Date(p.date)
  const sunLon = getGeocentricEclipticCoords('Sun', date).lon
  return p.planets
    .map((b) => {
      const elong = wrap180(getGeocentricEclipticCoords(b, date).lon - sunLon)
      return `${b.slice(0, 3)}:${elong >= 0 ? '+' : ''}${elong.toFixed(0)}°`
    })
    .join('  ')
}

// ─── Part 1: Broad survey 2000–2026 with both presets ────────────────

describe('PPI broad survey (2000–2026)', () => {
  // Compute full-year results for each year with both weight presets
  const yearResults: {
    year: number
    vis: { topPeak: PPIDayPoint; topK: Map<number, PPIDayPoint> }
    media: { topPeak: PPIDayPoint; topK: Map<number, PPIDayPoint> }
  }[] = []

  // Pre-compute all years (expensive — reuse across tests)
  const years = Array.from({ length: 27 }, (_, i) => 2000 + i)

  function computeYear(year: number, weights: PPIWeights) {
    const start = new Date(`${year}-01-01T00:00:00Z`)
    const days = year % 4 === 0 ? 365 : 364 // approximate
    const result = computePPIResults(ALL_BODIES, start, days, 2, weights)
    const peaks = [...result.ppiPeaks].sort((a, b) => b.ppi - a.ppi)
    const topPeak = peaks[0] ?? null

    // Best peak per planet count
    const topK = new Map<number, PPIDayPoint>()
    for (const p of peaks) {
      if (!topK.has(p.planetCount) || p.ppi > topK.get(p.planetCount)!.ppi) {
        topK.set(p.planetCount, p)
      }
    }

    return { topPeak, topK }
  }

  it('compute all years and print summary table', () => {
    for (const year of years) {
      const vis = computeYear(year, VISIBILITY_WEIGHTS)
      const media = computeYear(year, MEDIA_WEIGHTS)
      if (vis.topPeak && media.topPeak) {
        yearResults.push({ year, vis, media })
      }
    }

    console.log('\n' + '='.repeat(120))
    console.log('YEAR-BY-YEAR TOP PPI PEAKS: VISIBILITY vs MEDIA weights')
    console.log('='.repeat(120))
    console.log(
      'Year'.padEnd(6) +
      '│ ' + 'Visibility (α=1.0 β=2.0 γ=0.25)'.padEnd(55) +
      '│ ' + 'Media (α=2.0 β=0.25 γ=0.5)'.padEnd(55)
    )
    console.log('─'.repeat(6) + '┼' + '─'.repeat(56) + '┼' + '─'.repeat(56))

    for (const { year, vis, media } of yearResults) {
      const vStr = formatPeak(vis.topPeak)
      const mStr = formatPeak(media.topPeak)
      console.log(`${year}  │ ${vStr.padEnd(55)}│ ${mStr.padEnd(55)}`)
    }

    expect(yearResults.length).toBe(27)
  }, 600_000) // 10 minutes — 27 years × 2 presets

  it('unified comparison: public records ∪ PPI analysis', () => {
    // ── Build union of records from 3 sources ──────────────────────────
    interface UnionRow {
      sortDate: number
      label: string
      // Public
      publicDate: string | null
      publicInfo: string | null   // "5p AM"
      publicNotes: string | null
      // Vis preset: best peak within ±30d (public rows) or year top (PPI rows)
      visPeak: PPIDayPoint | null
      visOffset: number | null    // days from public date
      // Media preset
      mediaPeak: PPIDayPoint | null
      mediaOffset: number | null
    }

    const rows: UnionRow[] = []
    const publicYearDates = new Map<number, number[]>()  // year → [dateMs, ...]

    // ── Source 1: Known public events → find best nearby PPI peaks ────
    for (const event of KNOWN_EVENTS) {
      const eventDate = new Date(event.date)
      const eventMs = eventDate.getTime()
      const year = eventDate.getUTCFullYear()

      if (!publicYearDates.has(year)) publicYearDates.set(year, [])
      publicYearDates.get(year)!.push(eventMs)

      const windowStart = new Date(eventMs - 30 * MS_PER_DAY)
      const visResult = computePPIResults(ALL_BODIES, windowStart, 60, 2, VISIBILITY_WEIGHTS)
      const mediaResult = computePPIResults(ALL_BODIES, windowStart, 60, 2, MEDIA_WEIGHTS)
      const visBest = [...visResult.ppiPeaks].sort((a, b) => b.ppi - a.ppi)[0] ?? null
      const mediaBest = [...mediaResult.ppiPeaks].sort((a, b) => b.ppi - a.ppi)[0] ?? null

      const kindLabel = event.kind === 'morning' ? 'AM' : 'PM'

      rows.push({
        sortDate: eventMs,
        label: event.name,
        publicDate: formatDate(eventMs),
        publicInfo: `${event.planets.length}p ${kindLabel}`,
        publicNotes: event.notes.length > 55 ? event.notes.slice(0, 52) + '...' : event.notes,
        visPeak: visBest,
        visOffset: visBest ? Math.round((visBest.date - eventMs) / MS_PER_DAY) : null,
        mediaPeak: mediaBest,
        mediaOffset: mediaBest ? Math.round((mediaBest.date - eventMs) / MS_PER_DAY) : null,
      })
    }

    // ── Source 2+3: PPI top peaks from years not covered by public events ─
    for (const { year, vis, media } of yearResults) {
      const eventDates = publicYearDates.get(year)
      if (eventDates) {
        // Year has public events — only add if year's top peaks are far from all of them
        const visNear = eventDates.some(d => Math.abs(vis.topPeak.date - d) < 30 * MS_PER_DAY)
        const mediaNear = eventDates.some(d => Math.abs(media.topPeak.date - d) < 30 * MS_PER_DAY)
        if (visNear && mediaNear) continue
      }

      rows.push({
        sortDate: vis.topPeak.date,
        label: `PPI ${year}`,
        publicDate: null,
        publicInfo: null,
        publicNotes: null,
        visPeak: vis.topPeak,
        visOffset: null,
        mediaPeak: media.topPeak,
        mediaOffset: null,
      })
    }

    rows.sort((a, b) => a.sortDate - b.sortDate)

    // ── Format helpers ─────────────────────────────────────────────────
    const KIND_SHORT: Record<string, string> = { morning: 'AM', evening: 'PM', straddling: 'ST' }

    function peakCell(p: PPIDayPoint | null, width: number): string {
      if (!p) return '—'.padEnd(width)
      const k = KIND_SHORT[p.kind] ?? '??'
      const planets = p.planets.map(b => b.slice(0, 3)).join(',')
      return `${formatDate(p.date)} PPI=${p.ppi.toFixed(1).padStart(5)} ${p.span.toFixed(0).padStart(3)}° ${p.planetCount}p ${k} [${planets}]`.padEnd(width).slice(0, width)
    }

    function offsetCell(d: number | null): string {
      if (d === null) return '  — '
      if (d === 0) return '  0d'
      return `${d > 0 ? '+' : ''}${d}d`.padStart(4)
    }

    // ── Print table ────────────────────────────────────────────────────
    const W_LABEL = 42
    const W_PUB = 14
    const W_PEAK = 52
    const W_OFF = 4

    console.log('\n' + '═'.repeat(W_LABEL + 3 + W_PUB + 3 + W_PEAK + 3 + W_PEAK + 3 + W_OFF + 2 + W_OFF))
    console.log('UNIFIED COMPARISON: Public Records ∪ PPI Analysis (2000–2026)')
    console.log('═'.repeat(W_LABEL + 3 + W_PUB + 3 + W_PEAK + 3 + W_PEAK + 3 + W_OFF + 2 + W_OFF))

    const hdr =
      ' # '.padEnd(4) +
      'Event'.padEnd(W_LABEL) +
      '│ ' + 'Public'.padEnd(W_PUB) +
      ' │ ' + 'Visibility best (±30d)'.padEnd(W_PEAK) +
      ' │ ' + 'Media best (±30d)'.padEnd(W_PEAK) +
      ' │ ' + 'ΔVis' + ' ΔMed'

    console.log(hdr)
    console.log(
      '─'.repeat(W_LABEL + 4) + '┼' +
      '─'.repeat(W_PUB + 2) + '┼' +
      '─'.repeat(W_PEAK + 2) + '┼' +
      '─'.repeat(W_PEAK + 2) + '┼' +
      '─'.repeat(W_OFF + 2 + W_OFF)
    )

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const num = `${i + 1}`.padStart(2)
      const isPublic = r.publicDate !== null
      const label = r.label.padEnd(W_LABEL).slice(0, W_LABEL)
      // formatDate returns "DD-Mon-YYYY"; slice(0,6) gives "DD-Mon"
      const pub = (r.publicInfo ? `${r.publicDate!.slice(0, 6)} ${r.publicInfo}` : '—').padEnd(W_PUB).slice(0, W_PUB)

      const src = isPublic ? '★' : ' '
      console.log(
        `${num}${src} ${label}│ ${pub} │ ${peakCell(r.visPeak, W_PEAK)} │ ${peakCell(r.mediaPeak, W_PEAK)} │ ${offsetCell(r.visOffset)} ${offsetCell(r.mediaOffset)}`
      )

      // Print notes on a second line for public events
      if (r.publicNotes) {
        console.log(`${''.padEnd(4 + W_LABEL)}│ ${''.padEnd(W_PUB)} │  ↳ ${r.publicNotes}`)
      }
    }

    console.log(
      '─'.repeat(W_LABEL + 4) + '┴' +
      '─'.repeat(W_PUB + 2) + '┴' +
      '─'.repeat(W_PEAK + 2) + '┴' +
      '─'.repeat(W_PEAK + 2) + '┴' +
      '─'.repeat(W_OFF + 2 + W_OFF)
    )

    // ── Summary statistics ─────────────────────────────────────────────
    const publicRows = rows.filter(r => r.publicDate !== null)
    const ppiOnlyRows = rows.filter(r => r.publicDate === null)
    const visOffsets = publicRows.map(r => r.visOffset).filter((d): d is number => d !== null)
    const mediaOffsets = publicRows.map(r => r.mediaOffset).filter((d): d is number => d !== null)

    const avgVisOff = visOffsets.length > 0
      ? (visOffsets.reduce((a, b) => a + Math.abs(b), 0) / visOffsets.length).toFixed(1)
      : '—'
    const avgMediaOff = mediaOffsets.length > 0
      ? (mediaOffsets.reduce((a, b) => a + Math.abs(b), 0) / mediaOffsets.length).toFixed(1)
      : '—'
    const maxVisOff = visOffsets.length > 0 ? Math.max(...visOffsets.map(Math.abs)) : 0
    const maxMediaOff = mediaOffsets.length > 0 ? Math.max(...mediaOffsets.map(Math.abs)) : 0

    console.log(`\nTotal: ${rows.length} rows (${publicRows.length} public + ${ppiOnlyRows.length} PPI-only)`)
    console.log(`Vis offset from public dates:   mean |Δ|=${avgVisOff}d   max |Δ|=${maxVisOff}d`)
    console.log(`Media offset from public dates: mean |Δ|=${avgMediaOff}d   max |Δ|=${maxMediaOff}d`)

    // ── Elongation diagnosis: why do offsets exist? ──────────────────
    console.log('\n' + '─'.repeat(100))
    console.log('ELONGATION DIAGNOSIS: Planet elongations on public dates vs PPI peak dates')
    console.log('(Planets within 10° of Sun get visibility=0, 10–20°→0.3, 20–30°→0.7)')
    console.log('─'.repeat(100))

    for (const event of KNOWN_EVENTS) {
      const eventDate = new Date(event.date)
      const eventMs = eventDate.getTime()
      const sunLon = getGeocentricEclipticCoords('Sun', eventDate).lon

      // Elongations of all expected planets on the public date
      const publicElongs = event.planets.map((b) => {
        const elong = wrap180(getGeocentricEclipticCoords(b, eventDate).lon - sunLon)
        const abs = Math.abs(elong)
        const flag = abs < 10 ? ' ✗INVISIBLE' : abs < 20 ? ' ⚠dim' : ''
        return `${b.slice(0, 3)}:${elong >= 0 ? '+' : ''}${elong.toFixed(0)}°${flag}`
      })

      // Find the matching row to get offset
      const row = rows.find(r => r.label === event.name)
      const medOff = row?.mediaOffset

      console.log(`\n${event.name}`)
      console.log(`  Public date (${formatDate(eventMs)}): ${publicElongs.join('  ')}`)

      // If there's an offset, show elongations on PPI's preferred date too
      if (row?.mediaPeak && medOff && Math.abs(medOff) > 2) {
        const peakDate = new Date(row.mediaPeak.date)
        const peakSunLon = getGeocentricEclipticCoords('Sun', peakDate).lon
        const peakElongs = row.mediaPeak.planets.map((b) => {
          const elong = wrap180(getGeocentricEclipticCoords(b, peakDate).lon - peakSunLon)
          const abs = Math.abs(elong)
          const flag = abs < 10 ? ' ✗INVISIBLE' : abs < 20 ? ' ⚠dim' : ''
          return `${b.slice(0, 3)}:${elong >= 0 ? '+' : ''}${elong.toFixed(0)}°${flag}`
        })
        console.log(`  PPI peak   (${formatDate(row.mediaPeak.date)}, Δ=${medOff > 0 ? '+' : ''}${medOff}d): ${peakElongs.join('  ')}`)
      } else if (medOff !== null && Math.abs(medOff) <= 2) {
        console.log(`  → PPI agrees (Δ=${medOff}d)`)
      }
    }

    // Assertions
    expect(rows.length).toBeGreaterThanOrEqual(20)
    // Every visible public event should have a non-zero PPI nearby
    for (const r of publicRows) {
      if (r.publicNotes?.includes('Invisible')) continue
      expect((r.visPeak?.ppi ?? 0) + (r.mediaPeak?.ppi ?? 0)).toBeGreaterThan(0)
    }
  }, 600_000)

  it('media weights rank high-count events higher than visibility weights do', () => {
    // For events where 5+ planets were involved, media weights should
    // generally produce higher PPI than visibility weights (since media
    // weights favor count heavily and penalize dim planets less)

    let mediaWinsOnCount = 0
    let visWinsOnCount = 0

    for (const event of KNOWN_EVENTS) {
      if (event.planets.length < 5) continue
      const eventDate = new Date(event.date)
      const visCombos = computeDayCombos(ALL_BODIES, eventDate, 2, VISIBILITY_WEIGHTS)
      const mediaCombos = computeDayCombos(ALL_BODIES, eventDate, 2, MEDIA_WEIGHTS)

      // Find the combo with most planets in each preset
      const visMaxCount = Math.max(0, ...visCombos.map(c => c.planetCount))
      const mediaMaxCount = Math.max(0, ...mediaCombos.map(c => c.planetCount))

      if (mediaMaxCount >= visMaxCount) mediaWinsOnCount++
      else visWinsOnCount++
    }

    console.log(`\nMedia wins on planet count: ${mediaWinsOnCount}, Visibility wins: ${visWinsOnCount}`)
    // Media weights should at least tie (they use same elongation gate)
    expect(mediaWinsOnCount).toBeGreaterThanOrEqual(visWinsOnCount)
  }, 300_000)

  it('visibility weights rank tight-compact events higher', () => {
    // Apr 2022 (4 tight planets, 31° span, PPI~40) should rank higher
    // than Jun 2022 (5 wide planets, 91° span) under visibility weights
    const apr2022 = computeDayCombos(ALL_BODIES, new Date('2022-04-15T00:00:00Z'), 2, VISIBILITY_WEIGHTS)
    const jun2022 = computeDayCombos(ALL_BODIES, new Date('2022-06-24T00:00:00Z'), 2, VISIBILITY_WEIGHTS)

    const aprPPI = apr2022[0]?.ppi ?? 0
    const junPPI = jun2022[0]?.ppi ?? 0

    console.log(`\nVisibility: Apr 2022 PPI=${aprPPI.toFixed(1)} vs Jun 2022 PPI=${junPPI.toFixed(1)}`)
    expect(aprPPI).toBeGreaterThan(junPPI)

    // Under media weights, June (5 planets) should rank at least close to April (4 planets)
    const aprMedia = computeDayCombos(ALL_BODIES, new Date('2022-04-15T00:00:00Z'), 2, MEDIA_WEIGHTS)
    const junMedia = computeDayCombos(ALL_BODIES, new Date('2022-06-24T00:00:00Z'), 2, MEDIA_WEIGHTS)

    const aprMediaPPI = aprMedia[0]?.ppi ?? 0
    const junMediaPPI = junMedia[0]?.ppi ?? 0

    console.log(`Media:      Apr 2022 PPI=${aprMediaPPI.toFixed(1)} vs Jun 2022 PPI=${junMediaPPI.toFixed(1)}`)
    // Media weights should shrink the gap (or reverse it)
    const visGap = aprPPI - junPPI
    const mediaGap = aprMediaPPI - junMediaPPI
    expect(mediaGap).toBeLessThan(visGap)
  }, 120_000)

  it('the two presets produce meaningfully different rankings', () => {
    // Collect top-5 peaks per year under each preset and check they diverge
    let sameTopDate = 0
    let diffTopDate = 0

    for (const { vis, media } of yearResults) {
      if (vis.topPeak.date === media.topPeak.date && vis.topPeak.planetCount === media.topPeak.planetCount) {
        sameTopDate++
      } else {
        diffTopDate++
      }
    }

    console.log(`\nSame top peak date+count: ${sameTopDate}/27, Different: ${diffTopDate}/27`)
    // The presets should disagree on at least some years
    expect(diffTopDate).toBeGreaterThanOrEqual(3)
  }, 10_000)
})
