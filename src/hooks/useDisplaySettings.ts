import { createContext, useContext } from 'react'
import { DisplaySettings } from '../types'

export const DisplaySettingsContext = createContext<DisplaySettings>({
  showOrbits: true,
  showLabels: true,
  forceInner: false,
  showStars: true,
  showMilkyWay: true,
  showConstellations: true,
  showConstellationBoundaries: false,
  showCones: true,
  showPPIOverlay: true,
  toggleOrbits: () => {},
  toggleLabels: () => {},
  toggleForceInner: () => {},
  toggleStars: () => {},
  toggleMilkyWay: () => {},
  toggleConstellations: () => {},
  toggleConstellationBoundaries: () => {},
  toggleCones: () => {},
  togglePPIOverlay: () => {},
})

export function useDisplaySettings() {
  return useContext(DisplaySettingsContext)
}
