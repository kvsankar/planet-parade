import SkyView from '../alignment/SkyView'
import { AlignmentState } from '../../hooks/useAlignmentState'

interface SkyViewPanelProps {
  alignment: AlignmentState
  currentDate: Date
  isLandscape?: boolean
}

export default function SkyViewPanel({ alignment, currentDate, isLandscape }: SkyViewPanelProps) {
  return (
    <SkyView
      bodies={alignment.selectedBodies}
      date={currentDate}
      center={alignment.skyCenter}
      onCenterChange={alignment.setSkyCenter}
      visibleSeries={alignment.visibleSeries}
      bestPerKind={alignment.bestPerKind}
      isLandscape={isLandscape}
    />
  )
}
