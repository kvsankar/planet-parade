import { describe, expect, it } from 'vitest'
import {
  makeDefaultObserverLocationState,
  normalizeLongitudeDeg,
  parseObserverLocationState,
  sanitizeObserverLocation,
  sanitizeObserverLocationState,
  serializeObserverLocationState,
} from '../observerLocation'

describe('normalizeLongitudeDeg', () => {
  it('wraps longitudes into [-180, 180)', () => {
    expect(normalizeLongitudeDeg(0)).toBe(0)
    expect(normalizeLongitudeDeg(190)).toBe(-170)
    expect(normalizeLongitudeDeg(-190)).toBe(170)
    expect(normalizeLongitudeDeg(540)).toBe(-180)
  })
})

describe('sanitizeObserverLocation', () => {
  it('clamps latitude and height and wraps longitude', () => {
    expect(sanitizeObserverLocation({ lat: 95, lon: 200, height: 20_000 })).toEqual({
      lat: 90,
      lon: -160,
      height: 12_000,
    })
    expect(sanitizeObserverLocation({ lat: -95, lon: -200, height: -900 })).toEqual({
      lat: -90,
      lon: 160,
      height: -500,
    })
  })
})

describe('parse/serialize observer location state', () => {
  it('returns null for invalid json', () => {
    expect(parseObserverLocationState('not json')).toBeNull()
  })

  it('sanitizes partially invalid state', () => {
    const parsed = parseObserverLocationState(JSON.stringify({
      observer: { lat: 91, lon: 361, height: 0 },
      source: 'bad',
      accuracyM: -5,
      label: '  ',
      updatedAt: -1,
    }))

    expect(parsed).not.toBeNull()
    expect(parsed?.observer.lat).toBe(90)
    expect(parsed?.observer.lon).toBe(1)
    expect(parsed?.source).toBe('default')
    expect(parsed?.accuracyM).toBeNull()
    expect(parsed?.timeZone).toBeNull()
    expect(parsed?.label).toBeNull()
    expect(typeof parsed?.updatedAt).toBe('number')
  })

  it('round-trips valid state', () => {
    const base = sanitizeObserverLocationState({
      observer: { lat: 37.7749, lon: -122.4194, height: 16 },
      source: 'manual',
      accuracyM: null,
      timeZone: 'America/Los_Angeles',
      label: 'San Francisco',
      updatedAt: 1_700_000_000_000,
    })
    const encoded = serializeObserverLocationState(base)
    const decoded = parseObserverLocationState(encoded)
    expect(decoded).toEqual(base)
  })

  it('provides a default state object', () => {
    const state = makeDefaultObserverLocationState()
    expect(state.source).toBe('default')
    expect(state.observer).toEqual({ lat: 0, lon: 0, height: 0 })
    expect(state.timeZone).toBeNull()
  })
})
