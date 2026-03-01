import { useRef, useEffect, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSelection } from '../../hooks/useSelection'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getBodyPosition } from '../../lib/astronomy'
import { CelestialBodyId } from '../../types'

/** Shared camera angles — written by main scene, read by inset */
export const cameraAngles = { theta: 0, phi: Math.PI / 2 }

const _spherical = new THREE.Spherical()
const _offset = new THREE.Vector3()

export default memo(function CameraController() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const { selectedBodyId, followMode } = useSelection()
  const targetRef = useRef(new THREE.Vector3())
  const bodyPosRef = useRef(new THREE.Vector3())
  const isAnimating = useRef(false)
  const prevSelectedRef = useRef<CelestialBodyId | null>(null)

  useEffect(() => {
    if (selectedBodyId && selectedBodyId !== prevSelectedRef.current) {
      isAnimating.current = true
    }
    prevSelectedRef.current = selectedBodyId
  }, [selectedBodyId])

  useFrame(({ camera }) => {
    // Write camera angles for the inset to read
    const controls = controlsRef.current
    if (controls) {
      _offset.copy(camera.position).sub(controls.target)
      _spherical.setFromVector3(_offset)
      cameraAngles.theta = _spherical.theta
      cameraAngles.phi = _spherical.phi
    }

    if (!controls || !selectedBodyId) return

    const pos = getBodyPosition(selectedBodyId, simulationStore.date)
    const bodyPos = bodyPosRef.current.set(pos[0], pos[1], pos[2])

    if (followMode) {
      controls.target.copy(bodyPos)
      controls.update()
    } else if (isAnimating.current) {
      targetRef.current.copy(controls.target)
      targetRef.current.lerp(bodyPos, 0.08)
      controls.target.copy(targetRef.current)
      controls.update()

      if (targetRef.current.distanceTo(bodyPos) < 0.01) {
        isAnimating.current = false
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={1}
      maxDistance={1000}
    />
  )
})
