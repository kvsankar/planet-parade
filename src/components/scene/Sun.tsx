import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BODY_META } from '../../constants'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { useSelection } from '../../hooks/useSelection'

const SUN_COLOR = BODY_META.Sun.color

export default function Sun() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const { camera } = useThree()
  const { showLabels } = useDisplaySettings()
  const { selectedBodyId, selectBody } = useSelection()

  useFrame(({ size }) => {
    if (!meshRef.current) return
    const dist = camera.position.length()
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const maxPixels = 30
    const radius = (maxPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    const clamped = Math.max(0.3, Math.min(radius, 5))
    meshRef.current.scale.setScalar(clamped)
  })

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
        <Html distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: SUN_COLOR,
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            transform: 'translateY(-20px)',
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
