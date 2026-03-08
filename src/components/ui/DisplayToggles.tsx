import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { CONTROL_LABELS, CONTROL_SECTIONS } from '../../lib/controlLabels'

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
      <label className="control-label">{CONTROL_SECTIONS.view}</label>
      <label className="toggle-row">
        <input type="checkbox" checked={forceInner} onChange={toggleForceInner} />
        <span>{CONTROL_LABELS.innerSolarSystem}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showOrbits} onChange={toggleOrbits} />
        <span>{CONTROL_LABELS.orbits}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showLabels} onChange={toggleLabels} />
        <span>{CONTROL_LABELS.bodyLabels}</span>
      </label>
      <label className="control-label" style={{ marginTop: 8 }}>{CONTROL_SECTIONS.alignment}</label>
      <label className="toggle-row">
        <input type="checkbox" checked={showCones} onChange={toggleCones} />
        <span>{CONTROL_LABELS.alignmentCones}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showPPIOverlay} onChange={togglePPIOverlay} />
        <span>{CONTROL_LABELS.paradeInfo}</span>
      </label>
      <label className="control-label" style={{ marginTop: 8 }}>{CONTROL_SECTIONS.sky}</label>
      <label className="toggle-row">
        <input type="checkbox" checked={showStars} onChange={toggleStars} />
        <span>{CONTROL_LABELS.stars}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showMilkyWay} onChange={toggleMilkyWay} />
        <span>{CONTROL_LABELS.milkyWay}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showConstellations} onChange={toggleConstellations} />
        <span>{CONTROL_LABELS.constellationEdges}</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={showConstellationBoundaries} onChange={toggleConstellationBoundaries} />
        <span>{CONTROL_LABELS.constellationBoundaries}</span>
      </label>
    </div>
  )
}
