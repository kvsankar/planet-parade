import { useCallback, useState, ReactNode } from 'react'
import { Rnd } from 'react-rnd'
import { PanelId, PanelLayout } from '../../hooks/usePanelManager'

interface FloatingPanelProps {
  id: PanelId
  title: string
  layout: PanelLayout
  zIndex: number
  minWidth?: number
  minHeight?: number
  bodyClassName?: string
  onDragStop: (id: PanelId, x: number, y: number) => void
  onResizeStop: (id: PanelId, w: number, h: number, x: number, y: number) => void
  onFocus: (id: PanelId) => void
  onMinimize: (id: PanelId) => void
  children: ReactNode
}

export default function FloatingPanel({
  id,
  title,
  layout,
  zIndex,
  minWidth = 200,
  minHeight = 100,
  bodyClassName,
  onDragStop,
  onResizeStop,
  onFocus,
  onMinimize,
  children,
}: FloatingPanelProps) {
  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => onDragStop(id, d.x, d.y),
    [id, onDragStop],
  )

  const handleResizeStop = useCallback(
    (
      _e: unknown,
      _dir: unknown,
      ref: HTMLElement,
      _delta: unknown,
      position: { x: number; y: number },
    ) => {
      onResizeStop(id, ref.offsetWidth, ref.offsetHeight, position.x, position.y)
    },
    [id, onResizeStop],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      onFocus(id)
    },
    [id, onFocus],
  )

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onMinimize(id)
    },
    [id, onMinimize],
  )

  const [maximized, setMaximized] = useState(false)

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setMaximized((m) => !m)
    },
    [],
  )

  const PAD = 8
  const pos = maximized
    ? { x: PAD, y: PAD }
    : { x: layout.x, y: layout.y }
  const size = layout.minimized
    ? { width: layout.width, height: 32 }
    : maximized
      ? { width: window.innerWidth - PAD * 2, height: window.innerHeight - PAD * 2 }
      : { width: layout.width, height: layout.height }

  return (
    <Rnd
      position={pos}
      size={size}
      minWidth={minWidth}
      minHeight={layout.minimized ? 32 : minHeight}
      dragHandleClassName="panel-drag-handle"
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      enableResizing={!layout.minimized && !maximized}
      disableDragging={maximized}
      style={{ zIndex, pointerEvents: 'auto' }}
      bounds="parent"
    >
      <div className="floating-panel" onPointerDown={handlePointerDown}>
        <div className="panel-drag-handle">
          <span className="panel-drag-title">{title}</span>
          <div className="panel-handle-btns">
            {!layout.minimized && (
              <button className="panel-minimize-btn" onClick={handleMaximize} title={maximized ? 'Restore' : 'Maximize'}>
                {maximized ? '\u2750' : '\u2197'}
              </button>
            )}
            <button className="panel-minimize-btn" onClick={handleMinimize}>
              {layout.minimized ? '\u25A1' : '\u2014'}
            </button>
          </div>
        </div>
        {!layout.minimized && <div className={`panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>}
      </div>
    </Rnd>
  )
}
