import { memo, useState, useMemo, useEffect } from 'react'
import { AlignmentKind, CelestialBodyId, PPIDayPoint, RankingMetric } from '../../types'
import { SERIES_COLORS, formatDate, ANALYSIS_BODY_ORDER } from '../../constants'
import { getTimeZoneDayKey } from '../../lib/timeZoneDay'

interface MinimaTableProps {
  ppiPeaks: PPIDayPoint[]
  rankingMetric?: RankingMetric
  currentDate: number | null
  onSelect: (dateMs: number) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  timeZone?: string | null
  dayDetailCombos?: PPIDayPoint[]
  selectedDayComboIdx?: number | null
  onDayComboSelect?: (idx: number | null) => void
}

const KIND_LABELS: Record<AlignmentKind, string> = {
  morning: 'AM',
  evening: 'PM',
  straddling: 'Straddle',
}

const SOLAR_RANK = new Map(ANALYSIS_BODY_ORDER.map((b, i) => [b, i]))

const BODY_SYMBOL: Record<string, string> = {
  Sun: '\u2609', Moon: '\u263D',
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

export default memo(function MinimaTable({
  ppiPeaks,
  rankingMetric = 'ppi',
  currentDate,
  onSelect,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  timeZone,
  dayDetailCombos,
  selectedDayComboIdx,
  onDayComboSelect,
}: MinimaTableProps) {
  const showPpi = rankingMetric === 'ppi'
  const [sortCol, setSortCol] = useState<SortColumn>(showPpi ? 'ppi' : 'span')
  const [sortDir, setSortDir] = useState<SortDir>(showPpi ? 'desc' : 'asc')

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [daySortCol, setDaySortCol] = useState<DaySortColumn>(showPpi ? 'ppi' : 'span')
  const [daySortDir, setDaySortDir] = useState<SortDir>(showPpi ? 'desc' : 'asc')

  useEffect(() => { setExpandedGroups(new Set()) }, [dayDetailCombos])
  useEffect(() => {
    setSortCol(showPpi ? 'ppi' : 'span')
    setSortDir(showPpi ? 'desc' : 'asc')
    setDaySortCol(showPpi ? 'ppi' : 'span')
    setDaySortDir(showPpi ? 'desc' : 'asc')
  }, [showPpi])

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'span' ? 'asc' : 'desc')
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

  const currentDay = useMemo(() => {
    if (currentDate == null) return null
    return getTimeZoneDayKey(new Date(currentDate), timeZone)
  }, [currentDate, timeZone])

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
        {showPpi && <td className="ppi-cell col-right">{c.ppi.toFixed(1)}</td>}
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
      <div className="minima-table-header">
        <span className="control-label">{showPpi ? 'Best Parades' : 'Best Clusters'}</span>
        <div className="minima-table-nav">
          <button
            className="minima-nav-btn"
            onClick={onPrev}
            disabled={!onPrev || !hasPrev}
            title="Previous parade peak"
          >
            &#9664; Prev
          </button>
          <button
            className="minima-nav-btn"
            onClick={onNext}
            disabled={!onNext || !hasNext}
            title="Next parade peak"
          >
            Next &#9654;
          </button>
        </div>
      </div>
      {ppiPeaks.length === 0 ? (
        <div className="chart-empty">{showPpi ? 'No planet parades found.' : 'No clusters found.'}</div>
      ) : (
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
                {showPpi && (
                  <th
                    className="sortable-th col-right"
                    onClick={() => handleSort('ppi')}
                  >
                    PPI{arrow('ppi')}
                  </th>
                )}
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
                  className={currentDay !== null && currentDay === getTimeZoneDayKey(new Date(m.date), timeZone) ? 'active' : ''}
                  onClick={() => onSelect(m.date)}
                >
                  <td>{formatDate(m.date, timeZone)}</td>
                  {showPpi && <td className="ppi-cell col-right">{m.ppi.toFixed(1)}</td>}
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
              <span className="control-label">Best combos on {formatDate(currentDate ?? dayDetailCombos![0].date, timeZone)}</span>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {showPpi && (
                      <th className="sortable-th col-right" onClick={() => handleDaySort('ppi')}>PPI{dayArrow('ppi')}</th>
                    )}
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
      )}
    </div>
  )
})
