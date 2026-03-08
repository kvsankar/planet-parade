import type { SkyBrightnessLevel } from '../types'

export const SKY_BRIGHTNESS_LEVELS: SkyBrightnessLevel[] = ['low', 'med', 'high']

export const SKY_BRIGHTNESS_LABELS: Record<SkyBrightnessLevel, string> = {
  low: 'Low',
  med: 'Med',
  high: 'High',
}

export const SKY_STAR_BRIGHTNESS_FACTOR: Record<SkyBrightnessLevel, number> = {
  // Keep existing behavior as "Low".
  low: 1,
  med: 1.35,
  high: 1.75,
}

export const SKY_CONSTELLATION_EDGE_BRIGHTNESS_FACTOR: Record<SkyBrightnessLevel, number> = {
  // Keep existing behavior as "Low".
  low: 1,
  med: 1.45,
  high: 1.9,
}
