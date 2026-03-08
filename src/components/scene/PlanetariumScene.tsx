import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
import { CelestialBodyId, ObserverLocation, SkyBrightnessLevel } from '../../types'
import { CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { AtmosphereAppearance } from '../../lib/atmosphereColor'
import { simulationStore } from '../../hooks/useSimulationStore'
import { PlanetariumSkyState, computePlanetariumSkyState } from './planetariumSkyState'
import {
  SKY_BRIGHTNESS_LABELS,
  SKY_BRIGHTNESS_LEVELS,
  SKY_CONSTELLATION_EDGE_BRIGHTNESS_FACTOR,
  SKY_STAR_BRIGHTNESS_FACTOR,
} from '../../lib/skyBrightness'

const CANVAS_STYLE = { background: '#000000' }
const STEREOGRAPHIC_CAMERA_DISTANCE = CELESTIAL_SPHERE_RADIUS * 1.02
const DISK_MASK_ENABLE_FOV = 120
const PLANETARIUM_MW_BASE_OPACITY = 0.45
const PLANETARIUM_STAR_VISIBILITY_SCALE: Record<SkyBrightnessLevel, number> = {
  low: 1,
  med: 1.35,
  high: 1.7,
}
const PLANETARIUM_CONSTELLATION_EDGE_SCALE: Record<SkyBrightnessLevel, number> = {
  low: 1,
  med: 1.5,
  high: 1.8,
}

interface ContentsProps {
  observer: ObserverLocation
  skyStateRef: MutableRefObject<PlanetariumSkyState>
  showMilkyWayLocal: boolean
  milkyWayVisibilityLocal: number
  twilightWashLocal: number
  moonWashLocal: number
  starVisibilityLocal: number
  starVisibilityScale: number
  sunDirectionLocal: [number, number, number]
  moonDirectionLocal: [number, number, number]
  atmosphereLocal: AtmosphereAppearance
  starExtinctionCoeffLocal: number
  showAtmosphereLocal: boolean
  showAltAzGrid: boolean
  showEclipticGrid: boolean
  showStarsLocal: boolean
  starBrightnessFactor: number
  showConstellationEdgesLocal: boolean
  constellationEdgeBrightnessFactor: number
  showPlanetLabelsLocal: boolean
  showMoonLocal: boolean
  showStarLabelsLocal: boolean
  showConstellationLabelsLocal: boolean
}

function PlanetariumContents({
  observer,
  skyStateRef,
  showMilkyWayLocal,
  milkyWayVisibilityLocal,
  twilightWashLocal,
  moonWashLocal,
  starVisibilityLocal,
  starVisibilityScale,
  sunDirectionLocal,
  moonDirectionLocal,
  atmosphereLocal,
  starExtinctionCoeffLocal,
  showAtmosphereLocal,
  showAltAzGrid,
  showEclipticGrid,
  showStarsLocal,
  starBrightnessFactor,
  showConstellationEdgesLocal,
  constellationEdgeBrightnessFactor,
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
          skyStateRef={skyStateRef}
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
            skyStateRef={skyStateRef}
          />
        )}
        {showStarsLocal && (
          <RealStars
            mode="atmospheric"
            brightness={2.0 * starBrightnessFactor}
            visibility={starVisibilityLocal}
            visibilityScale={starVisibilityScale}
            twilightWash={twilightWashLocal}
            moonWash={moonWashLocal}
            sunDirection={sunDirectionLocal}
            moonDirection={moonDirectionLocal}
            extinctionCoeff={starExtinctionCoeffLocal}
            skyStateRef={skyStateRef}
          />
        )}
        {showStarLabelsLocal && <PlanetariumStarLabels />}
        {showConstellationEdgesLocal && <ConstellationLines3D opacity={0.1 * constellationEdgeBrightnessFactor} />}
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

interface SkyDriverProps {
  observer: ObserverLocation
  showAtmosphere: boolean
  showMoon: boolean
  skyStateRef: MutableRefObject<PlanetariumSkyState>
}

function PlanetariumSkyStateDriver({
  observer,
  showAtmosphere,
  showMoon,
  skyStateRef,
}: SkyDriverProps) {
  useFrame(() => {
    skyStateRef.current = computePlanetariumSkyState(
      simulationStore.date,
      observer,
      showAtmosphere,
      showMoon,
    )
  })

  return null
}

interface Props {
  observer: ObserverLocation
  currentDate: Date
  timeZone?: string | null
  autoViewResetToken?: number
  onAutoDateChange?: (d: Date) => void
  targetComboBodies?: CelestialBodyId[] | null
  preferNightTargets?: boolean
  skyBrightnessLevel: SkyBrightnessLevel
  onSkyBrightnessLevelChange: (level: SkyBrightnessLevel) => void
}

function PlanetariumScene({
  observer,
  currentDate,
  timeZone,
  autoViewResetToken,
  onAutoDateChange,
  targetComboBodies,
  preferNightTargets = true,
  skyBrightnessLevel,
  onSkyBrightnessLevelChange,
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
  const starBrightnessFactor = SKY_STAR_BRIGHTNESS_FACTOR[skyBrightnessLevel]
  const starVisibilityScale = PLANETARIUM_STAR_VISIBILITY_SCALE[skyBrightnessLevel]
  const constellationEdgeBrightnessFactor = SKY_CONSTELLATION_EDGE_BRIGHTNESS_FACTOR[skyBrightnessLevel]
  const constellationEdgeScale = PLANETARIUM_CONSTELLATION_EDGE_SCALE[skyBrightnessLevel]

  const diskMaskOpacity = viewFovDeg >= DISK_MASK_ENABLE_FOV ? 1 : 0

  const initialSkyState = useMemo(() => computePlanetariumSkyState(
    simulationStore.date,
    observer,
    showAtmosphere,
    showMoon,
  ), [
    observer.lat,
    observer.lon,
    observer.height,
    showAtmosphere,
    showMoon,
  ])
  const skyStateRef = useRef<PlanetariumSkyState>(initialSkyState)

  useEffect(() => {
    skyStateRef.current = initialSkyState
  }, [initialSkyState])

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
        <PlanetariumSkyStateDriver
          observer={observer}
          showAtmosphere={showAtmosphere}
          showMoon={showMoon}
          skyStateRef={skyStateRef}
        />
        <PlanetariumContents
          observer={observer}
          skyStateRef={skyStateRef}
          showMilkyWayLocal={showMilkyWay}
          milkyWayVisibilityLocal={skyStateRef.current.milkyWayVisibility}
          twilightWashLocal={skyStateRef.current.twilightWash}
          moonWashLocal={skyStateRef.current.moonWash}
          starVisibilityLocal={skyStateRef.current.starVisibility}
          starVisibilityScale={starVisibilityScale}
          sunDirectionLocal={skyStateRef.current.sunDirection}
          moonDirectionLocal={skyStateRef.current.moonDirection}
          atmosphereLocal={skyStateRef.current.atmosphere}
          starExtinctionCoeffLocal={skyStateRef.current.starExtinctionCoeff}
          showAtmosphereLocal={showAtmosphere}
          showAltAzGrid={showAltAzGrid}
          showEclipticGrid={showEclipticGrid}
          showStarsLocal={showStars}
          starBrightnessFactor={starBrightnessFactor}
          showConstellationEdgesLocal={showConstellationEdges}
          constellationEdgeBrightnessFactor={constellationEdgeBrightnessFactor * constellationEdgeScale}
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
          preferNightTargets={preferNightTargets}
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
            <div className="planetarium-grid-toggle planetarium-brightness-control">
              <span>Brightness</span>
              <span className="skychart-mw-pills">
                {SKY_BRIGHTNESS_LEVELS.map((level) => (
                  <button
                    key={level}
                    className={`skychart-mw-pill${skyBrightnessLevel === level ? ' active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      onSkyBrightnessLevelChange(level)
                    }}
                  >
                    {SKY_BRIGHTNESS_LABELS[level]}
                  </button>
                ))}
              </span>
            </div>
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
}

function sameTargetBodies(
  prev: CelestialBodyId[] | null | undefined,
  next: CelestialBodyId[] | null | undefined,
): boolean {
  if (prev === next) return true
  if (!prev || !next) return !prev && !next
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false
  }
  return true
}

function arePlanetariumScenePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.observer.lat === next.observer.lat
    && prev.observer.lon === next.observer.lon
    && prev.observer.height === next.observer.height
    && prev.timeZone === next.timeZone
    && prev.autoViewResetToken === next.autoViewResetToken
    && prev.onAutoDateChange === next.onAutoDateChange
    && prev.preferNightTargets === next.preferNightTargets
    && prev.skyBrightnessLevel === next.skyBrightnessLevel
    && prev.onSkyBrightnessLevelChange === next.onSkyBrightnessLevelChange
    && sameTargetBodies(prev.targetComboBodies, next.targetComboBodies)
  )
}

export default memo(PlanetariumScene, arePlanetariumScenePropsEqual)
