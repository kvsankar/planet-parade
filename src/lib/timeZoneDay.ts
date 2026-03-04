const MS_PER_DAY = 86_400_000

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

interface DayParts {
  year: number
  month: number
  day: number
}

interface TimeZoneDayRange {
  dayKey: string
  startMs: number
  endMs: number
}

const utcDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dayFormatterCache = new Map<string, Intl.DateTimeFormat>()
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDayKey(parts: DayParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function parseDayKey(dayKey: string): DayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function toPartsMap(parts: Intl.DateTimeFormatPart[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of parts) out.set(part.type, part.value)
  return out
}

function getUtcDayKey(date: Date): string {
  const byType = toPartsMap(utcDayFormatter.formatToParts(date))
  const year = Number(byType.get('year'))
  const month = Number(byType.get('month'))
  const day = Number(byType.get('day'))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return formatDayKey({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    })
  }
  return formatDayKey({ year, month, day })
}

function getDayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dayFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  dayFormatterCache.set(timeZone, formatter)
  return formatter
}

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    hour12: false,
  })
  dateTimeFormatterCache.set(timeZone, formatter)
  return formatter
}

function readDateTimeParts(formatter: Intl.DateTimeFormat, date: Date): DateParts | null {
  const byType = toPartsMap(formatter.formatToParts(date))
  const year = Number(byType.get('year'))
  const month = Number(byType.get('month'))
  const day = Number(byType.get('day'))
  const hour = Number(byType.get('hour'))
  const minute = Number(byType.get('minute'))
  const second = Number(byType.get('second'))
  if (
    !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
    !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)
  ) {
    return null
  }
  return { year, month, day, hour, minute, second }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number | null {
  const formatter = getDateTimeFormatter(timeZone)
  const parts = readDateTimeParts(formatter, date)
  if (!parts) return null

  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const utcMs = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((localAsUtcMs - utcMs) / 60_000)
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  let guess = localAsUtcMs

  for (let i = 0; i < 6; i++) {
    const offsetMin = getTimeZoneOffsetMinutes(new Date(guess), timeZone)
    if (offsetMin == null) return localAsUtcMs
    const nextGuess = localAsUtcMs - offsetMin * 60_000
    if (Math.abs(nextGuess - guess) < 1_000) return nextGuess
    guess = nextGuess
  }

  return guess
}

export function getTimeZoneDayKey(date: Date, timeZone?: string | null): string {
  if (!timeZone) return getUtcDayKey(date)
  try {
    const formatter = getDayFormatter(timeZone)
    const byType = toPartsMap(formatter.formatToParts(date))
    const year = Number(byType.get('year'))
    const month = Number(byType.get('month'))
    const day = Number(byType.get('day'))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return getUtcDayKey(date)
    }
    return formatDayKey({ year, month, day })
  } catch {
    return getUtcDayKey(date)
  }
}

export function getTimeZoneDayRange(baseDate: Date, timeZone?: string | null): TimeZoneDayRange {
  const dayKey = getTimeZoneDayKey(baseDate, timeZone)
  const parsed = parseDayKey(dayKey)
  if (!parsed || !timeZone) {
    const startMs = Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      0, 0, 0, 0,
    )
    return { dayKey, startMs, endMs: startMs + MS_PER_DAY }
  }

  try {
    const startMs = zonedDateTimeToUtcMs(parsed.year, parsed.month, parsed.day, 0, 0, 0, timeZone)
    const nextDayUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0))
    nextDayUtc.setUTCDate(nextDayUtc.getUTCDate() + 1)
    const endMs = zonedDateTimeToUtcMs(
      nextDayUtc.getUTCFullYear(),
      nextDayUtc.getUTCMonth() + 1,
      nextDayUtc.getUTCDate(),
      0, 0, 0,
      timeZone,
    )
    if (endMs > startMs) return { dayKey, startMs, endMs }
  } catch {
    // Fall back to UTC day boundaries below.
  }

  const fallbackStartMs = Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    0, 0, 0, 0,
  )
  return { dayKey: getUtcDayKey(baseDate), startMs: fallbackStartMs, endMs: fallbackStartMs + MS_PER_DAY }
}

