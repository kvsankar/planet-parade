import { memo, useState, useMemo } from 'react'
import { AlignmentMinimum, AlignmentKind } from '../../types'
import { SERIES_COLORS, formatDate } from '../../constants'

interface MinimaTableProps {
  minima: AlignmentMinimum[]
  currentDate: number | null
  onSelect: (dateMs: number) => void
}

const KIND_LABELS: Record<AlignmentKind, string> = {
  total: 'All',
  morning: 'AM',
  evening: 'PM',
}

type SortColumn = 'date' | 'span'
type SortDir = 'asc' | 'desc'

export default memo(function MinimaTable({ minima, currentDate, onSelect }: MinimaTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return minima
    const arr = [...minima]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortCol === 'date') return (a.date - b.date) * dir
      return (a.separation - b.separation) * dir
    })
    return arr
  }, [minima, sortCol, sortDir])

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
              <th>#</th>
              <th>Group</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={`${m.date}-${m.kind}`}
                className={currentDate === m.date ? 'active' : ''}
                onClick={() => onSelect(m.date)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
