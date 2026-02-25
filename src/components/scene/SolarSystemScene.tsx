import { useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import Sun from './Sun'
import CelestialBody from './CelestialBody'
import OrbitLine from './OrbitLine'
import AlignmentCones from './AlignmentCones'
import CameraController from './CameraController'
import { BODY_LIST } from '../../constants'
import { CelestialBodyId } from '../../types'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'

const INNER_BODIES: Set<CelestialBodyId> = new Set(['Mercury', 'Venus', 'Earth', 'Mars'])
const INNER_HIDE_DIST = 150 // scene units — hide inner planets when camera is farther than this

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
  selectedBodies?: CelestialBodyId[]
}

function SceneContents({ positions, orbitPaths, selectedBodies = [] }: Props) {
  const { showOrbits } = useDisplaySettings()
  const [showInner, setShowInner] = useState(false) // default camera at 300 → hidden
  const showInnerRef = useRef(false)

  useFrame(({ camera }) => {
    const dist = camera.position.length()
    const shouldShow = dist < INNER_HIDE_DIST
    if (shouldShow !== showInnerRef.current) {
      showInnerRef.current = shouldShow
      setShowInner(shouldShow)
    }
  })

  const visibleBodies = showInner
    ? BODY_LIST
    : BODY_LIST.filter((id) => !INNER_BODIES.has(id))

  return (
    <>
      <ambientLight intensity={0.15} />
      <Stars radius={500} depth={50} count={3000} factor={4} fade speed={0} />
      <Sun />
      {visibleBodies.map((id) => (
        <CelestialBody key={id} bodyId={id} position={positions[id]} />
      ))}
      {showOrbits && visibleBodies.map((id) => (
        orbitPaths[id] && orbitPaths[id].length > 1 ? (
          <OrbitLine key={`orbit-${id}`} bodyId={id} points={orbitPaths[id]} />
        ) : null
      ))}
      {selectedBodies.length > 0 && <AlignmentCones selectedBodies={selectedBodies} />}
      <CameraController />
    </>
  )
}

export default function SolarSystemScene({ positions, orbitPaths, selectedBodies }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 300, 0], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: '#0a0a0f' }}
    >
      <SceneContents positions={positions} orbitPaths={orbitPaths} selectedBodies={selectedBodies} />
    </Canvas>
  )
}
