#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { readFile } from 'node:fs/promises'

const currentPath = process.env.PERF_MEDIAN_PATH ?? path.join('test-output', 'perf', 'repeat-latest', 'median-summary.json')
const baselinePath = process.env.PERF_BASELINE_PATH ?? path.join('scripts', 'perf', 'baseline-median-summary.json')

const maxWeightedFpsDropPct = parseNumber(process.env.PERF_MAX_WEIGHTED_FPS_DROP_PCT, 20)
const maxWorstP99IncreasePct = parseNumber(process.env.PERF_MAX_WORST_P99_INCREASE_PCT, 30)
const maxWorstP99IncreaseMs = parseNumber(process.env.PERF_MAX_WORST_P99_INCREASE_MS, 20)
const maxLongTaskIncreasePct = parseNumber(process.env.PERF_MAX_LONG_TASK_INCREASE_PCT, 40)
const maxLongTaskIncreaseAbs = parseNumber(process.env.PERF_MAX_LONG_TASK_INCREASE_ABS, 400)

const segmentLabels = parseSegmentLabels(
  process.env.PERF_SEGMENT_LABELS,
  process.env.PERF_SEGMENT_LABEL,
  ['skychart_texture_playback', 'planetarium_playback', 'idle_final'],
)
const maxSegmentFpsDropPct = parseNumber(process.env.PERF_MAX_SEGMENT_FPS_DROP_PCT, 25)
const maxSegmentP99IncreasePct = parseNumber(process.env.PERF_MAX_SEGMENT_P99_INCREASE_PCT, 40)
const maxSegmentP99IncreaseMs = parseNumber(process.env.PERF_MAX_SEGMENT_P99_INCREASE_MS, 25)

const allowMissingBaseline = parseBool(process.env.PERF_ALLOW_MISSING_BASELINE)

