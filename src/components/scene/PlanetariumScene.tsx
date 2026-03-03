import { memo, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import PlanetariumCameraController from './PlanetariumCameraController'
import PlanetariumWorldRotation from './PlanetariumWorldRotation'
import PlanetariumPlanets from './PlanetariumPlanets'
import PlanetariumHorizon from './PlanetariumHorizon'
import PlanetariumAltAzGrid from './PlanetariumAltAzGrid'
import PlanetariumEclipticGrid from './PlanetariumEclipticGrid'
import PlanetariumViewGroup from './PlanetariumViewGroup'
import { PlanetariumStarLabels, PlanetariumConstellationLabels } from './PlanetariumSkyLabels'
import RealStars from './RealStars'
import MilkyWaySphere from './MilkyWaySphere'
import ConstellationLines3D from './ConstellationLines3D'
import ConstellationBoundaries3D from './ConstellationBoundaries3D'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { CelestialBodyId, ObserverLocation } from '../../types'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'

const CANVAS_STYLE = { background: '#000000' }
const STEREOGRAPHIC_CAMERA_DISTANCE = CELESTIAL_SPHERE_RADIUS * 1.02
const DISK_MASK_ENABLE_FOV = 120

interface ContentsProps {
  observer: ObserverLocation
  showAltAzGrid: boolean
  showEclipticGrid: boolean
  showStarsLocal: boolean
  showConstellationEdgesLocal: boolean
  showPlanetLabelsLocal: boolean
  showStarLabelsLocal: boolean
  showConstellationLabelsLocal: boolean
}

function PlanetariumContents({
  observer,
  showAltAzGrid,
  showEclipticGrid,
  showStarsLocal,
  showConstellationEdgesLocal,
  showPlanetLabelsLocal,
  showStarLabelsLocal,
  showConstellationLabelsLocal,
}: ContentsProps) {
  const { showMilkyWay, showConstellationBoundaries } = useDisplaySettings()

  return (
    <PlanetariumViewGroup>
      <PlanetariumWorldRotation observer={observer}>
        {showMilkyWay && <MilkyWaySphere />}
        {showStarsLocal && <RealStars brightness={2.0} />}
        {showStarLabelsLocal && <PlanetariumStarLabels />}
        {showConstellationEdgesLocal && <ConstellationLines3D />}
        {showConstellationLabelsLocal && <PlanetariumConstellationLabels />}
        {showConstellationBoundaries && <ConstellationBoundaries3D />}
      </PlanetariumWorldRotation>
      <PlanetariumPlanets observer={observer} showLabels={showPlanetLabelsLocal} />
      {showEclipticGrid && <PlanetariumEclipticGrid observer={observer} />}
      <PlanetariumHorizon showCardinalLabels />
      {showAltAzGrid && <PlanetariumAltAzGrid />}
    </PlanetariumViewGroup>
  )
}

interface Props {
  observer: ObserverLocation
  currentDate: Date
  onAutoDateChange?: (d: Date) => void
  targetComboBodies?: CelestialBodyId[] | null
}

export default memo(function PlanetariumScene({ observer, currentDate, onAutoDateChange, targetComboBodies }: Props) {
  const [showAltAzGrid, setShowAltAzGrid] = useState(true)
  const [showEclipticGrid, setShowEclipticGrid] = useState(true)
  const [showStars, setShowStars] = useState(true)
  const [showConstellationEdges, setShowConstellationEdges] = useState(true)
  const [showPlanetLabels, setShowPlanetLabels] = useState(true)
  const [showStarLabels, setShowStarLabels] = useState(true)
  const [showConstellationLabels, setShowConstellationLabels] = useState(true)
  const [viewFovDeg, setViewFovDeg] = useState(60)

  const diskMaskOpacity = viewFovDeg >= DISK_MASK_ENABLE_FOV ? 1 : 0

  const cameraConfig = useMemo(() => ({
    // Camera offset yields stereographic-like projection with much lower edge shape distortion.
    position: [0, 0, STEREOGRAPHIC_CAMERA_DISTANCE] as [number, number, number],
    fov: 60,
    near: 0.1,
    far: 5000,
  }), [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={cameraConfig} style={CANVAS_STYLE}>
        <PlanetariumContents
          observer={observer}
          showAltAzGrid={showAltAzGrid}
          showEclipticGrid={showEclipticGrid}
          showStarsLocal={showStars}
          showConstellationEdgesLocal={showConstellationEdges}
          showPlanetLabelsLocal={showPlanetLabels}
          showStarLabelsLocal={showStarLabels}
          showConstellationLabelsLocal={showConstellationLabels}
        />
        <PlanetariumCameraController
          observer={observer}
          currentDate={currentDate}
          targetComboBodies={targetComboBodies}
          onAutoDateChange={onAutoDateChange}
          onFovChange={setViewFovDeg}
        />
      </Canvas>
      <div className="planetarium-disk-mask" style={{ opacity: diskMaskOpacity }} />
      <div className="planetarium-grid-toggles">
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showStars} onChange={() => setShowStars((v) => !v)} />
          <span>Stars</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showStarLabels} onChange={() => setShowStarLabels((v) => !v)} />
          <span>Star Labels</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showPlanetLabels} onChange={() => setShowPlanetLabels((v) => !v)} />
          <span>Planet Labels</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showConstellationEdges} onChange={() => setShowConstellationEdges((v) => !v)} />
          <span>Constellation Edges</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showConstellationLabels} onChange={() => setShowConstellationLabels((v) => !v)} />
          <span>Constellation Labels</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showAltAzGrid} onChange={() => setShowAltAzGrid((v) => !v)} />
          <span>Alt/Az Grid</span>
        </label>
        <label className="planetarium-grid-toggle">
          <input type="checkbox" checked={showEclipticGrid} onChange={() => setShowEclipticGrid((v) => !v)} />
          <span>Ecliptic</span>
        </label>
      </div>
    </div>
  )
})
