import SkyView from '../alignment/SkyView'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { AlignmentKind } from '../../types'

interface SkyViewPanelProps {
  alignment: AlignmentState
  currentDate: Date
  visibleSeries: Set<AlignmentKind>
}

export default function SkyViewPanel({ alignment, currentDate, visibleSeries }: SkyViewPanelProps) {
  return (
    <SkyView
      bodies={alignment.selectedBodies}
      date={currentDate}
      center={alignment.skyCenter}
      onCenterChange={alignment.setSkyCenter}
      visibleSeries={visibleSeries}
    />
  )
}
