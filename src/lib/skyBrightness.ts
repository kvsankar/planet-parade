import type { SkyBrightnessLevel } from '../types'

export const SKY_BRIGHTNESS_LEVELS: SkyBrightnessLevel[] = ['low', 'med', 'high']

export const SKY_BRIGHTNESS_LABELS: Record<SkyBrightnessLevel, string> = {
  low: 'Low',
  med: 'Med',
  high: 'High',
}

export const SKY_STAR_BRIGHTNESS_FACTOR: Record<SkyBrightnessLevel, number> = {
  low: 1,
  med: 1.32,
  high: 1.7,
}

/**
 * Relative bright-vs-faint size spread by preset.
 * 1.0 = baseline atlas-like spread from magnitude curves.
 */
export const SKY_STAR_MAGNITUDE_SPREAD_FACTOR: Record<SkyBrightnessLevel, number> = {
  low: 1.0,
  med: 1.28,
  high: 1.55,
}

export const SKY_CONSTELLATION_EDGE_BRIGHTNESS_FACTOR: Record<SkyBrightnessLevel, number> = {
  low: 1,
  med: 1.45,
  high: 1.9,
}
