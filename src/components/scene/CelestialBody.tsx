import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { CelestialBodyId } from '../../types'
import { BODY_META } from '../../constants'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { useSelection } from '../../hooks/useSelection'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getBodyPosition } from '../../lib/astronomy'

interface Props {
  bodyId: CelestialBodyId
  position: [number, number, number] // initial/fallback from React state
}

export default function CelestialBody({ bodyId, position }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const { camera } = useThree()
  const { showLabels } = useDisplaySettings()
  const { selectedBodyId, selectBody } = useSelection()
  const meta = BODY_META[bodyId]

  // Store the live position for the label
  const livePosRef = useRef(new THREE.Vector3(...position))

  useFrame(({ size }) => {
    if (!meshRef.current) return

    // Compute position from the live date (every frame — smooth)
    const pos = getBodyPosition(bodyId, simulationStore.date)
    meshRef.current.position.set(pos[0], pos[1], pos[2])
    livePosRef.current.set(pos[0], pos[1], pos[2])

    // Dynamic sizing
    const dist = camera.position.distanceTo(livePosRef.current)
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const desiredPixels = selectedBodyId === bodyId ? 12 : 8
    const radius = (desiredPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    const clamped = Math.max(0.1, Math.min(radius, 3))
    meshRef.current.scale.setScalar(clamped)
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); selectBody(bodyId) }}
    >
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial color={meta.color} roughness={0.8} />
      {showLabels && (
        <Html distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: meta.color,
            fontSize: '11px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            transform: 'translateY(-18px)',
            fontWeight: selectedBodyId === bodyId ? 'bold' : 'normal',
            textShadow: '0 0 4px black',
          }}>
            {bodyId}
          </div>
        </Html>
      )}
    </mesh>
  )
}
