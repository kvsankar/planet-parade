import { memo } from 'react'
import { SPEED_OPTIONS, DATE_MIN, DATE_MAX } from '../../constants'

interface PlaybackBarProps {
  currentDate: Date
  isPlaying: boolean
  speed: number
  togglePlay: () => void
  setSpeed: (s: number) => void
  onDateChange: (d: Date) => void
  hasPrev: boolean
  hasNext: boolean
  jumpToMinimum: (direction: 'prev' | 'next') => void
}

export default memo(function PlaybackBar({
  currentDate,
  isPlaying,
  speed,
  togglePlay,
  setSpeed,
  onDateChange,
  hasPrev,
  hasNext,
  jumpToMinimum,
}: PlaybackBarProps) {
  return (
    <div className="playback-bar">
      <input
        type="date"
        className="playback-date-input"
        value={currentDate.toISOString().slice(0, 10)}
        min={DATE_MIN.toISOString().slice(0, 10)}
        max={DATE_MAX.toISOString().slice(0, 10)}
        onChange={(e) => {
          const d = new Date(e.target.value + 'T00:00:00Z')
          if (!isNaN(d.getTime())) onDateChange(d)
        }}
      />
      <button
        className="minima-nav-btn"
        onClick={() => onDateChange(new Date())}
        title="Jump to today"
      >
        Today
      </button>
      <button onClick={togglePlay} className="play-btn">
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="speed-select"
      >
        {SPEED_OPTIONS.map((s) => (
          <option key={s} value={s}>{s} d/s</option>
        ))}
      </select>
      <button
        className="minima-nav-btn"
        onClick={() => jumpToMinimum('prev')}
        disabled={!hasPrev}
        title="Previous minimum"
      >
        &#9664; Prev
      </button>
      <button
        className="minima-nav-btn"
        onClick={() => jumpToMinimum('next')}
        disabled={!hasNext}
        title="Next minimum"
      >
        Next &#9654;
      </button>
    </div>
  )
})
