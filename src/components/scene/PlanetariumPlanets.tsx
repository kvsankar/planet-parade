import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ObserverLocation } from '../../types'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getAltAz, SKY_BODIES, SkyBodyId } from '../../lib/astronomy'
import { altAzToSceneSphere, CELESTIAL_SPHERE_RADIUS } from '../../lib/coordinateConversion'
import { BODY_META } from '../../constants'

const PLANET_RADIUS = CELESTIAL_SPHERE_RADIUS * 0.98

const BODY_SIZE: Partial<Record<SkyBodyId, number>> = {
  Sun: 20,
  Moon: 14,
  Venus: 10,
  Jupiter: 10,
  Mars: 8,
  Saturn: 9,
  Mercury: 7,
  Uranus: 6,
  Neptune: 6,
}

interface Props {
  observer: ObserverLocation
  showLabels?: boolean
}

export default function PlanetariumPlanets({ observer, showLabels = true }: Props) {
  const meshRefs = useRef<Map<SkyBodyId, THREE.Mesh>>(new Map())
  const labelRefs = useRef<Map<SkyBodyId, HTMLDivElement>>(new Map())

  // Planet point materials
  const materials = useMemo(() => {
    const mats = new Map<SkyBodyId, THREE.MeshBasicMaterial>()
    for (const bodyId of SKY_BODIES) {
      const color = BODY_META[bodyId as keyof typeof BODY_META]?.color ?? '#ffffff'
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
      mats.set(bodyId, mat)
    }
    return mats
  }, [])

  useFrame(() => {
    const date = simulationStore.date
    for (const bodyId of SKY_BODIES) {
      const altAz = getAltAz(bodyId, date, observer)
      const pos = altAzToSceneSphere(altAz.altitude, altAz.azimuth, PLANET_RADIUS)

      const mesh = meshRefs.current.get(bodyId)
      if (mesh) {
        mesh.position.set(pos[0], pos[1], pos[2])
        const mat = materials.get(bodyId)
        if (mat) mat.opacity = altAz.altitude < 0 ? 0.25 : 1
      }

      const labelEl = labelRefs.current.get(bodyId)
      if (labelEl) {
        labelEl.style.opacity = altAz.altitude < 0 ? '0' : '1'
      }
    }
  })

  return (
    <group>
      {SKY_BODIES.map((bodyId) => {
        const size = BODY_SIZE[bodyId] ?? 5
        const mat = materials.get(bodyId)
        const labelColor = BODY_META[bodyId as keyof typeof BODY_META]?.color ?? '#ffffff'
        return (
          <mesh
            key={bodyId}
            material={mat}
            renderOrder={20}
            ref={(mesh) => {
              if (mesh) meshRefs.current.set(bodyId, mesh)
              else meshRefs.current.delete(bodyId)
            }}
          >
            <sphereGeometry args={[size, 16, 16]} />

            {showLabels && (
              <Html
                position={[0, size + 14, 0]}
                center
                style={{ pointerEvents: 'none' }}
                zIndexRange={[180, 0]}
              >
                <div
                  className="planetarium-star-label"
                  style={{ color: labelColor }}
                  ref={(el) => {
                    if (el) labelRefs.current.set(bodyId, el)
                    else labelRefs.current.delete(bodyId)
                  }}
                >
                  {bodyId}
                </div>
              </Html>
            )}
          </mesh>
        )
      })}
    </group>
  )
}
