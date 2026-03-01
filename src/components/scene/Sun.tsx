import { useRef, useEffect, useMemo, useCallback, memo } from 'react'
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

// Shared geometry and material
const sunGeo = new THREE.SphereGeometry(1, 32, 32)
const sunMat = new THREE.MeshBasicMaterial({ color: SUN_COLOR })

const SUN_POS: [number, number, number] = [0, 0, 0]
const HTML_STYLE = { pointerEvents: 'none' as const }

export default memo(function Sun({ scaleFactor = 1 }: { scaleFactor?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const labelRef = useRef<HTMLDivElement>(null!)
  const { camera } = useThree()
  const { showLabels } = useDisplaySettings()
  const { selectedBodyId, selectBody } = useSelection()
  const registry = useLabelRegistry()

  const selectedRef = useRef(selectedBodyId === 'Sun')
  selectedRef.current = selectedBodyId === 'Sun'

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    selectBody('Sun')
  }, [selectBody])

  const labelStyle = useMemo(() => ({
    color: SUN_COLOR,
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
    transform: 'translateY(-20px)', /* overridden per-frame by overlap avoidance */
    textShadow: '0 0 4px black',
  }), [])

  useFrame(({ size }) => {
    if (!meshRef.current) return
    const dist = camera.position.length()
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const maxPixels = 18
    const radius = (maxPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    // Mercury orbit ~ 3.87 scene units -- keep Sun well inside it
    const clamped = Math.max(0.2, Math.min(radius, 2.0)) * scaleFactor
    meshRef.current.scale.setScalar(clamped)

    // Dynamic label sizing
    if (labelRef.current) {
      const t = Math.log(dist / NEAR_DIST) / Math.log(FAR_DIST / NEAR_DIST)
      const clamped01 = Math.max(0, Math.min(1, t))
      const fontSize = MAX_FONT - clamped01 * (MAX_FONT - MIN_FONT)
      labelRef.current.style.fontSize = `${Math.round(fontSize)}px`

      // Update font weight imperatively
      labelRef.current.style.fontWeight = selectedRef.current ? 'bold' : 'normal'

      // Label overlap avoidance
      _projected.set(0, 0, 0).project(camera)
      const roundedFont = Math.round(fontSize)
      registry.set(
        'Sun',
        (_projected.x * 0.5 + 0.5) * size.width,
        (-_projected.y * 0.5 + 0.5) * size.height,
        3, roundedFont,
        getLabelPriority('Sun', selectedRef.current),
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
      position={SUN_POS}
      onClick={handleClick}
      geometry={sunGeo}
      material={sunMat}
    >
      <pointLight intensity={2} distance={0} decay={0} />
      {showLabels && (
        <Html style={HTML_STYLE}>
          <div ref={labelRef} style={labelStyle}>
            Sun
          </div>
        </Html>
      )}
    </mesh>
  )
})
