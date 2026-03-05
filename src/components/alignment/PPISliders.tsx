import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { PPIWeights } from '../../types'
import { DEFAULT_PPI_WEIGHTS, MEDIA_PPI_WEIGHTS } from '../../lib/ppiScoring'

interface PPISlidersProps {
  weights: PPIWeights
  onChange: (w: PPIWeights) => void
}

type PresetId = 'practical' | 'hyped' | 'custom'

const PRESETS: { id: PresetId; label: string; weights: PPIWeights; desc: string }[] = [
  { id: 'practical', label: 'Practical', weights: DEFAULT_PPI_WEIGHTS, desc: 'Tight, bright clusters with visibility weighting' },
  { id: 'hyped', label: 'Hyped', weights: MEDIA_PPI_WEIGHTS, desc: 'Prioritizes larger planet counts; tolerant of wider spans' },
]

function detectPreset(w: PPIWeights): PresetId {
  for (const p of PRESETS) {
    if (w.alpha === p.weights.alpha && w.beta === p.weights.beta &&
        w.gamma === p.weights.gamma && w.delta === p.weights.delta) return p.id
  }
  return 'custom'
}

export default memo(function PPISliders({ weights, onChange }: PPISlidersProps) {
  const [local, setLocal] = useState({ ...weights })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal({ ...weights })
  }, [weights.alpha, weights.beta, weights.gamma, weights.delta])

  const debounceEmit = useCallback((next: PPIWeights) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(next), 300)
  }, [onChange])

  const handleSlider = useCallback((key: keyof PPIWeights) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setLocal((prev) => {
      const next = { ...prev, [key]: v }
      debounceEmit(next)
      return next
    })
  }, [debounceEmit])

  const activePreset = detectPreset(local)

  const applyPreset = useCallback((w: PPIWeights) => {
    setLocal({ ...w })
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange({ ...w })
  }, [onChange])

  return (
    <div className="ppi-sliders">
      <span className="control-label">
        Parade Scoring
      </span>
      <div className="ppi-preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`ppi-preset-btn ${activePreset === p.id ? 'active' : ''}`}
            onClick={() => applyPreset(p.weights)}
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
        {activePreset === 'custom' && (
          <span className="ppi-preset-custom">Custom</span>
        )}
      </div>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">Few</span>
        <input type="range" className="ppi-slider" min={0} max={3} step={0.5} value={local.alpha} onChange={handleSlider('alpha')} />
        <span className="ppi-slider-label">Many</span>
      </div>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">Wide</span>
        <input type="range" className="ppi-slider" min={0} max={3} step={0.5} value={local.beta} onChange={handleSlider('beta')} />
        <span className="ppi-slider-label">Tight</span>
      </div>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">All equal</span>
        <input type="range" className="ppi-slider" min={0} max={2} step={0.5} value={local.gamma} onChange={handleSlider('gamma')} />
        <span className="ppi-slider-label">Bright</span>
      </div>
      <div className="ppi-slider-row">
        <span className="ppi-slider-label">Geometric</span>
        <input type="range" className="ppi-slider" min={0} max={1} step={0.25} value={local.delta} onChange={handleSlider('delta')} />
        <span className="ppi-slider-label">Visible</span>
      </div>
    </div>
  )
})
