import { createContext, useContext } from 'react'
import { SimulationTime } from '../types'

export const SimulationTimeContext = createContext<SimulationTime>({
  currentDate: new Date(),
  isPlaying: false,
  speed: 10,
  setDate: () => {},
  togglePlay: () => {},
  setSpeed: () => {},
})

export function useSimulationTime() {
  return useContext(SimulationTimeContext)
}
