import { useDisplaySettings } from '../../hooks/useDisplaySettings'

export default function DisplayToggles() {
  const {
    showOrbits, showLabels, forceInner,
    toggleOrbits, toggleLabels, toggleForceInner,
  } = useDisplaySettings()

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
      <label className="toggle-row">
        <input type="checkbox" checked={forceInner} onChange={toggleForceInner} />
        <span>Inner Solar System</span>
      </label>
    </div>
  )
}
