import { memo } from 'react'
import { SPEED_OPTIONS } from '../../constants'

interface PlaybackControlsProps {
  isPlaying: boolean
  speed: number
  onTogglePlay: () => void
  onSetSpeed: (s: number) => void
}

export default memo(function PlaybackControls({
  isPlaying,
  speed,
  onTogglePlay,
  onSetSpeed,
}: PlaybackControlsProps) {
  return (
    <div className="playback-row">
      <button onClick={onTogglePlay} className="play-btn">
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>
      <select
        value={speed}
        onChange={(e) => onSetSpeed(Number(e.target.value))}
        className="speed-select"
      >
        {SPEED_OPTIONS.map((s) => (
          <option key={s} value={s}>{s} day{s !== 1 ? 's' : ''}/sec</option>
        ))}
      </select>
    </div>
  )
})
