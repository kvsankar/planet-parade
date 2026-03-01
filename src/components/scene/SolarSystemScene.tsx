import { useState, useRef } from 'react'
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
const INNER_HIDE_DIST = 150 // scene units — hide inner planets when camera is farther than this

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
  visibleSeries?: Set<AlignmentKind>
  bestPerKind?: BestPerKind
}

function SceneContents({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  const { showOrbits, forceInner, showStars, showMilkyWay, showConstellations, showConstellationBoundaries, showCones } = useDisplaySettings()
  const [showInner, setShowInner] = useState(false) // default camera at 300 → hidden
  const showInnerRef = useRef(false)

  // Check if any active combo contains an inner planet
  const comboHasInner = bestPerKind != null && (['morning', 'evening', 'straddling'] as AlignmentKind[]).some(
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

  const visibleBodies = showInner
    ? BODY_LIST
    : BODY_LIST.filter((id) => !INNER_BODIES.has(id))

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

export default function SolarSystemScene({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  const [initialCameraY] = useState(() => {
    // Use a reasonable default — camera starts zoomed out
    return 300
  })

  return (
    <Canvas
      camera={{ position: [0, initialCameraY, 0], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: '#0a0a0f' }}
    >
      <SceneContents positions={positions} orbitPaths={orbitPaths} visibleSeries={visibleSeries} bestPerKind={bestPerKind} />
    </Canvas>
  )
}
