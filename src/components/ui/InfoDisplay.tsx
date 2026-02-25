import { CelestialBodyId } from '../../types'
import { AU_TO_SCENE } from '../../constants'

interface Props {
  selectedBodyId: CelestialBodyId | null
  positions: Record<CelestialBodyId, [number, number, number]>
}

export default function InfoDisplay({ selectedBodyId, positions }: Props) {
  if (!selectedBodyId) return null

  const pos = positions[selectedBodyId]
  if (!pos) return null

  const distScene = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2)
  const distAU = distScene / AU_TO_SCENE

  return (
    <div className="info-display">
      <span className="info-name">{selectedBodyId}</span>
      {selectedBodyId !== 'Sun' && (
        <span className="info-dist">{distAU.toFixed(3)} AU from Sun</span>
      )}
    </div>
  )
}
