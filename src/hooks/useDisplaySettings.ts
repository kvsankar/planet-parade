import { createContext, useContext } from 'react'
import { DisplaySettings } from '../types'

export const DisplaySettingsContext = createContext<DisplaySettings>({
  showOrbits: true,
  showLabels: true,
  toggleOrbits: () => {},
  toggleLabels: () => {},
})

export function useDisplaySettings() {
  return useContext(DisplaySettingsContext)
}
