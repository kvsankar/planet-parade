import { describe, it } from 'vitest'
import { computePPIResults, DEFAULT_PPI_WEIGHTS } from '../ppiScoring'
import { CelestialBodyId } from '../../types'
import { formatDate } from '../../constants'
import { getGeocentricEclipticCoords, wrap180 } from '../alignment'

describe('PPI diagnostic — 2022 full year', () => {
  const bodies: CelestialBodyId[] = [
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
  ]
  const start = new Date('2022-01-01T00:00:00Z')
  const days = 365

  it('top peaks with per-planet elongations', () => {
    const result = computePPIResults(bodies, start, days, 2, DEFAULT_PPI_WEIGHTS)
    const peaks = [...result.ppiPeaks].sort((a, b) => b.ppi - a.ppi)

    const byKind = { morning: 0, evening: 0, straddling: 0 }
    const byCount = new Map<number, number>()
    for (const p of peaks) {
      byKind[p.kind]++
      byCount.set(p.planetCount, (byCount.get(p.planetCount) ?? 0) + 1)
    }
    const kindStr = Object.entries(byKind).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(' ')
    const countStr = [...byCount].sort((a, b) => b[0] - a[0]).map(([k, n]) => `${k}pl:${n}`).join(' ')
    const ppis = peaks.map(p => p.ppi)
    const nonZero = result.ppiSeries.filter(s => s.ppi > 0).length

    console.log(`\n=== 2022 PPI Results (α=${DEFAULT_PPI_WEIGHTS.alpha}, β=${DEFAULT_PPI_WEIGHTS.beta}, γ=${DEFAULT_PPI_WEIGHTS.gamma}, S=${DEFAULT_PPI_WEIGHTS.spanScale}) ===`)
    console.log(`Peaks: ${peaks.length} | Max: ${ppis[0]?.toFixed(1) ?? 0} | Med: ${ppis[Math.floor(ppis.length / 2)]?.toFixed(1) ?? 0} | Days>0: ${nonZero}/${result.ppiSeries.length}`)
    console.log(`Kinds: ${kindStr} | Counts: ${countStr}`)

    console.log(`\n${'Date'.padEnd(14)} ${'PPI'.padStart(7)} ${'Span'.padStart(6)} ${'#'.padStart(2)} ${'Kind'.padEnd(8)} ${'minE'.padStart(5)} Per-planet elongations`)
    for (const p of peaks) {
      const date = new Date(p.date)
      const sunLon = getGeocentricEclipticCoords('Sun', date).lon

      const planetDetails = p.planets.map((bodyId) => {
        const coords = getGeocentricEclipticCoords(bodyId, date)
        const elong = wrap180(coords.lon - sunLon)
        return { bodyId, elong }
      })

      const elongStr = planetDetails
        .map((d) => `${d.bodyId.slice(0, 3)}:${d.elong >= 0 ? '+' : ''}${d.elong.toFixed(0)}°`)
        .join('  ')

      const minAbsElong = Math.min(...planetDetails.map((d) => Math.abs(d.elong)))

      console.log(
        `${formatDate(p.date).padEnd(14)} ${p.ppi.toFixed(1).padStart(7)} ${(p.span.toFixed(0) + '°').padStart(6)} ${String(p.planetCount).padStart(2)} ${p.kind.padEnd(8)} ${(minAbsElong.toFixed(0) + '°').padStart(5)} ${elongStr}`
      )
    }
  }, 120_000)
})
