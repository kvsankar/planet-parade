#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const singleRunScript = path.join(scriptDir, 'run-playwright-profile.mjs')

const repeatCount = parsePositiveInt(process.env.PROFILE_REPEAT, 5)
const outRoot = process.env.PROFILE_OUT_DIR ?? path.join('test-output', 'perf', `repeat-${new Date().toISOString().replace(/[:.]/g, '-')}`)

function parsePositiveInt(value, fallback) {
  if (!value) return fallback
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.inheritStdio ? 'inherit' : 'pipe',
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    if (child.stdout) child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    if (child.stderr) child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Command failed (${code}): ${command} ${args.join(' ')}\n${stderr || stdout}`))
      }
    })
  })
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function readNumber(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function extractMedianAggregate(runSummaries) {
  const fields = ['totalProfileMs', 'weightedAvgFps', 'worstP99FrameMs', 'worstMaxFrameMs', 'longTaskCount']
  const aggregate = {}

  for (const field of fields) {
    const values = runSummaries
      .map((run) => Number(run.aggregate?.[field]))
      .filter((value) => Number.isFinite(value))
    aggregate[field] = round(median(values))
  }

  return aggregate
}

function extractMedianSegments(runSummaries) {
  const segmentFields = [
    'durationMs',
    'sampledFrames',
    'fps',
    'avgFrameMs',
    'p95FrameMs',
    'p99FrameMs',
    'maxFrameMs',
    'longTaskCount',
    'longTaskMaxMs',
  ]

  const segmentLabels = [...new Set(runSummaries.flatMap((run) => run.segments.map((segment) => segment.label)))]

  return segmentLabels.map((label) => {
    const labelSegments = runSummaries
      .map((run) => run.segments.find((segment) => segment.label === label))
      .filter((segment) => Boolean(segment))

    const result = { label }
    for (const field of segmentFields) {
      const values = labelSegments
        .map((segment) => Number(segment[field]))
        .filter((value) => Number.isFinite(value))
      result[field] = round(median(values))
    }
    return result
  })
}

function extractMedianHotspots(hotspotRuns, runCount, topN = 5) {
  if (!hotspotRuns.length) return null

  const segmentLabels = [...new Set(hotspotRuns.flatMap((run) =>
    (run.report?.segments ?? []).map((segment) => segment.label)))]

  const segments = segmentLabels.map((label) => {
    const segmentPerRun = hotspotRuns.map((run) => {
      const segment = (run.report?.segments ?? []).find((entry) => entry.label === label)
      return segment ?? null
    })

    const longTaskCountValues = segmentPerRun
      .filter((segment) => segment)
      .map((segment) => readNumber(segment.longTaskCount))
    const totalLongTaskMsValues = segmentPerRun
      .filter((segment) => segment)
      .map((segment) => readNumber(segment.totalLongTaskMs))

    const sourceCounts = {}
    for (const segment of segmentPerRun) {
      if (!segment?.source) continue
      sourceCounts[segment.source] = (sourceCounts[segment.source] ?? 0) + 1
    }
    const source = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'

    const offenderKeys = new Set(segmentPerRun.flatMap((segment) =>
      (segment?.offenders ?? []).map((offender) => offender.key)))

    const offenders = []
    for (const key of offenderKeys) {
      const totalMsSeries = segmentPerRun.map((segment) => {
        if (!segment) return 0
        const offender = (segment.offenders ?? []).find((entry) => entry.key === key)
        return readNumber(offender?.totalMs)
      })
      const countSeries = segmentPerRun.map((segment) => {
        if (!segment) return 0
        const offender = (segment.offenders ?? []).find((entry) => entry.key === key)
        return readNumber(offender?.count)
      })
      const maxMsSeries = segmentPerRun.map((segment) => {
        if (!segment) return 0
        const offender = (segment.offenders ?? []).find((entry) => entry.key === key)
        return readNumber(offender?.maxMs)
      })

      const coverageRuns = totalMsSeries.filter((value) => value > 0).length
      const medianTotalMs = round(median(totalMsSeries))
      if (medianTotalMs <= 0) continue

      offenders.push({
        key,
        coverageRuns,
        coveragePct: round((coverageRuns * 100) / Math.max(runCount, 1)),
        medianTotalMs,
        medianCount: round(median(countSeries)),
        medianMaxMs: round(median(maxMsSeries)),
      })
    }

    offenders.sort((a, b) => {
      if (b.medianTotalMs !== a.medianTotalMs) return b.medianTotalMs - a.medianTotalMs
      if (b.coverageRuns !== a.coverageRuns) return b.coverageRuns - a.coverageRuns
      return b.medianCount - a.medianCount
    })

    return {
      label,
      source,
      runsWithSegment: segmentPerRun.filter(Boolean).length,
      medianLongTaskCount: round(median(longTaskCountValues)),
      medianTotalLongTaskMs: round(median(totalLongTaskMsValues)),
      offenders: offenders.slice(0, topN),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    runCount,
    runsWithHotspots: hotspotRuns.length,
    segments,
  }
}

function formatHotspotsMarkdown(hotspots) {
  const lines = []
  lines.push('# Playwright Profiling Hotspot Summary')
  lines.push('')
  lines.push(`- Generated: ${hotspots.generatedAt}`)
  lines.push(`- Runs with hotspot data: ${hotspots.runsWithHotspots}/${hotspots.runCount}`)
  lines.push('')
  lines.push('| Segment | Source | Median long tasks | Median long-task ms | Top offenders |')
  lines.push('|---|---|---:|---:|---|')
  for (const segment of hotspots.segments) {
    const offenders = segment.offenders.length
      ? segment.offenders
        .map((offender) => `${offender.key} (${offender.medianTotalMs}ms, ${offender.coverageRuns}/${hotspots.runCount})`)
        .join('<br>')
      : '_none_'
    lines.push(`| ${segment.label} | ${segment.source} | ${segment.medianLongTaskCount} | ${segment.medianTotalLongTaskMs} | ${offenders} |`)
  }
  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push('- Hotspots are aggregated from per-run `hotspots.json` traces.')
  lines.push('- Offender values are medians across runs (missing offender in a run counts as 0 for that run).')
  return `${lines.join('\n')}\n`
}

function formatHotspotsPrCommentMarkdown(hotspots, gitCommit) {
  const lines = []
  lines.push('### Playwright Trace Hotspots (Median)')
  lines.push('')
  lines.push(`Commit: \`${gitCommit}\`  |  Runs: ${hotspots.runsWithHotspots}/${hotspots.runCount}`)
  lines.push('')
  lines.push('| Segment | Median long-task ms | Top offenders (median ms, coverage) |')
  lines.push('|---|---:|---|')
  for (const segment of hotspots.segments) {
    const offenders = segment.offenders.slice(0, 3).length
      ? segment.offenders
        .slice(0, 3)
        .map((offender) => `${offender.key} (${offender.medianTotalMs}ms, ${offender.coverageRuns}/${hotspots.runCount})`)
        .join('<br>')
      : '_none_'
    lines.push(`| ${segment.label} | ${segment.medianTotalLongTaskMs} | ${offenders} |`)
  }
  lines.push('')
  lines.push('_Generated by `perf:profile:repeat` hotspot aggregation._')
  return `${lines.join('\n')}\n`
}

