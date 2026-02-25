import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSelection } from '../../hooks/useSelection'
import { simulationStore } from '../../hooks/useSimulationStore'
import { getBodyPosition } from '../../lib/astronomy'
import { CelestialBodyId } from '../../types'

export default function CameraController() {
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

  useFrame(() => {
    if (!controlsRef.current || !selectedBodyId) return

    const pos = getBodyPosition(selectedBodyId, simulationStore.date)
    const bodyPos = bodyPosRef.current.set(pos[0], pos[1], pos[2])

    if (followMode) {
      controlsRef.current.target.copy(bodyPos)
      controlsRef.current.update()
    } else if (isAnimating.current) {
      targetRef.current.copy(controlsRef.current.target)
      targetRef.current.lerp(bodyPos, 0.08)
      controlsRef.current.target.copy(targetRef.current)
      controlsRef.current.update()

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
}
