import { createContext, useContext, useState, type ReactNode } from 'react'

export interface LabelOffset {
  dx: number
  dy: number
}

interface LabelPos { x: number; y: number }
interface LabelMeta { charCount: number; fontSize: number; priority: number }
interface LabelEntry {
  id: string
  ax: number; ay: number
  charCount: number; fontSize: number; priority: number
  dx: number; dy: number
}

const GAP = 6
const CLOSE_THRESHOLD = 50 // screen px — planets closer than this get repulsed labels

export class LabelRegistry {
  private positions = new Map<string, LabelPos>()
  private meta = new Map<string, LabelMeta>()
  private committedOffsets = new Map<string, LabelOffset>()
  private needsResolve = false

  set(id: string, x: number, y: number, charCount: number, fontSize: number, priority: number) {
    this.positions.set(id, { x, y })
    this.meta.set(id, { charCount, fontSize, priority })
    this.needsResolve = true
  }

  remove(id: string) {
    if (this.positions.delete(id)) {
      this.meta.delete(id)
      this.committedOffsets.delete(id)
      this.needsResolve = true
    }
  }

  getOffset(id: string): LabelOffset {
    if (this.needsResolve) {
      this.resolve()
      this.needsResolve = false
    }
    return this.committedOffsets.get(id) ?? { dx: 0, dy: -20 }
  }

  private resolve(): void {
    const entries: LabelEntry[] = []
    for (const [id, pos] of this.positions) {
      const m = this.meta.get(id)
      if (!m) continue
      entries.push({ id, ax: pos.x, ay: pos.y, ...m, dx: 0, dy: 0 })
    }
    if (entries.length === 0) { this.committedOffsets.clear(); return }

    for (const entry of entries) {
      const w = entry.charCount * entry.fontSize * 0.6
      const h = entry.fontSize * 1.4

      // Accumulate repulsion from nearby planets
      let rx = 0, ry = 0
      let nearbyCount = 0

      for (const other of entries) {
        if (other.id === entry.id) continue
        const ddx = entry.ax - other.ax
        const ddy = entry.ay - other.ay
        const dist = Math.sqrt(ddx * ddx + ddy * ddy)

        if (dist < CLOSE_THRESHOLD) {
          nearbyCount++
          if (dist < 1) {
            // Nearly identical position — push by priority (higher priority = up)
            ry += entry.priority < other.priority ? -1 : 1
          } else {
            // Push away from neighbor, stronger when closer
            const strength = 1 - dist / CLOSE_THRESHOLD
            rx += (ddx / dist) * strength
            ry += (ddy / dist) * strength
          }
        }
      }

      if (nearbyCount > 0) {
        const len = Math.sqrt(rx * rx + ry * ry)
        if (len > 0.01) {
          const nx = rx / len
          const ny = ry / len
          // Extension distance: scale with label size so it clears the dot
          const ext = Math.max(30, Math.max(w, h) / 2 + 15)
          // Place label centered on the tip of the extended line
          entry.dx = nx * ext - w / 2
          entry.dy = ny * ext - h / 2
        } else {
          // Degenerate repulsion cancelled out — push up
          entry.dx = -w / 2
          entry.dy = -(GAP + h)
        }
      } else {
        // Isolated planet — default label above, centered
        entry.dx = -w / 2
        entry.dy = -(GAP + h)
      }
    }

    this.committedOffsets.clear()
    for (const e of entries) {
      this.committedOffsets.set(e.id, { dx: Math.round(e.dx), dy: Math.round(e.dy) })
    }
  }
}

const LabelRegistryCtx = createContext<LabelRegistry>(new LabelRegistry())

export function LabelRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new LabelRegistry())
  return <LabelRegistryCtx.Provider value={registry}>{children}</LabelRegistryCtx.Provider>
}

export function useLabelRegistry(): LabelRegistry {
  return useContext(LabelRegistryCtx)
}

const PRIORITY_ORDER: Record<string, number> = {
  Sun: 1, Earth: 2, Jupiter: 3, Saturn: 4,
  Mars: 5, Venus: 6, Neptune: 7, Uranus: 8,
  Mercury: 9, Pluto: 10,
}

export function getLabelPriority(bodyId: string, isSelected: boolean): number {
  if (isSelected) return 0
  return PRIORITY_ORDER[bodyId] ?? 10
}
