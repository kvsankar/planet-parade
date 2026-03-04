import { CelestialBodyId } from '../../types'
import { AU_TO_SCENE } from '../../constants'
import { getBodyPosition } from '../../lib/astronomy'

interface Props {
  selectedBodyId: CelestialBodyId | null
  currentDate: Date
}

export default function InfoDisplay({ selectedBodyId, currentDate }: Props) {
  if (!selectedBodyId) return null

  const pos: [number, number, number] = selectedBodyId === 'Sun'
    ? [0, 0, 0]
    : getBodyPosition(selectedBodyId, currentDate)

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
