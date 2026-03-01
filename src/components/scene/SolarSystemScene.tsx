import { useState, useRef, useMemo, memo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import Sun from './Sun'
import CelestialBody from './CelestialBody'
import OrbitLine from './OrbitLine'
import AlignmentCones from './AlignmentCones'
import CameraController from './CameraController'
import RealStars from './RealStars'
import MilkyWaySphere from './MilkyWaySphere'
import ConstellationLines3D from './ConstellationLines3D'
import ConstellationBoundaries3D from './ConstellationBoundaries3D'
import { BODY_LIST } from '../../constants'
import { CelestialBodyId, AlignmentKind } from '../../types'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { LabelRegistryProvider } from '../../hooks/useLabelOverlap'
import { BestPerKind } from '../../lib/alignment'

const INNER_BODIES: Set<CelestialBodyId> = new Set(['Mercury', 'Venus', 'Mars'])
const INNER_HIDE_DIST = 150 // scene units -- hide inner planets when camera is farther than this

// Pre-filtered body lists (avoid creating new arrays every render)
const OUTER_BODIES = BODY_LIST.filter((id) => !INNER_BODIES.has(id))

// Stable Canvas props
const MAIN_CANVAS_STYLE = { background: '#0a0a0f' }

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
  visibleSeries?: Set<AlignmentKind>
  bestPerKind?: BestPerKind
}

function SceneContents({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  const { showOrbits, forceInner, showStars, showMilkyWay, showConstellations, showConstellationBoundaries, showCones } = useDisplaySettings()
  const [showInner, setShowInner] = useState(false) // default camera at 300 -> hidden
  const showInnerRef = useRef(false)

  // Check if any active combo contains an inner planet
  const comboHasInner = showCones && bestPerKind != null && (['morning', 'evening', 'straddling'] as AlignmentKind[]).some(
    (kind) => bestPerKind[kind]?.bodies.some((b) => INNER_BODIES.has(b))
  )

  useFrame(({ camera }) => {
    const dist = camera.position.length()
    const shouldShow = comboHasInner || forceInner || dist < INNER_HIDE_DIST
    if (shouldShow !== showInnerRef.current) {
      showInnerRef.current = shouldShow
      setShowInner(shouldShow)
    }
  })

  // Use pre-computed constant arrays instead of filtering every render
  const visibleBodies = showInner ? BODY_LIST : OUTER_BODIES

  const hasCones = bestPerKind && (bestPerKind.morning || bestPerKind.evening || bestPerKind.straddling)

  return (
    <LabelRegistryProvider>
      <ambientLight intensity={0.15} />
      {showMilkyWay && <MilkyWaySphere />}
      {showStars && <RealStars />}
      {showConstellations && <ConstellationLines3D />}
      {showConstellationBoundaries && <ConstellationBoundaries3D />}
      <Sun />
      {visibleBodies.map((id) => (
        <CelestialBody key={id} bodyId={id} position={positions[id]} />
      ))}
      {showOrbits && visibleBodies.map((id) => (
        orbitPaths[id] && orbitPaths[id].length > 1 ? (
          <OrbitLine key={`orbit-${id}`} bodyId={id} points={orbitPaths[id]} />
        ) : null
      ))}
      {showCones && hasCones && <AlignmentCones bestPerKind={bestPerKind!} visibleSeries={visibleSeries} />}
      <CameraController />
    </LabelRegistryProvider>
  )
}

export default memo(function SolarSystemScene({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  // Stable camera config -- useMemo ensures the object is only created once
  const cameraConfig = useMemo(() => ({
    position: [0, 300, 0] as [number, number, number],
    fov: 45,
    near: 0.1,
    far: 2000,
  }), [])

  return (
    <Canvas
      camera={cameraConfig}
      style={MAIN_CANVAS_STYLE}
    >
      <SceneContents positions={positions} orbitPaths={orbitPaths} visibleSeries={visibleSeries} bestPerKind={bestPerKind} />
    </Canvas>
  )
})
