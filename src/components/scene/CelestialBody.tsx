import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { CelestialBodyId } from '../../types'
import { BODY_META } from '../../constants'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { useSelection } from '../../hooks/useSelection'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getBodyPosition } from '../../lib/astronomy'
import { useLabelRegistry, getLabelPriority } from '../../hooks/useLabelOverlap'

const MIN_FONT = 8
const MAX_FONT = 14
// Camera distances that map to the font range (log scale)
const NEAR_DIST = 5
const FAR_DIST = 500
const _projected = new THREE.Vector3()

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
  const registry = useLabelRegistry()
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
      const fontSize = MAX_FONT - clamped01 * (MAX_FONT - MIN_FONT)
      labelRef.current.style.fontSize = `${Math.round(fontSize)}px`

      // Label overlap avoidance
      _projected.copy(livePosRef.current).project(camera)
      const roundedFont = Math.round(fontSize)
      registry.set(
        bodyId,
        (_projected.x * 0.5 + 0.5) * size.width,
        (-_projected.y * 0.5 + 0.5) * size.height,
        bodyId.length, roundedFont,
        getLabelPriority(bodyId, selectedBodyId === bodyId),
      )
      const offset = registry.getOffset(bodyId)
      labelRef.current.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`
    } else {
      registry.remove(bodyId)
    }
  })

  useEffect(() => () => registry.remove(bodyId), [bodyId, registry])

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
            transform: 'translateY(-18px)', /* overridden per-frame by overlap avoidance */
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
