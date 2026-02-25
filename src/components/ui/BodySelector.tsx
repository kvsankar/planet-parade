import { useState } from 'react'
import { BODY_LIST, BODY_META } from '../../constants'
import { useSelection } from '../../hooks/useSelection'

export default function BodySelector() {
  const { selectedBodyId, followMode, selectBody, toggleFollow } = useSelection()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="control-section">
      <button className="collapsible-header" onClick={() => setExpanded((e) => !e)}>
        <label className="control-label" style={{ marginBottom: 0 }}>Bodies</label>
        <span className="chevron">{expanded ? '\u25B4' : '\u25BE'}</span>
      </button>
      {expanded && (
        <>
          <div className="body-list">
            <button
              className={`body-btn ${selectedBodyId === 'Sun' ? 'selected' : ''}`}
              style={{ borderLeftColor: BODY_META.Sun.color }}
              onClick={() => selectBody('Sun')}
            >
              Sun
            </button>
            {BODY_LIST.map((id) => (
              <button
                key={id}
                className={`body-btn ${selectedBodyId === id ? 'selected' : ''}`}
                style={{ borderLeftColor: BODY_META[id].color }}
                onClick={() => selectBody(id)}
              >
                {id}
              </button>
            ))}
          </div>
          {selectedBodyId && (
            <label className="toggle-row" style={{ marginTop: '6px' }}>
              <input type="checkbox" checked={followMode} onChange={toggleFollow} />
              <span>Follow</span>
            </label>
          )}
        </>
      )}
    </div>
  )
}
