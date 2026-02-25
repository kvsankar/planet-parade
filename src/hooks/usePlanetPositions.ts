import { useMemo } from 'react'
import { CelestialBodyId } from '../types'
import { getAllPositions } from '../lib/astronomy'

export function usePlanetPositions(date: Date): Record<CelestialBodyId, [number, number, number]> {
  const dateMs = date.getTime()
  return useMemo(() => getAllPositions(new Date(dateMs)), [dateMs])
}
