import { useState, useCallback, useRef, useEffect } from 'react'

export interface PanelLayout {
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  maximized: boolean
}

export type PanelId = 'scene' | 'controls' | 'chart' | 'skyview' | 'skychart'

type PanelLayouts = Record<PanelId, PanelLayout>

const STORAGE_KEY = 'solar-panels-layout-v8'

function getDefaults(): PanelLayouts {
  const w = window.innerWidth
  const h = window.innerHeight
  const PAD = 12
  const GAP = 4
  const totalH = h - PAD * 2

  // Column 1: Alignments (left sidebar)
  const col1W = 250
  const col1X = PAD

  // Column 4: Sky Charts (right sidebar)
  const col4W = Math.min(400, Math.floor(w * 0.26))
  const col4X = w - col4W - PAD

  // Column 3: Alignment Timeline + Sky View (stacked)
  const col3W = Math.min(500, Math.floor(w * 0.34))
  const col3X = col4X - col3W - GAP
  const chartH = Math.floor(totalH * 0.45)
  const skyviewH = totalH - chartH - GAP

  // Column 2: Solar System (fills remaining space)
  const col2X = col1X + col1W + GAP
  const col2W = Math.max(300, col3X - col2X - GAP)

  return {
    controls: { x: col1X, y: PAD, width: col1W, height: totalH, minimized: false, maximized: false },
    scene:    { x: col2X, y: PAD, width: col2W, height: totalH, minimized: false, maximized: false },
    chart:    { x: col3X, y: PAD, width: col3W, height: chartH, minimized: false, maximized: false },
    skyview:  { x: col3X, y: PAD + chartH + GAP, width: col3W, height: skyviewH, minimized: false, maximized: false },
    skychart: { x: col4X, y: PAD, width: col4W, height: totalH, minimized: false, maximized: false },
  }
}

function loadFromStorage(): PanelLayouts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PanelLayouts
    // Validate structure
    const ids: PanelId[] = ['scene', 'controls', 'chart', 'skyview', 'skychart']
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
  const [zOrder, setZOrder] = useState<PanelId[]>(['scene', 'controls', 'chart', 'skyview', 'skychart'])

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

  const onMaximize = useCallback((id: PanelId) => {
    setLayouts((prev) => ({
      ...prev,
      [id]: { ...prev[id], maximized: !prev[id].maximized },
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

  return { layouts, zIndexMap, onDragStop, onResizeStop, onFocus, onMinimize, onMaximize, resetLayout }
}
