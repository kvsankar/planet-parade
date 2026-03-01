import { useRef, useEffect, useMemo, useCallback, memo } from 'react'
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

// Shared geometry — all planets use the same unit sphere
const sharedSphereGeo = new THREE.SphereGeometry(1, 24, 24)

// Pre-built materials per body (one per color, reused across mounts)
const bodyMaterials: Partial<Record<CelestialBodyId, THREE.MeshStandardMaterial>> = {}
function getBodyMaterial(bodyId: CelestialBodyId): THREE.MeshStandardMaterial {
  let mat = bodyMaterials[bodyId]
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color: BODY_META[bodyId].color, roughness: 0.8 })
    bodyMaterials[bodyId] = mat
  }
  return mat
}

const HTML_STYLE = { pointerEvents: 'none' as const }

interface Props {
  bodyId: CelestialBodyId
  position: [number, number, number] // initial/fallback from React state
  scaleFactor?: number
}

export default memo(function CelestialBody({ bodyId, position, scaleFactor = 1 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const labelRef = useRef<HTMLDivElement>(null!)
  const { camera } = useThree()
  const { showLabels } = useDisplaySettings()
  const { selectedBodyId, selectBody } = useSelection()
  const registry = useLabelRegistry()
  const meta = BODY_META[bodyId]

  // Stable material reference
  const material = useMemo(() => getBodyMaterial(bodyId), [bodyId])

  // Store the live position for the label
  const livePosRef = useRef(new THREE.Vector3(...position))

  // Cache selected state in ref so useFrame doesn't depend on React re-renders
  const selectedRef = useRef(selectedBodyId === bodyId)
  selectedRef.current = selectedBodyId === bodyId

  // Stable click handler
  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    selectBody(bodyId)
  }, [bodyId, selectBody])

  // Stable label style — font weight is updated imperatively in useFrame
  const labelStyle = useMemo(() => ({
    color: meta.color,
    fontSize: '11px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
    transform: 'translateY(-18px)', /* overridden per-frame by overlap avoidance */
    textShadow: '0 0 4px black',
  }), [meta.color])

  useFrame(({ size }) => {
    if (!meshRef.current) return

    // Compute position from the live date (every frame -- smooth)
    const pos = getBodyPosition(bodyId, simulationStore.date)
    meshRef.current.position.set(pos[0], pos[1], pos[2])
    livePosRef.current.set(pos[0], pos[1], pos[2])

    // Dynamic body sizing
    const dist = camera.position.distanceTo(livePosRef.current)
    const vFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const desiredPixels = selectedRef.current ? 12 : 8
    const radius = (desiredPixels / size.height) * dist * Math.tan(vFov / 2) * 2
    const clamped = Math.max(0.1, Math.min(radius, 3)) * scaleFactor
    meshRef.current.scale.setScalar(clamped)

    // Dynamic label sizing: closer = larger, farther = smaller (log scale)
    if (labelRef.current) {
      const t = Math.log(dist / NEAR_DIST) / Math.log(FAR_DIST / NEAR_DIST)
      const clamped01 = Math.max(0, Math.min(1, t))
      const fontSize = MAX_FONT - clamped01 * (MAX_FONT - MIN_FONT)
      labelRef.current.style.fontSize = `${Math.round(fontSize)}px`

      // Update font weight imperatively instead of through React re-render
      labelRef.current.style.fontWeight = selectedRef.current ? 'bold' : 'normal'

      // Label overlap avoidance
      _projected.copy(livePosRef.current).project(camera)
      const roundedFont = Math.round(fontSize)
      registry.set(
        bodyId,
        (_projected.x * 0.5 + 0.5) * size.width,
        (-_projected.y * 0.5 + 0.5) * size.height,
        bodyId.length, roundedFont,
        getLabelPriority(bodyId, selectedRef.current),
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
      onClick={handleClick}
      geometry={sharedSphereGeo}
      material={material}
    >
      {showLabels && (
        <Html style={HTML_STYLE}>
          <div ref={labelRef} style={labelStyle}>
            {bodyId}
          </div>
        </Html>
      )}
    </mesh>
  )
}, (prev, next) => {
  // Custom comparison: only re-render when bodyId, scaleFactor, or showLabels-affecting props change.
  // Position changes are handled imperatively in useFrame, so we skip position comparison.
  return prev.bodyId === next.bodyId && prev.scaleFactor === next.scaleFactor
})
