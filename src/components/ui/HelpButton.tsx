import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface HelpButtonProps {
  onStartTour: () => void
  onStartAdvancedTour: () => void
}

export default function HelpButton({ onStartTour, onStartAdvancedTour }: HelpButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])

  // Position the menu relative to the button
  useEffect(() => {
    if (!menuOpen || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // Prefer above the button; fall back to below if too close to top
    const menuHeight = 70 // approximate
    if (rect.top > menuHeight + 8) {
      setMenuPos({ top: rect.top - menuHeight - 6, left: rect.right - 120 })
    } else {
      setMenuPos({ top: rect.bottom + 6, left: rect.right - 120 })
    }
  }, [menuOpen])

  // Close on click-outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [menuOpen])

  const menu = menuOpen && menuPos && createPortal(
    <div
      className="help-menu"
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
    >
      <button
        className="help-menu-item"
        onClick={() => { setMenuOpen(false); onStartTour() }}
      >
        Quick Tour
      </button>
      <button
        className="help-menu-item"
        onClick={() => { setMenuOpen(false); onStartAdvancedTour() }}
      >
        Full Tour
      </button>
    </div>,
    document.body,
  )

  return (
    <div className="help-btn-container">
      {menu}
      <button className="help-tour-btn" ref={btnRef} onClick={toggleMenu} title="Help">
        ?
      </button>
    </div>
  )
}
