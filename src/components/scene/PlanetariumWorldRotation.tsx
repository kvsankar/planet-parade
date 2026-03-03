import { useRef, ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as Astronomy from 'astronomy-engine'
import { ObserverLocation } from '../../types'
import { simulationStore } from '../../hooks/useSimulationStore'

/**
 * Rotates the ecliptic-scene celestial sphere to horizon-scene coordinates.
 *
 * Existing components (RealStars, MilkyWaySphere, etc.) place objects using
 * raDecToSceneSphere which applies: EQJ → ecliptic → scene-axes.
 * We compose: M_group = M_sceneFromHOR × M_EQJ_HOR × (M_sceneFromEQJ)^{-1}
 * so that child positions end up in horizon-scene space.
 */

// Pre-compute the fixed EQJ → scene transform and its inverse.
// raDecToSceneSphere does: EQJ → ecliptic (23.44° rotation about X) → scene axes (eclX→X, eclZ→Y, -eclY→Z)
const OBL = 23.4392911 * Math.PI / 180
const cosO = Math.cos(OBL)
const sinO = Math.sin(OBL)

// M_eclFromEQJ: rotation about X by OBL
// [1,     0,     0   ]
// [0,  cosO,  sinO   ]
// [0, -sinO,  cosO   ]
//
// M_sceneFromEcl: remaps axes (eclX→X, eclZ→Y, -eclY→Z)
// [1,  0,  0]
// [0,  0,  1]
// [0, -1,  0]
//
// M_sceneFromEQJ = M_sceneFromEcl × M_eclFromEQJ
// Row 0: [1,    0,     0   ]
// Row 1: [0, -sinO,  cosO  ]
// Row 2: [0, -cosO, -sinO  ]
const M_sceneFromEQJ = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, -sinO, cosO, 0,
  0, -cosO, -sinO, 0,
  0, 0, 0, 1,
)
const M_sceneFromEQJ_inv = M_sceneFromEQJ.clone().invert()

// M_sceneFromHOR: HOR (astronomy-engine) has x=north, y=west, z=zenith
// scene has zenith=+Y, north=-Z, east=+X
// So: HOR.x(N) → scene -Z, HOR.y(W) → scene -X, HOR.z(up) → scene +Y
// [0, -1,  0]
// [0,  0,  1]
// [-1, 0,  0]
const M_sceneFromHOR = new THREE.Matrix4().set(
  0, -1, 0, 0,
  0, 0, 1, 0,
  -1, 0, 0, 0,
  0, 0, 0, 1,
)

interface Props {
  observer: ObserverLocation
  children: ReactNode
}

export default function PlanetariumWorldRotation({ observer, children }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const obsRef = useRef(new Astronomy.Observer(observer.lat, observer.lon, observer.height))

  // Update observer if it changes
  if (
    obsRef.current.latitude !== observer.lat ||
    obsRef.current.longitude !== observer.lon ||
    obsRef.current.height !== observer.height
  ) {
    obsRef.current = new Astronomy.Observer(observer.lat, observer.lon, observer.height)
  }

  useFrame(() => {
    if (!groupRef.current) return

    const date = simulationStore.date
    const astroTime = Astronomy.MakeTime(date)
    const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obsRef.current)

    // astronomy-engine stores RotationMatrix as rot[col][row], so transpose to row-major here.
    const M_HOR_from_EQJ = new THREE.Matrix4().set(
      rot.rot[0][0], rot.rot[1][0], rot.rot[2][0], 0,
      rot.rot[0][1], rot.rot[1][1], rot.rot[2][1], 0,
      rot.rot[0][2], rot.rot[1][2], rot.rot[2][2], 0,
      0, 0, 0, 1,
    )

    // M_group = M_sceneFromHOR × M_HOR_from_EQJ × M_sceneFromEQJ^{-1}
    const M = M_sceneFromHOR.clone()
      .multiply(M_HOR_from_EQJ)
      .multiply(M_sceneFromEQJ_inv)

    groupRef.current.matrix.copy(M)
    groupRef.current.matrixWorldNeedsUpdate = true
  })

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {children}
    </group>
  )
}