function formatMarkdown({ generatedAt, repeat, gitCommit, outRootPath, runs, medianAggregate, medianSegments, hotspots }) {
  const lines = []
  lines.push('# Playwright Profiling Repeat Summary')
  lines.push('')
  lines.push(`- Generated: ${generatedAt}`)
  lines.push(`- Runs: ${repeat}`)
  lines.push(`- Commit: ${gitCommit}`)
  lines.push(`- Output root: ${outRootPath}`)
  lines.push('')
  lines.push('## Per-run Aggregate')
  lines.push('')
  lines.push('| Run | Output | Weighted FPS | Worst p99 frame (ms) | Worst max frame (ms) | Long tasks |')
  lines.push('|---|---|---:|---:|---:|---:|')
  for (const run of runs) {
    lines.push(`| ${run.run} | ${run.output} | ${run.aggregate.weightedAvgFps} | ${run.aggregate.worstP99FrameMs} | ${run.aggregate.worstMaxFrameMs} | ${run.aggregate.longTaskCount} |`)
  }
  lines.push('')
  lines.push('## Median Aggregate')
  lines.push('')
  lines.push(`- Weighted FPS: ${medianAggregate.weightedAvgFps}`)
  lines.push(`- Worst p99 frame (ms): ${medianAggregate.worstP99FrameMs}`)
  lines.push(`- Worst max frame (ms): ${medianAggregate.worstMaxFrameMs}`)
  lines.push(`- Long tasks: ${medianAggregate.longTaskCount}`)
  lines.push('')
  lines.push('## Median Segments')
  lines.push('')
  lines.push('| Segment | Duration (ms) | FPS | p95 frame (ms) | p99 frame (ms) | Max frame (ms) | Long tasks |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const segment of medianSegments) {
    lines.push(`| ${segment.label} | ${segment.durationMs} | ${segment.fps} | ${segment.p95FrameMs} | ${segment.p99FrameMs} | ${segment.maxFrameMs} | ${segment.longTaskCount} |`)
  }

  if (hotspots) {
    lines.push('')
    lines.push('## Median Hotspots')
    lines.push('')
    lines.push('| Segment | Source | Median long tasks | Median long-task ms | Top offenders |')
    lines.push('|---|---|---:|---:|---|')
    for (const segment of hotspots.segments) {
      const offenders = segment.offenders.length
        ? segment.offenders
          .map((offender) => `${offender.key} (${offender.medianTotalMs}ms, ${offender.coverageRuns}/${hotspots.runCount})`)
          .join('<br>')
        : '_none_'
      lines.push(`| ${segment.label} | ${segment.source} | ${segment.medianLongTaskCount} | ${segment.medianTotalLongTaskMs} | ${offenders} |`)
    }
  }

  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push('- Each run directory (`run-XX`) includes full trace artifacts from the single-run harness.')
  lines.push('- The median numbers are robust against one-off machine jitter and are preferred for commit comparisons.')
  if (hotspots) {
    lines.push('- Hotspot summaries are emitted in `hotspots-summary.md` and `hotspots-pr-comment.md`.')
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  await mkdir(outRoot, { recursive: true })

  let gitCommit = 'unknown'
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    // no-op
  }

  const runSummaries = []
  const runRows = []
  const hotspotRuns = []

  for (let index = 0; index < repeatCount; index += 1) {
    const runNumber = index + 1
    const runDirName = `run-${String(runNumber).padStart(2, '0')}`
    const runDir = path.join(outRoot, runDirName)
    const env = {
      ...process.env,
      PROFILE_OUT_DIR: runDir,
    }

    if (index > 0 && process.env.PROFILE_SKIP_BUILD === undefined) {
      env.PROFILE_SKIP_BUILD = '1'
    }

    console.log(`[repeat] Starting run ${runNumber}/${repeatCount} -> ${runDir}`)
    if (env.PROFILE_SKIP_BUILD === '1') {
      console.log('[repeat] PROFILE_SKIP_BUILD=1 for this run')
    }

    await run(process.execPath, [singleRunScript], { inheritStdio: true, env })

    const summaryPath = path.join(runDir, 'summary.json')
    const summaryRaw = await readFile(summaryPath, 'utf8')
    const summary = JSON.parse(summaryRaw)

    runSummaries.push(summary)
    runRows.push({
      run: runNumber,
      output: runDirName,
      aggregate: summary.aggregate,
    })

    try {
      const hotspotPath = path.join(runDir, 'hotspots.json')
      const hotspotRaw = await readFile(hotspotPath, 'utf8')
      const hotspot = JSON.parse(hotspotRaw)
      if (Array.isArray(hotspot?.segments) && hotspot.segments.length) {
        hotspotRuns.push({ run: runNumber, output: runDirName, report: hotspot })
      }
    } catch {
      // Keep repeat profiling usable if hotspot artifact is absent.
    }
  }

  const medianAggregate = extractMedianAggregate(runSummaries)
  const medianSegments = extractMedianSegments(runSummaries)

  const medianSummary = {
    generatedAt: new Date().toISOString(),
    repeat: repeatCount,
    gitCommit,
    outRoot,
    runs: runRows,
    median: {
      aggregate: medianAggregate,
      segments: medianSegments,
    },
  }

  const hotspots = extractMedianHotspots(hotspotRuns, runSummaries.length)
  if (hotspots) {
    medianSummary.hotspots = hotspots
  }

  const jsonPath = path.join(outRoot, 'median-summary.json')
  const markdownPath = path.join(outRoot, 'median-summary.md')
  const hotspotsJsonPath = path.join(outRoot, 'hotspots-summary.json')
  const hotspotsMarkdownPath = path.join(outRoot, 'hotspots-summary.md')
  const hotspotsPrCommentPath = path.join(outRoot, 'hotspots-pr-comment.md')

  await writeFile(jsonPath, `${JSON.stringify(medianSummary, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, formatMarkdown({
    generatedAt: medianSummary.generatedAt,
    repeat: repeatCount,
    gitCommit,
    outRootPath: outRoot,
    runs: runRows,
    medianAggregate,
    medianSegments,
    hotspots,
  }), 'utf8')

  if (hotspots) {
    await writeFile(hotspotsJsonPath, `${JSON.stringify(hotspots, null, 2)}\n`, 'utf8')
    await writeFile(hotspotsMarkdownPath, formatHotspotsMarkdown(hotspots), 'utf8')
    await writeFile(hotspotsPrCommentPath, formatHotspotsPrCommentMarkdown(hotspots, gitCommit), 'utf8')
  }

  console.log(`[repeat] Done. Median artifacts written to ${outRoot}`)
  console.log(`[repeat] Median weighted FPS: ${medianAggregate.weightedAvgFps}`)
  console.log(`[repeat] Median worst p99 frame: ${medianAggregate.worstP99FrameMs} ms`)
  console.log(`[repeat] Median long tasks: ${medianAggregate.longTaskCount}`)
  if (hotspots) {
    console.log(`[repeat] Hotspot summary: ${hotspotsMarkdownPath}`)
    for (const segment of hotspots.segments) {
      const preview = segment.offenders.slice(0, 2)
        .map((offender) => `${offender.key} ${offender.medianTotalMs}ms (${offender.coverageRuns}/${hotspots.runCount})`)
        .join(' | ')
      console.log(`[repeat][hotspots] ${segment.label}: ${preview || 'none'}`)
    }
    console.log(`[repeat] PR comment markdown: ${hotspotsPrCommentPath}`)
  } else {
    console.log('[repeat] No hotspot artifacts found across runs; skipped hotspot summary.')
  }
}

main().catch((err) => {
  console.error('[repeat] Failed:', err)
  process.exitCode = 1
})
