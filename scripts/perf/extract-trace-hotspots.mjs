#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const DEFAULT_MIN_TASK_MS = 50
const DEFAULT_TOP_N = 10
const SEGMENT_START_PREFIX = 'perf.segment.start:'
const SEGMENT_END_PREFIX = 'perf.segment.end:'
const ATTRIBUTION_NOISE_NAMES = new Set([
  'RunTask',
  'ThreadControllerImpl::RunTask',
  'BlinkScheduler_PerformMicrotaskCheckpoint',
  'RunMicrotasks',
  'FireAnimationFrame',
])

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function asTraceEvents(trace) {
  if (Array.isArray(trace)) return trace
  if (trace && Array.isArray(trace.traceEvents)) return trace.traceEvents
  throw new Error('Invalid trace payload: expected array or { traceEvents: [] }')
}

function asSegments(summary) {
  if (summary && Array.isArray(summary.segments)) return summary.segments
  if (summary?.median && Array.isArray(summary.median.segments)) return summary.median.segments
  throw new Error('Invalid summary payload: expected segments[] or median.segments[]')
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function lowerBoundByTs(events, targetTs) {
  let lo = 0
  let hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((events[mid].ts ?? -Infinity) < targetTs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function shortUrl(raw) {
  if (!raw || typeof raw !== 'string') return ''
  try {
    const parsed = new URL(raw)
    if (parsed.pathname && parsed.pathname !== '/') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const tail = parts.slice(-2).join('/')
      return `${parsed.host}/${tail}`
    }
    return parsed.host
  } catch {
    const compact = raw.replace(/^https?:\/\//, '')
    if (compact.length <= 80) return compact
    return `...${compact.slice(-77)}`
  }
}

function buildMetadata(events) {
  const processNames = new Map()
  const threadNames = new Map()
  for (const event of events) {
    if (event?.ph !== 'M') continue
    if (event.name === 'process_name' && event.args?.name && isFiniteNumber(event.pid)) {
      processNames.set(event.pid, String(event.args.name))
    }
    if (event.name === 'thread_name' && event.args?.name && isFiniteNumber(event.pid) && isFiniteNumber(event.tid)) {
      threadNames.set(`${event.pid}:${event.tid}`, String(event.args.name))
    }
  }
  return { processNames, threadNames }
}

function summarizeRunTaskByThread(events) {
  const byThread = new Map()
  for (const event of events) {
    if (event?.name !== 'RunTask' || event?.ph !== 'X') continue
    if (!isFiniteNumber(event.pid) || !isFiniteNumber(event.tid) || !isFiniteNumber(event.dur) || event.dur <= 0) continue
    const key = `${event.pid}:${event.tid}`
    const prev = byThread.get(key) ?? { count: 0, totalDurUs: 0 }
    prev.count += 1
    prev.totalDurUs += event.dur
    byThread.set(key, prev)
  }
  return byThread
}

function collectSegmentMarks(events, pid, tid) {
  const starts = new Map()
  const ends = new Map()

  for (const event of events) {
    if (event?.pid !== pid || event?.tid !== tid) continue
    if (!isFiniteNumber(event.ts) || typeof event.name !== 'string') continue
    if (event.name.startsWith(SEGMENT_START_PREFIX)) {
      const label = event.name.slice(SEGMENT_START_PREFIX.length)
      if (!starts.has(label)) starts.set(label, [])
      starts.get(label).push(event.ts)
      continue
    }
    if (event.name.startsWith(SEGMENT_END_PREFIX)) {
      const label = event.name.slice(SEGMENT_END_PREFIX.length)
      if (!ends.has(label)) ends.set(label, [])
      ends.get(label).push(event.ts)
    }
  }

  for (const arr of starts.values()) arr.sort((a, b) => a - b)
  for (const arr of ends.values()) arr.sort((a, b) => a - b)
  return { starts, ends }
}

function chooseRendererMainThread(events, metadata, runTaskSummary) {
  const candidates = []
  for (const [key, threadName] of metadata.threadNames.entries()) {
    if (threadName !== 'CrRendererMain') continue
    const [pidRaw, tidRaw] = key.split(':')
    const pid = Number(pidRaw)
    const tid = Number(tidRaw)
    if (metadata.processNames.get(pid) !== 'Renderer') continue
    const runTask = runTaskSummary.get(key) ?? { count: 0, totalDurUs: 0 }
    const marks = collectSegmentMarks(events, pid, tid)
    const markCount = [...marks.starts.values()].reduce((sum, arr) => sum + arr.length, 0)
      + [...marks.ends.values()].reduce((sum, arr) => sum + arr.length, 0)
    candidates.push({
      key,
      pid,
      tid,
      processName: metadata.processNames.get(pid) ?? 'unknown',
      threadName,
      runTaskCount: runTask.count,
      runTaskTotalDurUs: runTask.totalDurUs,
      markCount,
    })
  }

  if (!candidates.length) {
    throw new Error('No Renderer/CrRendererMain thread found in trace metadata')
  }

  candidates.sort((a, b) => {
    if (b.markCount !== a.markCount) return b.markCount - a.markCount
    if (b.runTaskCount !== a.runTaskCount) return b.runTaskCount - a.runTaskCount
    return b.runTaskTotalDurUs - a.runTaskTotalDurUs
  })

  return {
    selected: candidates[0],
    candidates,
  }
}

function summarizeTraceRange(events) {
  let minTs = Number.POSITIVE_INFINITY
  let maxTs = Number.NEGATIVE_INFINITY
  for (const event of events) {
    if (!isFiniteNumber(event?.ts)) continue
    if (event.ts < minTs) minTs = event.ts
    const endTs = isFiniteNumber(event.dur) && event.dur > 0 ? event.ts + event.dur : event.ts
    if (endTs > maxTs) maxTs = endTs
  }
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) {
    throw new Error('Could not determine trace timestamp range')
  }
  return { minTs, maxTs }
}

function convertMetricSecondsToTraceUs(seconds, traceRange) {
  if (!isFiniteNumber(seconds)) return null
  const tsUs = seconds * 1_000_000
  // Loose tolerance to account for minor clock drift.
  if (tsUs < traceRange.minTs - 20_000_000 || tsUs > traceRange.maxTs + 20_000_000) {
    return null
  }
  return tsUs
}

function resolveSegmentWindows({ segments, marks, traceRange }) {
  const warnings = []
  const windows = []
  let cursor = traceRange.minTs

  for (const segment of segments) {
    const label = String(segment.label)
    const markStarts = marks.starts.get(label) ?? []
    const markEnds = marks.ends.get(label) ?? []

    let startUs = markStarts[0]
    let endUs = Number.POSITIVE_INFINITY
    if (isFiniteNumber(startUs)) {
      endUs = markEnds.find((ts) => ts > startUs) ?? Number.POSITIVE_INFINITY
    }

    let source = 'user-timing-mark'

    if (!isFiniteNumber(startUs) || !isFiniteNumber(endUs)) {
      const metricStart = convertMetricSecondsToTraceUs(segment.metricTimestampStartSec, traceRange)
      const metricEnd = convertMetricSecondsToTraceUs(segment.metricTimestampEndSec, traceRange)
      if (isFiniteNumber(metricStart) && isFiniteNumber(metricEnd) && metricEnd > metricStart) {
        startUs = metricStart
        endUs = metricEnd
        source = 'cdp-metric-timestamp'
      }
    }

    if (!isFiniteNumber(startUs) || !isFiniteNumber(endUs) || endUs <= startUs) {
      startUs = cursor
      endUs = startUs + parsePositiveNumber(segment.durationMs, 1) * 1_000
      source = 'duration-fallback'
      warnings.push(`Segment "${label}" lacked reliable marks/timestamps; used sequential duration fallback.`)
    }

    startUs = Math.max(traceRange.minTs, startUs)
    endUs = Math.min(traceRange.maxTs, endUs)
    if (endUs <= startUs) {
      endUs = Math.min(traceRange.maxTs, startUs + 1_000)
      warnings.push(`Segment "${label}" collapsed to near-zero window after clamping to trace range.`)
    }

    cursor = endUs
    windows.push({
      label,
      source,
      durationMs: parsePositiveNumber(segment.durationMs, 0),
      startUs,
      endUs,
    })
  }

  return { windows, warnings }
}

function extractEventDetail(event) {
  const data = event?.args?.data ?? {}
  if (event.name === 'FunctionCall') {
    const fn = typeof data.functionName === 'string' && data.functionName ? data.functionName : 'anonymous'
    const url = shortUrl(data.url ?? data.scriptName ?? '')
    return url ? `${fn} @ ${url}` : fn
  }
  if (event.name === 'EvaluateScript') {
    const url = shortUrl(data.url ?? data.scriptName ?? '')
    return url || 'eval'
  }
  if (event.name === 'EventDispatch') {
    return typeof data.type === 'string' && data.type ? data.type : ''
  }
  if (event.name === 'TimerFire') {
    return typeof data.timerId === 'number' ? `timer ${data.timerId}` : ''
  }
  if (event.name === 'XHRReadyStateChange') {
    return shortUrl(data.url ?? '')
  }
  const genericUrl = shortUrl(data.url ?? data.scriptName ?? data.sourceURL ?? '')
  return genericUrl
}

function formatOffenderKey(event) {
  if (!event) return 'Unattributed RunTask'
  const detail = extractEventDetail(event)
  return detail ? `${event.name} (${detail})` : event.name
}

function isAttributionNoise(name) {
  return ATTRIBUTION_NOISE_NAMES.has(name)
}

function overlapUs(startA, endA, startB, endB) {
  const lo = Math.max(startA, startB)
  const hi = Math.min(endA, endB)
  return Math.max(0, hi - lo)
}

function findDominantChildEvent(task, durationEvents) {
  const taskStart = task.ts
  const taskEnd = task.ts + task.dur
  let best = null
  let index = lowerBoundByTs(durationEvents, taskStart)

  while (index < durationEvents.length) {
    const event = durationEvents[index]
    if (!isFiniteNumber(event.ts) || event.ts >= taskEnd) break
    if (event !== task && !isAttributionNoise(event.name)) {
      const eventEnd = event.ts + event.dur
      if (event.ts >= taskStart && eventEnd <= taskEnd) {
        if (!best || event.dur > best.dur) best = event
      }
    }
    index += 1
  }

  return best
}

function topNBy(items, key, n) {
  return [...items].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n)
}

export function extractTraceHotspots({
  trace,
  summary,
  minTaskMs = DEFAULT_MIN_TASK_MS,
  topN = DEFAULT_TOP_N,
} = {}) {
  const events = asTraceEvents(trace)
  const segments = asSegments(summary)
  const minTaskUs = parsePositiveNumber(minTaskMs, DEFAULT_MIN_TASK_MS) * 1_000
  const topCount = parsePositiveInt(topN, DEFAULT_TOP_N)

  const metadata = buildMetadata(events)
  const runTaskSummary = summarizeRunTaskByThread(events)
  const renderer = chooseRendererMainThread(events, metadata, runTaskSummary)
  const rendererTimelineEvents = events.filter((event) =>
    event?.pid === renderer.selected.pid
    && event?.tid === renderer.selected.tid
    && isFiniteNumber(event.ts)
    && event.ts > 0)
  const traceRange = rendererTimelineEvents.length
    ? summarizeTraceRange(rendererTimelineEvents)
    : summarizeTraceRange(events)
  const marks = collectSegmentMarks(events, renderer.selected.pid, renderer.selected.tid)
  const windowResolution = resolveSegmentWindows({
    segments,
    marks,
    traceRange,
  })

  const threadDurationEvents = events
    .filter((event) =>
      event?.pid === renderer.selected.pid
      && event?.tid === renderer.selected.tid
      && event?.ph === 'X'
      && isFiniteNumber(event.ts)
      && isFiniteNumber(event.dur)
      && event.dur > 0)
    .sort((a, b) => a.ts - b.ts)

  const longTasks = threadDurationEvents
    .filter((event) => event.name === 'RunTask' && event.dur >= minTaskUs)

  const segmentSummaries = windowResolution.windows.map((window) => {
    const offenderMap = new Map()
    const longestTasks = []
    let totalLongTaskUs = 0
    let longestLongTaskUs = 0
    let taskCount = 0

    for (const task of longTasks) {
      const taskStart = task.ts
      const taskEnd = task.ts + task.dur
      if (taskEnd <= window.startUs || taskStart >= window.endUs) continue

      const overlap = overlapUs(taskStart, taskEnd, window.startUs, window.endUs)
      if (overlap <= 0) continue

      taskCount += 1
      totalLongTaskUs += overlap
      longestLongTaskUs = Math.max(longestLongTaskUs, overlap)

      const dominantEvent = findDominantChildEvent(task, threadDurationEvents)
      const offenderKey = formatOffenderKey(dominantEvent)
      const offender = offenderMap.get(offenderKey) ?? {
        key: offenderKey,
        eventName: dominantEvent?.name ?? 'RunTask',
        count: 0,
        totalDurUs: 0,
        maxDurUs: 0,
      }
      offender.count += 1
      offender.totalDurUs += overlap
      offender.maxDurUs = Math.max(offender.maxDurUs, overlap)
      offenderMap.set(offenderKey, offender)

      longestTasks.push({
        startUs: taskStart,
        endUs: taskEnd,
        durationMs: round(overlap / 1_000, 2),
        offender: offenderKey,
      })
    }

    const offenders = topNBy([...offenderMap.values()], 'totalDurUs', topCount)
      .map((item, index) => ({
        rank: index + 1,
        key: item.key,
        eventName: item.eventName,
        count: item.count,
        totalMs: round(item.totalDurUs / 1_000, 2),
        maxMs: round(item.maxDurUs / 1_000, 2),
        sharePct: totalLongTaskUs > 0 ? round((item.totalDurUs * 100) / totalLongTaskUs, 2) : 0,
      }))

    const topLongestTasks = topNBy(longestTasks, 'durationMs', Math.min(5, topCount))

    return {
      label: window.label,
      source: window.source,
      requestedDurationMs: window.durationMs,
      windowStartUs: window.startUs,
      windowEndUs: window.endUs,
      windowDurationMs: round((window.endUs - window.startUs) / 1_000, 2),
      longTaskThresholdMs: minTaskUs / 1_000,
      longTaskCount: taskCount,
      totalLongTaskMs: round(totalLongTaskUs / 1_000, 2),
      longestLongTaskMs: round(longestLongTaskUs / 1_000, 2),
      offenders,
      longestTasks: topLongestTasks,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    minTaskMs: minTaskUs / 1_000,
    topN: topCount,
    trace: {
      eventCount: events.length,
      selectedThread: renderer.selected,
      candidateThreads: renderer.candidates,
      traceRangeUs: traceRange,
    },
    warnings: windowResolution.warnings,
    segments: segmentSummaries,
  }
}

export function formatTraceHotspotsMarkdown(report) {
  const lines = []
  lines.push('# Trace Hotspots')
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Long-task threshold: ${report.minTaskMs} ms`)
  lines.push(`- Selected renderer thread: pid=${report.trace.selectedThread.pid} tid=${report.trace.selectedThread.tid} (${report.trace.selectedThread.threadName})`)
  lines.push('')

  for (const segment of report.segments) {
    lines.push(`## ${segment.label}`)
    lines.push('')
    lines.push(`- Window source: ${segment.source}`)
    lines.push(`- Window duration: ${segment.windowDurationMs} ms (requested ${segment.requestedDurationMs} ms)`)
    lines.push(`- Long tasks: ${segment.longTaskCount}, total ${segment.totalLongTaskMs} ms, longest ${segment.longestLongTaskMs} ms`)
    lines.push('')

    if (!segment.offenders.length) {
      lines.push('No long tasks found for this segment.')
      lines.push('')
      continue
    }

    lines.push('| Rank | Offender | Count | Total (ms) | Max (ms) | Share (%) |')
    lines.push('|---|---|---:|---:|---:|---:|')
    for (const offender of segment.offenders) {
      lines.push(`| ${offender.rank} | ${offender.key} | ${offender.count} | ${offender.totalMs} | ${offender.maxMs} | ${offender.sharePct} |`)
    }
    lines.push('')

    if (segment.longestTasks.length) {
      lines.push('| Long Task (ms) | Offender |')
      lines.push('|---:|---|')
      for (const item of segment.longestTasks) {
        lines.push(`| ${item.durationMs} | ${item.offender} |`)
      }
      lines.push('')
    }
  }

  if (report.warnings.length) {
    lines.push('## Warnings')
    lines.push('')
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const args = {
    tracePath: '',
    summaryPath: '',
    outJsonPath: '',
    outMarkdownPath: '',
    minTaskMs: DEFAULT_MIN_TASK_MS,
    topN: DEFAULT_TOP_N,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const next = argv[i + 1]
    if ((token === '--trace' || token === '-t') && next) {
      args.tracePath = next
      i += 1
      continue
    }
    if ((token === '--summary' || token === '-s') && next) {
      args.summaryPath = next
      i += 1
      continue
    }
    if ((token === '--out-json' || token === '-j') && next) {
      args.outJsonPath = next
      i += 1
      continue
    }
    if ((token === '--out-md' || token === '-m') && next) {
      args.outMarkdownPath = next
      i += 1
      continue
    }
    if (token === '--min-task-ms' && next) {
      args.minTaskMs = parsePositiveNumber(next, DEFAULT_MIN_TASK_MS)
      i += 1
      continue
    }
    if (token === '--top' && next) {
      args.topN = parsePositiveInt(next, DEFAULT_TOP_N)
      i += 1
    }
  }

  return args
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const tracePath = parsed.tracePath || process.env.PERF_TRACE_PATH || path.join(cwd, 'chrome-trace.json')
  const summaryPath = parsed.summaryPath || process.env.PERF_SUMMARY_PATH || path.join(cwd, 'summary.json')
  const outJsonPath = parsed.outJsonPath || process.env.PERF_HOTSPOTS_JSON_PATH || path.join(cwd, 'hotspots.json')
  const outMarkdownPath = parsed.outMarkdownPath || process.env.PERF_HOTSPOTS_MD_PATH || path.join(cwd, 'hotspots.md')

  const [traceRaw, summaryRaw] = await Promise.all([
    readFile(tracePath, 'utf8'),
    readFile(summaryPath, 'utf8'),
  ])

  const report = extractTraceHotspots({
    trace: JSON.parse(traceRaw),
    summary: JSON.parse(summaryRaw),
    minTaskMs: parsed.minTaskMs,
    topN: parsed.topN,
  })

  await writeFile(outJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(outMarkdownPath, formatTraceHotspotsMarkdown(report), 'utf8')

  console.log('[hotspots] Done.')
  console.log(`[hotspots] JSON: ${outJsonPath}`)
  console.log(`[hotspots] Markdown: ${outMarkdownPath}`)
  console.log(`[hotspots] Selected thread: pid=${report.trace.selectedThread.pid} tid=${report.trace.selectedThread.tid}`)
}

const isDirectRun = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')

if (isDirectRun) {
  main().catch((error) => {
    console.error('[hotspots] Failed:', error)
    process.exitCode = 1
  })
}
