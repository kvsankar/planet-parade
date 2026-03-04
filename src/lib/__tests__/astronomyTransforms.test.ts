import { describe, expect, it } from 'vitest'
import * as Astronomy from 'astronomy-engine'
import { STAR_CATALOG } from '../../data/starCatalog'
import type { ObserverLocation } from '../../types'
import {
  getEclipticAltAzPositionsFromContext,
  getStarAltAzPositionsFromContext,
  prepareSkyProjectionContext,
  sunHorizonLongitude,
  sunHorizonLongitudes,
} from '../astronomy'

const DEG_TO_RAD = Math.PI / 180

function makeReferenceStarAltAz(date: Date, observer: ObserverLocation, starIndex: number) {
  const star = STAR_CATALOG[starIndex]
  const astroTime = Astronomy.MakeTime(date)
  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.height)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)

  const raRad = star.ra * 15 * DEG_TO_RAD
  const decRad = star.dec * DEG_TO_RAD
  const cosDec = Math.cos(decRad)
  const vec = new Astronomy.Vector(
    cosDec * Math.cos(raRad),
    cosDec * Math.sin(raRad),
    Math.sin(decRad),
    astroTime,
  )
  const horVec = Astronomy.RotateVector(rot, vec)
  const sphere = Astronomy.HorizonFromVector(horVec, 'normal')
  return { altitude: sphere.lat, azimuth: sphere.lon }
}

function makeReferenceEclipticAltAz(date: Date, observer: ObserverLocation, lonDeg: number) {
  const astroTime = Astronomy.MakeTime(date)
  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.height)
  const rot = Astronomy.Rotation_EQJ_HOR(astroTime, obs)

  const obliquityRad = 23.4393 * DEG_TO_RAD
  const cosObl = Math.cos(obliquityRad)
  const sinObl = Math.sin(obliquityRad)
  const lon = lonDeg * DEG_TO_RAD
  const cosLon = Math.cos(lon)
  const sinLon = Math.sin(lon)
  const vec = new Astronomy.Vector(cosLon, sinLon * cosObl, sinLon * sinObl, astroTime)
  const horVec = Astronomy.RotateVector(rot, vec)
  const sphere = Astronomy.HorizonFromVector(horVec, 'normal')
  return { altitude: sphere.lat, azimuth: sphere.lon }
}

describe('astronomy transform fast path', () => {
  const observer: ObserverLocation = { lat: 37.7749, lon: -122.4194, height: 16 }
  const date = new Date('2026-03-04T12:34:56.000Z')

  it('matches star alt/az against astronomy-engine reference transform', () => {
    const context = prepareSkyProjectionContext(date, observer)
    const stars = getStarAltAzPositionsFromContext(context)
    const sampleIndices = [0, 5, 11, 22, 48, 77, 103, 141, 173, 191]

    for (const i of sampleIndices) {
      const expected = makeReferenceStarAltAz(date, observer, i)
      const actual = stars[i]
      expect(Math.abs(actual.altitude - expected.altitude)).toBeLessThan(1e-9)
      expect(Math.abs(actual.azimuth - expected.azimuth)).toBeLessThan(1e-9)
    }
  })

  it('matches ecliptic alt/az against astronomy-engine reference transform', () => {
    const context = prepareSkyProjectionContext(date, observer)
    const ecliptic = getEclipticAltAzPositionsFromContext(context)
    const sampleLons = [0, 15, 30, 45, 60, 90, 135, 180, 225, 270, 315]

    for (const lonDeg of sampleLons) {
      const expected = makeReferenceEclipticAltAz(date, observer, lonDeg)
      const actual = ecliptic[lonDeg]
      expect(Math.abs(actual.altitude - expected.altitude)).toBeLessThan(1e-9)
      expect(Math.abs(actual.azimuth - expected.azimuth)).toBeLessThan(1e-9)
    }
  })

  it('returns consistent rising/setting longitudes', () => {
    const values = sunHorizonLongitudes(date, observer.lat, -6)
    const rising = sunHorizonLongitude(date, observer.lat, true, -6)
    const setting = sunHorizonLongitude(date, observer.lat, false, -6)
    expect(values.rising).toBeCloseTo(rising, 12)
    expect(values.setting).toBeCloseTo(setting, 12)
  })
})
