import { memo } from 'react'
import { CelestialBodyId } from '../../types'
import { ANALYZABLE_BODIES, BODY_META } from '../../constants'

interface PlanetPickerProps {
  selected: CelestialBodyId[]
  onChange: (bodies: CelestialBodyId[]) => void
}

export default memo(function PlanetPicker({ selected, onChange }: PlanetPickerProps) {
  const toggle = (id: CelestialBodyId) => {
    if (selected.includes(id)) {
      onChange(selected.filter((b) => b !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="planet-picker">
      <span className="control-label">Planets</span>
      <div className="planet-chips">
        {ANALYZABLE_BODIES.map((id) => (
          <button
            key={id}
            className={`planet-chip ${selected.includes(id) ? 'active' : ''}`}
            style={{
              borderColor: selected.includes(id) ? BODY_META[id].color : undefined,
              color: selected.includes(id) ? BODY_META[id].color : undefined,
            }}
            onClick={() => toggle(id)}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  )
})
