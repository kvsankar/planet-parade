import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import Sun from './Sun'
import CelestialBody from './CelestialBody'
import OrbitLine from './OrbitLine'
import CameraController from './CameraController'
import { BODY_LIST } from '../../constants'
import { CelestialBodyId } from '../../types'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
}

function SceneContents({ positions, orbitPaths }: Props) {
  const { showOrbits } = useDisplaySettings()

  return (
    <>
      <ambientLight intensity={0.15} />
      <Stars radius={500} depth={50} count={3000} factor={4} fade speed={0} />
      <Sun />
      {BODY_LIST.map((id) => (
        <CelestialBody key={id} bodyId={id} position={positions[id]} />
      ))}
      {showOrbits && BODY_LIST.map((id) => (
        orbitPaths[id] && orbitPaths[id].length > 1 ? (
          <OrbitLine key={`orbit-${id}`} bodyId={id} points={orbitPaths[id]} />
        ) : null
      ))}
      <CameraController />
    </>
  )
}

export default function SolarSystemScene({ positions, orbitPaths }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 300, 0], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: '#0a0a0f' }}
    >
      <SceneContents positions={positions} orbitPaths={orbitPaths} />
    </Canvas>
  )
}
