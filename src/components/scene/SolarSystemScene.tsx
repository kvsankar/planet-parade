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

const INNER_BODIES: Set<CelestialBodyId> = new Set(['Mercury', 'Venus', 'Mars'])
const INNER_HIDE_DIST = 150 // scene units — hide inner planets when camera is farther than this

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
  selectedBodies?: CelestialBodyId[]
  visibleSeries?: Set<AlignmentKind>
}

function SceneContents({ positions, orbitPaths, selectedBodies = [], visibleSeries }: Props) {
  const { showOrbits, forceInner, showStars, showMilkyWay, showConstellations, showConstellationBoundaries, showCones } = useDisplaySettings()
  const [showInner, setShowInner] = useState(false) // default camera at 300 → hidden
  const showInnerRef = useRef(false)

  useFrame(({ camera }) => {
    const dist = camera.position.length()
    const shouldShow = forceInner || dist < INNER_HIDE_DIST
    if (shouldShow !== showInnerRef.current) {
      showInnerRef.current = shouldShow
      setShowInner(shouldShow)
    }
  })

  const visibleBodies = showInner
    ? BODY_LIST
    : BODY_LIST.filter((id) => !INNER_BODIES.has(id))

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
      {showCones && selectedBodies.length > 0 && <AlignmentCones selectedBodies={selectedBodies} visibleSeries={visibleSeries} />}
      <CameraController />
    </LabelRegistryProvider>
  )
}

export default function SolarSystemScene({ positions, orbitPaths, selectedBodies, visibleSeries }: Props) {
  const [initialCameraY] = useState(() => {
    const HALF_FOV = (45 / 2) * Math.PI / 180
    let maxDist = 0
    for (const id of (selectedBodies ?? [])) {
      const pos = positions[id]
      if (pos) {
        maxDist = Math.max(maxDist, Math.sqrt(pos[0] ** 2 + pos[2] ** 2))
      }
    }
    return Math.min(1000, Math.max(50, maxDist * 1.3 / Math.tan(HALF_FOV)))
  })

  return (
    <Canvas
      camera={{ position: [0, initialCameraY, 0], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: '#0a0a0f' }}
    >
      <SceneContents positions={positions} orbitPaths={orbitPaths} selectedBodies={selectedBodies} visibleSeries={visibleSeries} />
    </Canvas>
  )
}
