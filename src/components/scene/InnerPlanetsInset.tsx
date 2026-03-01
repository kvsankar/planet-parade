import { memo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Sun from './Sun'
import CelestialBody from './CelestialBody'
import OrbitLine from './OrbitLine'
import AlignmentCones from './AlignmentCones'
import { cameraAngles } from './CameraController'
import { CelestialBodyId, AlignmentKind } from '../../types'
import { useDisplaySettings } from '../../hooks/useDisplaySettings'
import { LabelRegistryProvider } from '../../hooks/useLabelOverlap'
import { BestPerKind } from '../../lib/alignment'

const INNER_BODIES: CelestialBodyId[] = ['Mercury', 'Venus', 'Earth', 'Mars']
const INSET_DIST = 45 // fixed camera distance

const _spherical = new THREE.Spherical()

// Stable props for Canvas to avoid re-creating objects every render
const INSET_CAMERA = { position: [0, 45, 0] as [number, number, number], fov: 45, near: 0.1, far: 200 }
const INSET_STYLE = { background: 'rgba(5, 5, 15, 0.85)' }

interface Props {
  positions: Record<CelestialBodyId, [number, number, number]>
  orbitPaths: Record<CelestialBodyId, [number, number, number][]>
  visibleSeries?: Set<AlignmentKind>
  bestPerKind?: BestPerKind
}

/** Syncs inset camera angles from the main scene's CameraController */
const InsetCameraSync = memo(function InsetCameraSync() {
  const { camera } = useThree()

  useFrame(() => {
    _spherical.set(INSET_DIST, cameraAngles.phi, cameraAngles.theta)
    camera.position.setFromSpherical(_spherical)
    camera.lookAt(0, 0, 0)
  })

  return null
})

function InsetContents({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  const { showOrbits, showCones } = useDisplaySettings()

  const hasCones = bestPerKind && (bestPerKind.morning || bestPerKind.evening || bestPerKind.straddling)

  return (
    <LabelRegistryProvider>
      <ambientLight intensity={0.15} />
      <InsetCameraSync />
      <Sun scaleFactor={0.7} />
      {INNER_BODIES.map((id) => (
        <CelestialBody key={id} bodyId={id} position={positions[id]} scaleFactor={0.7} />
      ))}
      {showOrbits && INNER_BODIES.map((id) => (
        orbitPaths[id] && orbitPaths[id].length > 1 ? (
          <OrbitLine key={`orbit-${id}`} bodyId={id} points={orbitPaths[id]} />
        ) : null
      ))}
      {showCones && hasCones && <AlignmentCones bestPerKind={bestPerKind!} visibleSeries={visibleSeries} />}
    </LabelRegistryProvider>
  )
}

export default memo(function InnerPlanetsInset({ positions, orbitPaths, visibleSeries, bestPerKind }: Props) {
  return (
    <div className="inner-planets-inset">
      <Canvas
        camera={INSET_CAMERA}
        style={INSET_STYLE}
      >
        <InsetContents positions={positions} orbitPaths={orbitPaths} visibleSeries={visibleSeries} bestPerKind={bestPerKind} />
      </Canvas>
    </div>
  )
})
