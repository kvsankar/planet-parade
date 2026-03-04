import { describe, expect, it } from 'vitest'
import { getTimeZoneDayKey, getTimeZoneDayRange } from '../timeZoneDay'

describe('timeZoneDay', () => {
  it('falls back to UTC day key when no timezone is provided', () => {
    const date = new Date('2026-03-04T23:15:00.000Z')
    expect(getTimeZoneDayKey(date)).toBe('2026-03-04')
  })

  it('computes local day key for a timezone west of UTC', () => {
    const date = new Date('2026-03-04T01:00:00.000Z')
    expect(getTimeZoneDayKey(date, 'America/Los_Angeles')).toBe('2026-03-03')
  })

  it('returns a day range that contains the source instant', () => {
    const date = new Date('2026-03-04T12:34:56.000Z')
    const range = getTimeZoneDayRange(date, 'Asia/Kolkata')
    expect(range.dayKey).toBe('2026-03-04')
    expect(date.getTime()).toBeGreaterThanOrEqual(range.startMs)
    expect(date.getTime()).toBeLessThan(range.endMs)
  })

  it('handles DST-shifted day lengths for local ranges', () => {
    const date = new Date('2026-03-08T18:00:00.000Z') // US spring-forward day
    const range = getTimeZoneDayRange(date, 'America/Los_Angeles')
    const hours = (range.endMs - range.startMs) / 3_600_000
    expect(hours).toBeGreaterThan(22)
    expect(hours).toBeLessThan(26)
  })
})

