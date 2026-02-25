import { AlignmentKind } from '../../types'
import { SERIES_COLORS } from '../../constants'

interface SeriesToggleProps {
  visible: Set<AlignmentKind>
  onChange: (v: Set<AlignmentKind>) => void
}

const SERIES_OPTIONS: { kind: AlignmentKind; label: string }[] = [
  { kind: 'total', label: 'All' },
  { kind: 'morning', label: 'AM' },
  { kind: 'evening', label: 'PM' },
]

export default function SeriesToggle({ visible, onChange }: SeriesToggleProps) {
  const toggle = (kind: AlignmentKind) => {
    const next = new Set(visible)
    if (next.has(kind)) {
      if (next.size > 1) next.delete(kind) // keep at least one
    } else {
      next.add(kind)
    }
    onChange(next)
  }

  return (
    <div className="series-toggle">
      <label className="control-label">Chart Series</label>
      <div className="series-toggle-chips">
        {SERIES_OPTIONS.map(({ kind, label }) => (
          <button
            key={kind}
            className={`series-chip ${visible.has(kind) ? 'active' : ''}`}
            style={{
              borderColor: SERIES_COLORS[kind],
              ...(visible.has(kind) ? { background: SERIES_COLORS[kind] + '30' } : {}),
            }}
            onClick={() => toggle(kind)}
          >
            <span className="series-chip-dot" style={{ background: SERIES_COLORS[kind] }} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
