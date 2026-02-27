import { useState, useEffect, useRef, useCallback } from 'react'

interface HelpButtonProps {
  onStartTour: () => void
  onStartAdvancedTour: () => void
}

export default function HelpButton({ onStartTour, onStartAdvancedTour }: HelpButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])

  // Close on click-outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  return (
    <div className="help-btn-container" ref={containerRef}>
      {menuOpen && (
        <div className="help-menu">
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
        </div>
      )}
      <button className="help-tour-btn" onClick={toggleMenu} title="Help">
        ?
      </button>
    </div>
  )
}
