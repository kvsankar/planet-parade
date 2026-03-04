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

function formatMarkdown({ generatedAt, repeat, gitCommit, outRootPath, runs, medianAggregate, medianSegments }) {
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
  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push('- Each run directory (`run-XX`) includes full trace artifacts from the single-run harness.')
  lines.push('- The median numbers are robust against one-off machine jitter and are preferred for commit comparisons.')
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

  const jsonPath = path.join(outRoot, 'median-summary.json')
  const markdownPath = path.join(outRoot, 'median-summary.md')

  await writeFile(jsonPath, `${JSON.stringify(medianSummary, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, formatMarkdown({
    generatedAt: medianSummary.generatedAt,
    repeat: repeatCount,
    gitCommit,
    outRootPath: outRoot,
    runs: runRows,
    medianAggregate,
    medianSegments,
  }), 'utf8')

  console.log(`[repeat] Done. Median artifacts written to ${outRoot}`)
  console.log(`[repeat] Median weighted FPS: ${medianAggregate.weightedAvgFps}`)
  console.log(`[repeat] Median worst p99 frame: ${medianAggregate.worstP99FrameMs} ms`)
  console.log(`[repeat] Median long tasks: ${medianAggregate.longTaskCount}`)
}

main().catch((err) => {
  console.error('[repeat] Failed:', err)
  process.exitCode = 1
})
