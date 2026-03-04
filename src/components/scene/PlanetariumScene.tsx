import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import PlanetariumCameraController from './PlanetariumCameraController'
import PlanetariumWorldRotation from './PlanetariumWorldRotation'
import PlanetariumPlanets from './PlanetariumPlanets'
import PlanetariumHorizon from './PlanetariumHorizon'
import PlanetariumAltAzGrid from './PlanetariumAltAzGrid'
import PlanetariumEclipticGrid from './PlanetariumEclipticGrid'
import PlanetariumViewGroup from './PlanetariumViewGroup'
import PlanetariumAtmosphere from './PlanetariumAtmosphere'
import { PlanetariumStarLabels, PlanetariumConstellationLabels } from './PlanetariumSkyLabels'
import RealStars from './RealStars'
import MilkyWaySphere from './MilkyWaySphere'
import ConstellationLines3D from './ConstellationLines3D'
import ConstellationBoundaries3D from './ConstellationBoundaries3D'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { CelestialBodyId, ObserverLocation } from '../../types'
import { altAzToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { getAltAz, getBodyVisualMagnitude, getMoonIllumination } from '../../lib/astronomy'
import { getMoonGlowVisuals } from '../../lib/moonGlow'
import { getNightSkyVisibility } from '../../lib/skyVisibility'
import { DEFAULT_EXTINCTION_COEFF } from '../../lib/starVisibility'
import { AtmosphereAppearance, getAtmosphereAppearance } from '../../lib/atmosphereColor'

const CANVAS_STYLE = { background: '#000000' }
const STEREOGRAPHIC_CAMERA_DISTANCE = CELESTIAL_SPHERE_RADIUS * 1.02
const DISK_MASK_ENABLE_FOV = 120
const PLANETARIUM_MW_BASE_OPACITY = 0.45

interface ContentsProps {
  observer: ObserverLocation
  showMilkyWayLocal: boolean
  milkyWayVisibilityLocal: number
  twilightWashLocal: number
  moonWashLocal: number
  starVisibilityLocal: number
  moonGlowStrengthLocal: number
  sunDirectionLocal: [number, number, number]
  moonDirectionLocal: [number, number, number]
  atmosphereLocal: AtmosphereAppearance
  starExtinctionCoeffLocal: number
  showAtmosphereLocal: boolean
  showAltAzGrid: boolean
  showEclipticGrid: boolean
  showStarsLocal: boolean
  showConstellationEdgesLocal: boolean
  showPlanetLabelsLocal: boolean
  showMoonLocal: boolean
  showStarLabelsLocal: boolean
  showConstellationLabelsLocal: boolean
}

function PlanetariumContents({
  observer,
  showMilkyWayLocal,
  milkyWayVisibilityLocal,
  twilightWashLocal,
  moonWashLocal,
  starVisibilityLocal,
  moonGlowStrengthLocal,
  sunDirectionLocal,
  moonDirectionLocal,
  atmosphereLocal,
  starExtinctionCoeffLocal,
  showAtmosphereLocal,
  showAltAzGrid,
  showEclipticGrid,
  showStarsLocal,
  showConstellationEdgesLocal,
  showPlanetLabelsLocal,
  showMoonLocal,
  showStarLabelsLocal,
  showConstellationLabelsLocal,
}: ContentsProps) {
  const { showConstellationBoundaries } = useDisplaySettings()

  return (
    <PlanetariumViewGroup>
      {showAtmosphereLocal && (
        <PlanetariumAtmosphere
          appearance={atmosphereLocal}
          sunDirectionLocal={sunDirectionLocal}
        />
      )}
      <PlanetariumWorldRotation observer={observer}>
        {showMilkyWayLocal && (
          <MilkyWaySphere
            visibility={milkyWayVisibilityLocal}
            baseOpacity={PLANETARIUM_MW_BASE_OPACITY}
            sunDirectionLocal={sunDirectionLocal}
            moonDirectionLocal={moonDirectionLocal}
            twilightWash={twilightWashLocal}
            moonWash={moonWashLocal}
          />
        )}
        {showStarsLocal && (
          <RealStars
            brightness={2.0}
            visibility={starVisibilityLocal}
            moonGlowStrength={moonGlowStrengthLocal}
            moonDirection={moonDirectionLocal}
            extinctionCoeff={starExtinctionCoeffLocal}
          />
        )}
        {showStarLabelsLocal && <PlanetariumStarLabels />}
        {showConstellationEdgesLocal && <ConstellationLines3D />}
        {showConstellationLabelsLocal && <PlanetariumConstellationLabels />}
        {showConstellationBoundaries && <ConstellationBoundaries3D />}
      </PlanetariumWorldRotation>
      <PlanetariumPlanets
        observer={observer}
        showLabels={showPlanetLabelsLocal}
        showMoon={showMoonLocal}
        showAtmosphere={showAtmosphereLocal}
      />
      {showEclipticGrid && <PlanetariumEclipticGrid observer={observer} />}
      <PlanetariumHorizon showCardinalLabels />
      {showAltAzGrid && <PlanetariumAltAzGrid />}
    </PlanetariumViewGroup>
  )
}

interface Props {
  observer: ObserverLocation
  currentDate: Date
  timeZone?: string | null
  autoViewResetToken?: number
  onAutoDateChange?: (d: Date) => void
  targetComboBodies?: CelestialBodyId[] | null
}

export default memo(function PlanetariumScene({
  observer,
  currentDate,
  timeZone,
  autoViewResetToken,
  onAutoDateChange,
  targetComboBodies,
}: Props) {
  const [showMilkyWay, setShowMilkyWay] = useState(true)
  const [showAltAzGrid, setShowAltAzGrid] = useState(true)
  const [showEclipticGrid, setShowEclipticGrid] = useState(true)
  const [showStars, setShowStars] = useState(true)
  const [showConstellationEdges, setShowConstellationEdges] = useState(true)
  const [showPlanetLabels, setShowPlanetLabels] = useState(true)
  const [showMoon, setShowMoon] = useState(true)
  const [showStarLabels, setShowStarLabels] = useState(false)
  const [showConstellationLabels, setShowConstellationLabels] = useState(false)
  const [showAtmosphere, setShowAtmosphere] = useState(true)
  const [viewFovDeg, setViewFovDeg] = useState(60)
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const layerMenuRef = useRef<HTMLDivElement>(null)

  const diskMaskOpacity = viewFovDeg >= DISK_MASK_ENABLE_FOV ? 1 : 0

  const skyVisibility = useMemo(() => {
    const sunAltAz = getAltAz('Sun', currentDate, observer)
    const sunAlt = sunAltAz.altitude
    const moonAltAz = getAltAz('Moon', currentDate, observer)
    const moonIllumination = getMoonIllumination(currentDate)
    const moonMagnitude = getBodyVisualMagnitude('Moon', currentDate)
    const moonGlow = getMoonGlowVisuals({
      moonIllumination,
      moonAltitudeDeg: moonAltAz.altitude,
      moonMagnitude,
    })
    const visibility = getNightSkyVisibility({
      sunAltitudeDeg: sunAlt,
      moonGlowStrength: moonGlow.strength,
      includeSunlight: showAtmosphere,
      includeMoonlight: showAtmosphere && showMoon,
    })
    const atmosphere = getAtmosphereAppearance({
      sunAltitudeDeg: sunAlt,
      moonWash: visibility.moonWash,
      enabled: showAtmosphere,
    })
    const sunDir = altAzToSceneSphere(sunAltAz.altitude, sunAltAz.azimuth, 1)
    const moonDir = altAzToSceneSphere(moonAltAz.altitude, moonAltAz.azimuth, 1)
    return {
      twilightWash: visibility.twilightWash,
      moonWash: visibility.moonWash,
      starVisibility: visibility.starVisibility,
      milkyWayVisibility: visibility.milkyWayVisibility,
      moonGlowStrength: showAtmosphere && showMoon ? moonGlow.strength : 0,
      sunDirection: sunDir,
      moonDirection: moonDir,
      atmosphere,
      starExtinctionCoeff: showAtmosphere ? DEFAULT_EXTINCTION_COEFF : 0,
    }
  }, [
    currentDate,
    observer.lat,
    observer.lon,
    observer.height,
    showAtmosphere,
    showMoon,
  ])

  const cameraConfig = useMemo(() => ({
    // Camera offset yields stereographic-like projection with much lower edge shape distortion.
    position: [0, 0, STEREOGRAPHIC_CAMERA_DISTANCE] as [number, number, number],
    fov: 60,
    near: 0.1,
    far: 5000,
  }), [])

  useEffect(() => {
    if (!showLayerMenu) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (layerMenuRef.current && target && !layerMenuRef.current.contains(target)) {
        setShowLayerMenu(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [showLayerMenu])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={cameraConfig} style={CANVAS_STYLE}>
        <PlanetariumContents
          observer={observer}
          showMilkyWayLocal={showMilkyWay}
          milkyWayVisibilityLocal={skyVisibility.milkyWayVisibility}
          twilightWashLocal={skyVisibility.twilightWash}
          moonWashLocal={skyVisibility.moonWash}
          starVisibilityLocal={skyVisibility.starVisibility}
          moonGlowStrengthLocal={skyVisibility.moonGlowStrength}
          sunDirectionLocal={skyVisibility.sunDirection}
          moonDirectionLocal={skyVisibility.moonDirection}
          atmosphereLocal={skyVisibility.atmosphere}
          starExtinctionCoeffLocal={skyVisibility.starExtinctionCoeff}
          showAtmosphereLocal={showAtmosphere}
          showAltAzGrid={showAltAzGrid}
          showEclipticGrid={showEclipticGrid}
          showStarsLocal={showStars}
          showConstellationEdgesLocal={showConstellationEdges}
          showPlanetLabelsLocal={showPlanetLabels}
          showMoonLocal={showMoon}
          showStarLabelsLocal={showStarLabels}
          showConstellationLabelsLocal={showConstellationLabels}
        />
        <PlanetariumCameraController
          observer={observer}
          currentDate={currentDate}
          timeZone={timeZone}
          autoResetToken={autoViewResetToken}
          targetComboBodies={targetComboBodies}
          onAutoDateChange={onAutoDateChange}
          onFovChange={setViewFovDeg}
        />
      </Canvas>
      <div className="planetarium-disk-mask" style={{ opacity: diskMaskOpacity }} />
      <div ref={layerMenuRef} className="planetarium-layer-menu">
        <button
          className="planetarium-layer-btn"
          onClick={() => setShowLayerMenu((v) => !v)}
          aria-label="Planetarium layers"
          title="Planetarium layers"
        >
          ☰
        </button>
        {showLayerMenu && (
          <div className="planetarium-grid-toggles">
            <label className="planetarium-grid-toggle">
              <input type="checkbox" checked={showStars} onChange={() => setShowStars((v) => !v)} />
              <span>Stars</span>
            </label>
            <label className="planetarium-grid-toggle">
              <input type="checkbox" checked={showMilkyWay} onChange={() => setShowMilkyWay((v) => !v)} />
              <span>Milky Way</span>
            </label>
            <label className="planetarium-grid-toggle">
              <input type="checkbox" checked={showAtmosphere} onChange={() => setShowAtmosphere((v) => !v)} />
              <span>Atmosphere</span>
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
              <input type="checkbox" checked={showMoon} onChange={() => setShowMoon((v) => !v)} />
              <span>Moon</span>
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
        )}
      </div>
    </div>
  )
})
