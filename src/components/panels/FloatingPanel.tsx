import { useCallback, ReactNode } from 'react'
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

  return (
    <Rnd
      position={{ x: layout.x, y: layout.y }}
      size={
        layout.minimized
          ? { width: layout.width, height: 32 }
          : { width: layout.width, height: layout.height }
      }
      minWidth={minWidth}
      minHeight={layout.minimized ? 32 : minHeight}
      dragHandleClassName="panel-drag-handle"
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      enableResizing={!layout.minimized}
      style={{ zIndex, pointerEvents: 'auto' }}
      bounds="parent"
    >
      <div className="floating-panel" onPointerDown={handlePointerDown}>
        <div className="panel-drag-handle">
          <span className="panel-drag-title">{title}</span>
          <button className="panel-minimize-btn" onClick={handleMinimize}>
            {layout.minimized ? '\u25A1' : '\u2014'}
          </button>
        </div>
        {!layout.minimized && <div className={`panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>}
      </div>
    </Rnd>
  )
}
