import { useMemo, useState } from 'react'
import { CelestialBodyId } from '../../types'
import { BODY_META, SERIES_COLORS } from '../../constants'
import { getGeocentricEclipticCoords, wrap180 } from '../../lib/alignment'
import { getBodyVisualMagnitude, SkyBodyId } from '../../lib/astronomy'

interface PlanetaryDataTableProps {
  bodies: CelestialBodyId[]
  date: Date
  highlightedPlanets?: Set<CelestialBodyId>
}

type SortCol = 'body' | 'lon' | 'lat' | 'elong' | 'mag'

const MS_PER_HOUR = 3_600_000

export default function PlanetaryDataTable({ bodies, date, highlightedPlanets }: PlanetaryDataTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('lon')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Quantize to nearest hour for cache efficiency during animation
  const quantizedDate = useMemo(() => {
    return new Date(Math.round(date.getTime() / MS_PER_HOUR) * MS_PER_HOUR)
  }, [Math.round(date.getTime() / MS_PER_HOUR)]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const sunEcl = getGeocentricEclipticCoords('Sun', quantizedDate)

    const items = bodies.map((id) => {
      const ecl = getGeocentricEclipticCoords(id, quantizedDate)
      return {
        id,
        absLon: ecl.lon,
        lat: ecl.lat,
        color: BODY_META[id].color,
        elongation: wrap180(ecl.lon - sunEcl.lon),
        mag: getBodyVisualMagnitude(id as SkyBodyId, quantizedDate),
      }
    })

    if (!items.some((item) => item.id === 'Sun')) {
      items.push({
        id: 'Sun' as CelestialBodyId,
        absLon: sunEcl.lon,
        lat: sunEcl.lat,
        color: BODY_META.Sun.color,
        elongation: 0,
        mag: getBodyVisualMagnitude('Sun' as SkyBodyId, quantizedDate),
      })
    }

    return items
  }, [bodies, quantizedDate])

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const arrow = (col: SortCol) => {
    if (sortCol !== col) return ' \u2195'
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  const sorted = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (sortCol) {
        case 'body': return a.id.localeCompare(b.id) * dir
        case 'lon': return (a.absLon - b.absLon) * dir
        case 'lat': return (a.lat - b.lat) * dir
        case 'elong': return (a.elongation - b.elongation) * dir
        case 'mag': return ((a.mag ?? 99) - (b.mag ?? 99)) * dir
      }
    })
    return arr
  }, [rows, sortCol, sortDir])

  if (bodies.length === 0) return null

  return (
    <div className="sky-view-table-area">
      <table className="skyview-table">
        <thead>
          <tr>
            <th className="sortable-th" onClick={() => handleSort('body')}>Body{arrow('body')}</th>
            <th className="sortable-th col-right" onClick={() => handleSort('lon')}>Lon{arrow('lon')}</th>
            <th className="sortable-th col-right" onClick={() => handleSort('lat')}>Lat{arrow('lat')}</th>
            <th className="sortable-th col-right" onClick={() => handleSort('elong')}>Elong{arrow('elong')}</th>
            <th className="sortable-th col-right" onClick={() => handleSort('mag')}>Mag{arrow('mag')}</th>
            <th>Sky</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const isSun = b.id === 'Sun'
            const skyLabel = isSun ? '\u2014' : (b.elongation >= 0 ? 'PM' : 'AM')
            const skyColor = isSun ? '#666' : (b.elongation >= 0 ? SERIES_COLORS.evening : SERIES_COLORS.morning)
            const inCombo = highlightedPlanets?.has(b.id)
            return (
              <tr key={b.id} className={inCombo ? 'active' : ''}>
                <td style={{ color: b.color }}>{b.id}</td>
                <td className="col-right">{b.absLon.toFixed(1)}°</td>
                <td className="col-right">{b.lat >= 0 ? '+' : ''}{b.lat.toFixed(1)}°</td>
                <td className="col-right">{isSun ? '\u2014' : `${b.elongation >= 0 ? '+' : ''}${b.elongation.toFixed(1)}°`}</td>
                <td className="col-right">{b.mag !== null ? b.mag.toFixed(1) : '\u2014'}</td>
                <td style={{ color: skyColor }}>{skyLabel}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