function parseBool(value) {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function parseSegmentLabels(segmentListEnv, legacySingleSegmentEnv, fallback) {
  const raw = segmentListEnv ?? legacySingleSegmentEnv ?? ''
  const labels = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (!labels.length) return fallback
  return [...new Set(labels)]
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function extractMetrics(summary) {
  const aggregate = summary?.median?.aggregate ?? summary?.aggregate
  const segments = summary?.median?.segments ?? summary?.segments
  if (!aggregate || !Array.isArray(segments)) {
    throw new Error('Invalid summary JSON: expected aggregate/segments or median.aggregate/median.segments')
  }
  return {
    aggregate,
    segments,
    commit: summary?.gitCommit ?? 'unknown',
    generatedAt: summary?.generatedAt ?? summary?.endedAt ?? 'unknown',
  }
}

function getSegment(segments, label) {
  return segments.find((segment) => segment.label === label)
}

function evaluateChecks({ baseline, current }) {
  const checks = []

  const baselineWeightedFps = Number(baseline.aggregate.weightedAvgFps)
  const currentWeightedFps = Number(current.aggregate.weightedAvgFps)
  const weightedFpsFloor = baselineWeightedFps * (1 - (maxWeightedFpsDropPct / 100))
  checks.push({
    name: 'weightedAvgFps',
    ok: currentWeightedFps >= weightedFpsFloor,
    baseline: baselineWeightedFps,
    current: currentWeightedFps,
    expected: `>= ${round(weightedFpsFloor)}`,
  })

  const baselineWorstP99 = Number(baseline.aggregate.worstP99FrameMs)
  const currentWorstP99 = Number(current.aggregate.worstP99FrameMs)
  const worstP99Ceiling = Math.max(
    baselineWorstP99 * (1 + (maxWorstP99IncreasePct / 100)),
    baselineWorstP99 + maxWorstP99IncreaseMs,
  )
  checks.push({
    name: 'worstP99FrameMs',
    ok: currentWorstP99 <= worstP99Ceiling,
    baseline: baselineWorstP99,
    current: currentWorstP99,
    expected: `<= ${round(worstP99Ceiling)}`,
  })

  const baselineLongTasks = Number(baseline.aggregate.longTaskCount)
  const currentLongTasks = Number(current.aggregate.longTaskCount)
  const longTaskCeiling = Math.max(
    baselineLongTasks * (1 + (maxLongTaskIncreasePct / 100)),
    baselineLongTasks + maxLongTaskIncreaseAbs,
  )
  checks.push({
    name: 'longTaskCount',
    ok: currentLongTasks <= longTaskCeiling,
    baseline: baselineLongTasks,
    current: currentLongTasks,
    expected: `<= ${round(longTaskCeiling)}`,
  })

  for (const segmentLabel of segmentLabels) {
    const baselineSegment = getSegment(baseline.segments, segmentLabel)
    const currentSegment = getSegment(current.segments, segmentLabel)

    if (!baselineSegment || !currentSegment) {
      checks.push({
        name: `segment:${segmentLabel}`,
        ok: false,
        baseline: baselineSegment ? 'present' : 'missing',
        current: currentSegment ? 'present' : 'missing',
        expected: 'both present',
      })
      continue
    }

    const baselineSegmentFps = Number(baselineSegment.fps)
    const currentSegmentFps = Number(currentSegment.fps)
    const segmentFpsFloor = baselineSegmentFps * (1 - (maxSegmentFpsDropPct / 100))
    checks.push({
      name: `segment:${segmentLabel}:fps`,
      ok: currentSegmentFps >= segmentFpsFloor,
      baseline: baselineSegmentFps,
      current: currentSegmentFps,
      expected: `>= ${round(segmentFpsFloor)}`,
    })

    const baselineSegmentP99 = Number(baselineSegment.p99FrameMs)
    const currentSegmentP99 = Number(currentSegment.p99FrameMs)
    const segmentP99Ceiling = Math.max(
      baselineSegmentP99 * (1 + (maxSegmentP99IncreasePct / 100)),
      baselineSegmentP99 + maxSegmentP99IncreaseMs,
    )
    checks.push({
      name: `segment:${segmentLabel}:p99FrameMs`,
      ok: currentSegmentP99 <= segmentP99Ceiling,
      baseline: baselineSegmentP99,
      current: currentSegmentP99,
      expected: `<= ${round(segmentP99Ceiling)}`,
    })
  }

  return checks
}

function printChecks(checks) {
  console.log('')
  console.log('[perf-check] Metric checks:')
  for (const check of checks) {
    const status = check.ok ? 'PASS' : 'FAIL'
    console.log(`- ${status} ${check.name}: baseline=${check.baseline} current=${check.current} expected ${check.expected}`)
  }
}

async function main() {
  let baselineSummary
  try {
    baselineSummary = await readJson(baselinePath)
  } catch (error) {
    if (allowMissingBaseline) {
      const reason = error instanceof Error ? error.message : String(error)
      console.log(`[perf-check] Baseline missing at ${baselinePath}; skipping due to PERF_ALLOW_MISSING_BASELINE=1 (${reason})`)
      return
    }
    throw error
  }

  const currentSummary = await readJson(currentPath)

  const baseline = extractMetrics(baselineSummary)
  const current = extractMetrics(currentSummary)

  console.log('[perf-check] Comparing profiling medians')
  console.log(`[perf-check] Baseline: ${baselinePath} (commit ${baseline.commit}, generated ${baseline.generatedAt})`)
  console.log(`[perf-check] Current:  ${currentPath} (commit ${current.commit}, generated ${current.generatedAt})`)
  console.log(`[perf-check] Segment checks: ${segmentLabels.join(', ')}`)

  const checks = evaluateChecks({ baseline, current })
  printChecks(checks)

  const failures = checks.filter((check) => !check.ok)
  if (failures.length) {
    console.error(`[perf-check] Regression detected: ${failures.length} failing check(s).`)
    process.exitCode = 1
    return
  }

  console.log('[perf-check] No regression detected under configured thresholds.')
}

main().catch((error) => {
  console.error('[perf-check] Failed:', error)
  process.exitCode = 1
})
