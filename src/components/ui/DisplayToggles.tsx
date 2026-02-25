import { useDisplaySettings } from '../../hooks/useDisplaySettings'

export default function DisplayToggles() {
  const { showOrbits, showLabels, toggleOrbits, toggleLabels } = useDisplaySettings()

  return (
    <div className="control-section">
      <label className="control-label">Display</label>
      <label className="toggle-row">
        <input type="checkbox" checked={showOrbits} onChange={toggleOrbits} />
        <span>Orbits</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showLabels} onChange={toggleLabels} />
        <span>Labels</span>
      </label>
    </div>
  )
}
