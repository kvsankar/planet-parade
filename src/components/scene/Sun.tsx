import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BODY_META } from '../../constants'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { useSelection } from '../../hooks/useSelection'
import { useLabelRegistry, getLabelPriority } from '../../hooks/useLabelOverlap'

const SUN_COLOR = BODY_META.Sun.color
const MIN_FONT = 8
const MAX_FONT = 14
const NEAR_DIST = 5
const FAR_DIST = 500
const _projected = new THREE.Vector3()

export default function Sun({ scaleFactor = 1 }: { scaleFactor?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const labelRef = useRef<HTMLDivElement>(null!)
  const { camera } = useThree()
  const { showLabels } = useDisplaySettings()
  const { selectedBodyId, selectBody } = useSelection()
  const registry = useLabelRegistry()

  useFrame(({ size }) => {
    if (!meshRef.current) return
    const dist = camera.position.length()
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const maxPixels = 18
    const radius = (maxPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    // Mercury orbit ≈ 3.87 scene units — keep Sun well inside it
    const clamped = Math.max(0.2, Math.min(radius, 2.0)) * scaleFactor
    meshRef.current.scale.setScalar(clamped)

    // Dynamic label sizing
    if (labelRef.current) {
      const t = Math.log(dist / NEAR_DIST) / Math.log(FAR_DIST / NEAR_DIST)
      const clamped01 = Math.max(0, Math.min(1, t))
      const fontSize = MAX_FONT - clamped01 * (MAX_FONT - MIN_FONT)
      labelRef.current.style.fontSize = `${Math.round(fontSize)}px`

      // Label overlap avoidance
      _projected.set(0, 0, 0).project(camera)
      const roundedFont = Math.round(fontSize)
      registry.set(
        'Sun',
        (_projected.x * 0.5 + 0.5) * size.width,
        (-_projected.y * 0.5 + 0.5) * size.height,
        3, roundedFont,
        getLabelPriority('Sun', selectedBodyId === 'Sun'),
      )
      const offset = registry.getOffset('Sun')
      labelRef.current.style.transform = `translate(${offset.dx}px, ${offset.dy}px)`
    } else {
      registry.remove('Sun')
    }
  })

  useEffect(() => () => registry.remove('Sun'), [registry])

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); selectBody('Sun') }}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={SUN_COLOR} />
      <pointLight intensity={2} distance={0} decay={0} />
      {showLabels && (
        <Html style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{
            color: SUN_COLOR,
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            transform: 'translateY(-20px)', /* overridden per-frame by overlap avoidance */
            fontWeight: selectedBodyId === 'Sun' ? 'bold' : 'normal',
            textShadow: '0 0 4px black',
          }}>
            Sun
          </div>
        </Html>
      )}
    </mesh>
  )
}
