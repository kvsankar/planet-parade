import SkyView from '../alignment/SkyView'
import { AlignmentState } from '../../hooks/useAlignmentState'
import { AlignmentKind } from '../../types'

interface SkyViewPanelProps {
  alignment: AlignmentState
  currentDate: Date
  visibleSeries: Set<AlignmentKind>
  isLandscape?: boolean
}

export default function SkyViewPanel({ alignment, currentDate, visibleSeries, isLandscape }: SkyViewPanelProps) {
  return (
    <SkyView
      bodies={alignment.selectedBodies}
      date={currentDate}
      center={alignment.skyCenter}
      onCenterChange={alignment.setSkyCenter}
      visibleSeries={visibleSeries}
      isLandscape={isLandscape}
    />
  )
}
