import { memo, useState, useMemo } from 'react'
import { AlignmentMinimum, AlignmentKind, CelestialBodyId } from '../../types'
import { SERIES_COLORS, formatDate, ANALYZABLE_BODIES } from '../../constants'

interface MinimaTableProps {
  minima: AlignmentMinimum[]
  availableTabs: number[]
  currentDate: number | null
  onSelect: (dateMs: number) => void
  onTabChange?: (tab: number) => void
}

const KIND_LABELS: Record<AlignmentKind, string> = {
  morning: 'AM',
  evening: 'PM',
  straddling: 'Straddle',
}

const SOLAR_RANK = new Map(ANALYZABLE_BODIES.map((b, i) => [b, i]))

const BODY_SYMBOL: Record<string, string> = {
  Mercury: '\u263F', Venus: '\u2640', Mars: '\u2642', Jupiter: '\u2643',
  Saturn: '\u2644', Uranus: '\u26E2', Neptune: '\u2646',
}

function sortedPlanets(planets: CelestialBodyId[]): { symbols: string; names: string } {
  const sorted = [...planets].sort((a, b) => (SOLAR_RANK.get(a) ?? 99) - (SOLAR_RANK.get(b) ?? 99))
  return {
    symbols: sorted.map((p) => BODY_SYMBOL[p] || p).join(' '),
    names: sorted.join(', '),
  }
}

type SortColumn = 'date' | 'span' | 'count'
type SortDir = 'asc' | 'desc'

export default memo(function MinimaTable({ minima, availableTabs, currentDate, onSelect, onTabChange }: MinimaTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [visibleCounts, setVisibleCounts] = useState<Set<number> | null>(null)

  // Default: all available tabs selected
  const effectiveCounts = visibleCounts ?? new Set(availableTabs)

  const toggleCount = (k: number) => {
    const current = new Set(effectiveCounts)
    if (current.has(k)) {
      if (current.size > 1) current.delete(k)
    } else {
      current.add(k)
    }
    setVisibleCounts(current)
  }

  const filtered = useMemo(() => {
    return minima.filter((m) => effectiveCounts.has(m.planetCount))
  }, [minima, effectiveCounts])

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const arr = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortCol === 'date') return (a.date - b.date) * dir
      if (sortCol === 'count') return (a.planetCount - b.planetCount) * dir
      return (a.separation - b.separation) * dir
    })
    return arr
  }, [filtered, sortCol, sortDir])

  if (minima.length === 0) {
    return <div className="chart-empty">No close alignments found.</div>
  }

  const arrow = (col: SortColumn) => {
    if (sortCol !== col) return ' \u2195'
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  return (
    <div className="minima-table">
      <span className="control-label">Closest Alignments</span>
      {availableTabs.length > 1 && (
        <div className="minima-count-filter">
          {availableTabs.map((k) => (
            <button
              key={k}
              className={`min-planet-chip ${effectiveCounts.has(k) ? 'active' : ''}`}
              onClick={() => toggleCount(k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      <div className="minima-scroll">
        <table>
          <thead>
            <tr>
              <th
                className="sortable-th"
                onClick={() => handleSort('date')}
              >
                Date{arrow('date')}
              </th>
              <th
                className="sortable-th"
                onClick={() => handleSort('span')}
              >
                Span{arrow('span')}
              </th>
              <th
                className="sortable-th"
                onClick={() => handleSort('count')}
              >
                #{arrow('count')}
              </th>
              <th>Group</th>
              <th>Planets</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={`${m.date}-${m.kind}-${m.planetCount}-${m.planets.join(',')}`}
                className={currentDate === m.date ? 'active' : ''}
                onClick={() => { onSelect(m.date); onTabChange?.(m.planetCount) }}
              >
                <td>{formatDate(m.date)}</td>
                <td>{m.separation.toFixed(1)}&deg;</td>
                <td>{m.planetCount}</td>
                <td>
                  <span
                    className="kind-badge"
                    style={{ color: SERIES_COLORS[m.kind] }}
                  >
                    {KIND_LABELS[m.kind]}
                  </span>
                </td>
                <td className="planets-cell">
                  {m.planets.length > 0
                    ? (() => { const { symbols, names } = sortedPlanets(m.planets); return <span title={names}>{symbols}</span> })()
                    : m.planetCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
