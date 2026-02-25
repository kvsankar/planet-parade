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

const MIN_FONT = 8
const MAX_FONT = 14
// Camera distances that map to the font range (log scale)
const NEAR_DIST = 5
const FAR_DIST = 500

interface Props {
  bodyId: CelestialBodyId
  position: [number, number, number] // initial/fallback from React state
  scaleFactor?: number
}

export default function CelestialBody({ bodyId, position, scaleFactor = 1 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const labelRef = useRef<HTMLDivElement>(null!)
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

    // Dynamic body sizing
    const dist = camera.position.distanceTo(livePosRef.current)
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const desiredPixels = selectedBodyId === bodyId ? 12 : 8
    const radius = (desiredPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    const clamped = Math.max(0.1, Math.min(radius, 3)) * scaleFactor
    meshRef.current.scale.setScalar(clamped)

    // Dynamic label sizing: closer = larger, farther = smaller (log scale)
    if (labelRef.current) {
      const t = Math.log(dist / NEAR_DIST) / Math.log(FAR_DIST / NEAR_DIST)
      const clamped01 = Math.max(0, Math.min(1, t))
      // Invert: close → big, far → small
      const fontSize = MAX_FONT - clamped01 * (MAX_FONT - MIN_FONT)
      labelRef.current.style.fontSize = `${Math.round(fontSize)}px`
    }
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
        <Html style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{
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
