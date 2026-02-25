import { Line } from '@react-three/drei'
import { BODY_META } from '../../constants'
import { CelestialBodyId } from '../../types'

interface Props {
  bodyId: CelestialBodyId
  points: [number, number, number][]
}

export default function OrbitLine({ bodyId, points }: Props) {
  if (points.length < 2) return null
  const color = BODY_META[bodyId].color

  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
      transparent
      opacity={0.4}
    />
  )
}
