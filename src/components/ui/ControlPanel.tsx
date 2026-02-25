import TimeControls from './TimeControls'
import DisplayToggles from './DisplayToggles'
import BodySelector from './BodySelector'
import InfoDisplay from './InfoDisplay'
import { CelestialBodyId } from '../../types'

interface Props {
  selectedBodyId: CelestialBodyId | null
  positions: Record<CelestialBodyId, [number, number, number]>
}

export default function ControlPanel({ selectedBodyId, positions }: Props) {
  return (
    <div className="control-panel">
      <h2 className="panel-title">Solar System</h2>
      <InfoDisplay selectedBodyId={selectedBodyId} positions={positions} />
      <TimeControls />
      <DisplayToggles />
      <BodySelector />
    </div>
  )
}
