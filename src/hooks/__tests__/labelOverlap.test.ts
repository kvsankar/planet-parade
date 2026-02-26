import { describe, it, expect } from 'vitest'
import { LabelRegistry } from '../useLabelOverlap'

describe('LabelRegistry', () => {
  it('isolated planet label goes above (default)', () => {
    const reg = new LabelRegistry()
    reg.set('Saturn', 400, 300, 6, 11, 4)
    const off = reg.getOffset('Saturn')
    // Should be centered above: dx ≈ -w/2, dy ≈ -(GAP + h)
    expect(off.dy).toBeLessThan(-10) // above the planet
    expect(off.dx).toBeLessThan(0)   // shifted left to center
  })

  it('two close planets get pushed apart', () => {
    const reg = new LabelRegistry()
    // Saturn and Neptune at nearly the same screen position
    reg.set('Saturn', 400, 300, 6, 11, 4)
    reg.set('Neptune', 403, 302, 7, 11, 7)

    const satOff = reg.getOffset('Saturn')
    const nepOff = reg.getOffset('Neptune')

    // They should be pushed in OPPOSITE directions
    // Saturn (higher priority) pushed one way, Neptune the other
    console.log('Saturn offset:', satOff)
    console.log('Neptune offset:', nepOff)

    // The offsets should be different
    expect(satOff.dx !== nepOff.dx || satOff.dy !== nepOff.dy).toBe(true)

    // Their label centers should be well separated
    const satCenter = { x: 400 + satOff.dx + 6 * 11 * 0.6 / 2, y: 300 + satOff.dy + 11 * 1.4 / 2 }
    const nepCenter = { x: 403 + nepOff.dx + 7 * 11 * 0.6 / 2, y: 302 + nepOff.dy + 11 * 1.4 / 2 }
    const dist = Math.sqrt((satCenter.x - nepCenter.x) ** 2 + (satCenter.y - nepCenter.y) ** 2)
    console.log('Label center distance:', dist, 'px')
    expect(dist).toBeGreaterThan(30)
  })

  it('two planets at identical position still separate', () => {
    const reg = new LabelRegistry()
    reg.set('Saturn', 400, 300, 6, 11, 4)
    reg.set('Neptune', 400, 300, 7, 11, 7)

    const satOff = reg.getOffset('Saturn')
    const nepOff = reg.getOffset('Neptune')

    console.log('Identical pos — Saturn offset:', satOff)
    console.log('Identical pos — Neptune offset:', nepOff)

    // Must be different
    expect(satOff.dy !== nepOff.dy || satOff.dx !== nepOff.dx).toBe(true)
  })

  it('far apart planets both get default above offset', () => {
    const reg = new LabelRegistry()
    reg.set('Saturn', 100, 300, 6, 11, 4)
    reg.set('Neptune', 500, 300, 7, 11, 7)

    const satOff = reg.getOffset('Saturn')
    const nepOff = reg.getOffset('Neptune')

    // Both should get "above" default (negative dy, negative dx for centering)
    expect(satOff.dy).toBeLessThan(-10)
    expect(nepOff.dy).toBeLessThan(-10)
  })
})
