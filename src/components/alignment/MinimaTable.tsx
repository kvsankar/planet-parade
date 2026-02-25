import { memo } from 'react'
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

export default memo(function MinimaTable({ minima, currentDate, onSelect }: MinimaTableProps) {
  if (minima.length === 0) {
    return <div className="chart-empty">No close alignments found.</div>
  }

  return (
    <div className="minima-table">
      <span className="control-label">Closest Alignments</span>
      <div className="minima-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Span</th>
              <th>Group</th>
            </tr>
          </thead>
          <tbody>
            {minima.map((m) => (
              <tr
                key={`${m.date}-${m.kind}`}
                className={currentDate === m.date ? 'active' : ''}
                onClick={() => onSelect(m.date)}
              >
                <td>{formatDate(m.date)}</td>
                <td>{m.separation.toFixed(1)}°</td>
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
