import { createContext, useContext } from 'react'
import { DisplaySettings } from '../types'

export const DisplaySettingsContext = createContext<DisplaySettings>({
  showOrbits: true,
  showLabels: true,
  forceInner: false,
  toggleOrbits: () => {},
  toggleLabels: () => {},
  toggleForceInner: () => {},
})

export function useDisplaySettings() {
  return useContext(DisplaySettingsContext)
}
