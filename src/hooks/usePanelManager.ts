import { useState, useCallback, useRef, useEffect } from 'react'

export interface PanelLayout {
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
}

export type PanelId = 'scene' | 'controls' | 'chart' | 'skyview'

type PanelLayouts = Record<PanelId, PanelLayout>

const STORAGE_KEY = 'solar-panels-layout-v4'

function getDefaults(): PanelLayouts {
  const w = window.innerWidth
  const h = window.innerHeight
  const PAD = 12
  const GAP = 4
  const leftW = 250
  const rightW = Math.min(420, Math.floor(w * 0.3))
  const midX = PAD + leftW + GAP
  const rightX = w - rightW - PAD
  const midW = Math.max(300, rightX - midX - GAP)
  const totalH = h - PAD * 2
  const chartH = Math.floor(totalH * 0.4)
  const skyH = totalH - chartH - GAP
  return {
    controls: { x: PAD, y: PAD, width: leftW, height: totalH, minimized: false },
    scene: { x: midX, y: PAD, width: midW, height: totalH, minimized: false },
    chart: { x: rightX, y: PAD, width: rightW, height: chartH, minimized: false },
    skyview: { x: rightX, y: PAD + chartH + GAP, width: rightW, height: skyH, minimized: false },
  }
}

function loadFromStorage(): PanelLayouts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PanelLayouts
    // Validate structure
    const ids: PanelId[] = ['scene', 'controls', 'chart', 'skyview']
    for (const id of ids) {
      if (!parsed[id] || typeof parsed[id].x !== 'number') return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveToStorage(layouts: PanelLayouts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    // storage full or unavailable
  }
}

export function usePanelManager() {
  const [layouts, setLayouts] = useState<PanelLayouts>(() => loadFromStorage() ?? getDefaults())
  const [zOrder, setZOrder] = useState<PanelId[]>(['scene', 'controls', 'chart', 'skyview'])

  // Debounced save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutsRef = useRef(layouts)
  layoutsRef.current = layouts

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveToStorage(layouts), 500)
  }, [layouts])

  const onDragStop = useCallback((id: PanelId, x: number, y: number) => {
    setLayouts((prev) => ({ ...prev, [id]: { ...prev[id], x, y } }))
  }, [])

  const onResizeStop = useCallback(
    (id: PanelId, width: number, height: number, x: number, y: number) => {
      setLayouts((prev) => ({ ...prev, [id]: { ...prev[id], width, height, x, y } }))
    },
    [],
  )

  const onFocus = useCallback((id: PanelId) => {
    setZOrder((prev) => {
      if (prev[prev.length - 1] === id) return prev
      return [...prev.filter((p) => p !== id), id]
    })
  }, [])

  const onMinimize = useCallback((id: PanelId) => {
    setLayouts((prev) => ({
      ...prev,
      [id]: { ...prev[id], minimized: !prev[id].minimized },
    }))
  }, [])

  const resetLayout = useCallback(() => {
    const defaults = getDefaults()
    setLayouts(defaults)
    saveToStorage(defaults)
  }, [])

  // Convert zOrder to z-index map
  const zIndexMap = {} as Record<PanelId, number>
  zOrder.forEach((id, i) => {
    zIndexMap[id] = 100 + i
  })

  return { layouts, zIndexMap, onDragStop, onResizeStop, onFocus, onMinimize, resetLayout }
}
