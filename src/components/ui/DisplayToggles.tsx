import { useDisplaySettings } from '../../hooks/useDisplaySettings'

export default function DisplayToggles() {
  const {
    showOrbits, showLabels, forceInner,
    showStars, showMilkyWay, showConstellations, showConstellationBoundaries,
    showCones, showPPIOverlay,
    toggleOrbits, toggleLabels, toggleForceInner,
    toggleStars, toggleMilkyWay, toggleConstellations, toggleConstellationBoundaries,
    toggleCones, togglePPIOverlay,
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
      <label className="toggle-row">
        <input type="checkbox" checked={showCones} onChange={toggleCones} />
        <span>Alignment Cones</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showPPIOverlay} onChange={togglePPIOverlay} />
        <span>PPI Info</span>
      </label>
      <label className="control-label" style={{ marginTop: 8 }}>Sky</label>
      <label className="toggle-row">
        <input type="checkbox" checked={showStars} onChange={toggleStars} />
        <span>Stars</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showMilkyWay} onChange={toggleMilkyWay} />
        <span>Milky Way</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showConstellations} onChange={toggleConstellations} />
        <span>Constellations</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showConstellationBoundaries} onChange={toggleConstellationBoundaries} />
        <span>Boundaries</span>
      </label>
    </div>
  )
}
