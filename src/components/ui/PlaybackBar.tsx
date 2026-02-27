import { memo, type ReactNode } from 'react'
import { SPEED_OPTIONS, DATE_MIN, DATE_MAX } from '../../constants'

interface PlaybackBarProps {
  currentDate: Date
  isPlaying: boolean
  speed: number
  togglePlay: () => void
  setSpeed: (s: number) => void
  onDateChange: (d: Date) => void
  extraActions?: ReactNode
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export default memo(function PlaybackBar({
  currentDate,
  isPlaying,
  speed,
  togglePlay,
  setSpeed,
  onDateChange,
  extraActions,
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
        className="minima-nav-btn playback-today-btn"
        onClick={() => onDateChange(new Date())}
        title="Jump to today"
      >
        Today
      </button>
      <button className="minima-nav-btn" onClick={() => onDateChange(addDays(currentDate, -5))} title="Back 5 days">
        &#9664;&#9664; 5
      </button>
      <button className="minima-nav-btn" onClick={() => onDateChange(addDays(currentDate, -1))} title="Back 1 day">
        &#9664; 1
      </button>
      <button onClick={togglePlay} className="play-btn">
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>
      <button className="minima-nav-btn" onClick={() => onDateChange(addDays(currentDate, 1))} title="Forward 1 day">
        1 &#9654;
      </button>
      <button className="minima-nav-btn" onClick={() => onDateChange(addDays(currentDate, 5))} title="Forward 5 days">
        5 &#9654;&#9654;
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
      {extraActions}
    </div>
  )
})
