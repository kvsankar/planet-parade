import SkyView from '../alignment/SkyView'
import { AlignmentState } from '../../hooks/useAlignmentState'

interface SkyViewPanelProps {
  alignment: AlignmentState
  currentDate: Date
}

export default function SkyViewPanel({ alignment, currentDate }: SkyViewPanelProps) {
  return (
    <SkyView
      bodies={alignment.selectedBodies}
      date={currentDate}
      center={alignment.skyCenter}
      onCenterChange={alignment.setSkyCenter}
    />
  )
}
