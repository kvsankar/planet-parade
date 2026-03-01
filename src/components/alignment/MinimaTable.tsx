import { memo, useState, useMemo, useEffect } from 'react'
import { AlignmentKind, CelestialBodyId, PPIDayPoint } from '../../types'
import { SERIES_COLORS, formatDate, ANALYZABLE_BODIES } from '../../constants'

interface MinimaTableProps {
  ppiPeaks: PPIDayPoint[]
  currentDate: number | null
  onSelect: (dateMs: number) => void
  dayDetailCombos?: PPIDayPoint[]
  selectedDayComboIdx?: number | null
  onDayComboSelect?: (idx: number | null) => void
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

type SortColumn = 'date' | 'ppi' | 'span' | 'count'
type SortDir = 'asc' | 'desc'

type DaySortColumn = 'ppi' | 'span' | 'count'

interface ComboEntry { combo: PPIDayPoint; origIdx: number }
interface ComboGroup { key: string; best: ComboEntry; children: ComboEntry[] }

export default memo(function MinimaTable({ ppiPeaks, currentDate, onSelect, dayDetailCombos, selectedDayComboIdx, onDayComboSelect }: MinimaTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('ppi')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [daySortCol, setDaySortCol] = useState<DaySortColumn>('ppi')
  const [daySortDir, setDaySortDir] = useState<SortDir>('desc')

  useEffect(() => { setExpandedGroups(new Set()) }, [dayDetailCombos])

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'ppi' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...ppiPeaks]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortCol === 'date') return (a.date - b.date) * dir
      if (sortCol === 'ppi') return (a.ppi - b.ppi) * dir
      if (sortCol === 'count') return (a.planetCount - b.planetCount) * dir
      return (a.span - b.span) * dir
    })
    return arr
  }, [ppiPeaks, sortCol, sortDir])

  const dayGroups = useMemo(() => {
    if (!dayDetailCombos?.length) return null
    const groupMap = new Map<string, ComboGroup>()
    for (let i = 0; i < dayDetailCombos.length; i++) {
      const c = dayDetailCombos[i]
      const key = `${c.kind}:${c.planetCount}`
      const entry = groupMap.get(key)
      if (!entry) {
        groupMap.set(key, { key, best: { combo: c, origIdx: i }, children: [] })
      } else {
        entry.children.push({ combo: c, origIdx: i })
      }
    }
    const groups = [...groupMap.values()]
    const dDir = daySortDir === 'asc' ? 1 : -1
    groups.sort((a, b) => {
      if (daySortCol === 'count') return (a.best.combo.planetCount - b.best.combo.planetCount) * dDir
      if (daySortCol === 'ppi') return (a.best.combo.ppi - b.best.combo.ppi) * dDir
      return (a.best.combo.span - b.best.combo.span) * dDir
    })
    return groups
  }, [dayDetailCombos, daySortCol, daySortDir])

  if (ppiPeaks.length === 0) {
    return <div className="chart-empty">No planet parades found.</div>
  }

  const arrow = (col: SortColumn) => {
    if (sortCol !== col) return ' \u2195'
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  const handleDaySort = (col: DaySortColumn) => {
    if (daySortCol === col) {
      setDaySortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setDaySortCol(col)
      setDaySortDir(col === 'span' ? 'asc' : 'desc')
    }
  }

  const dayArrow = (col: DaySortColumn) => {
    if (daySortCol !== col) return ' \u2195'
    return daySortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const renderDayRow = (c: PPIDayPoint, origIdx: number, isChild: boolean, groupKey: string, hasChildren: boolean) => {
    const { symbols, names } = sortedPlanets(c.planets)
    const isActive = selectedDayComboIdx !== null
      ? selectedDayComboIdx === origIdx
      : origIdx === 0
    return (
      <tr
        key={`day-${origIdx}-${c.kind}-${c.planetCount}`}
        className={isActive ? 'active' : isChild ? 'day-detail-child' : ''}
        onClick={() => onDayComboSelect?.(selectedDayComboIdx === origIdx ? null : origIdx)}
      >
        <td>
          {!isChild && hasChildren && (
            <button
              className="day-detail-expand-btn"
              onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey) }}
            >
              {expandedGroups.has(groupKey) ? '\u2212' : '+'}
            </button>
          )}
        </td>
        <td className="ppi-cell col-right">{c.ppi.toFixed(1)}</td>
        <td className="col-right">{c.span.toFixed(1)}&deg;</td>
        <td className="col-right">{c.planetCount}</td>
        <td>
          <span className="kind-badge" style={{ color: SERIES_COLORS[c.kind] }}>
            {KIND_LABELS[c.kind]}
          </span>
        </td>
        <td className="planets-cell"><span title={names}>{symbols}</span></td>
      </tr>
    )
  }

  return (
    <div className="minima-table">
      <span className="control-label">Best Parades</span>
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
                className="sortable-th col-right"
                onClick={() => handleSort('ppi')}
              >
                PPI{arrow('ppi')}
              </th>
              <th
                className="sortable-th col-right"
                onClick={() => handleSort('span')}
              >
                Span{arrow('span')}
              </th>
              <th
                className="sortable-th col-right"
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
                onClick={() => onSelect(m.date)}
              >
                <td>{formatDate(m.date)}</td>
                <td className="ppi-cell col-right">{m.ppi.toFixed(1)}</td>
                <td className="col-right">{m.span.toFixed(1)}&deg;</td>
                <td className="col-right">{m.planetCount}</td>
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
        {dayGroups && (
          <div className="day-detail-section">
            <span className="control-label">Best combos on {formatDate(currentDate ?? dayDetailCombos![0].date)}</span>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th className="sortable-th col-right" onClick={() => handleDaySort('ppi')}>PPI{dayArrow('ppi')}</th>
                  <th className="sortable-th col-right" onClick={() => handleDaySort('span')}>Span{dayArrow('span')}</th>
                  <th className="sortable-th col-right" onClick={() => handleDaySort('count')}>#{dayArrow('count')}</th>
                  <th>Group</th>
                  <th>Planets</th>
                </tr>
              </thead>
              <tbody>
                {dayGroups.flatMap(({ key, best, children }) => {
                  const rows = [renderDayRow(best.combo, best.origIdx, false, key, children.length > 0)]
                  if (expandedGroups.has(key)) {
                    for (const child of children) {
                      rows.push(renderDayRow(child.combo, child.origIdx, true, key, false))
                    }
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
})
