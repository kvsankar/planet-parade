#!/usr/bin/env node

import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { extractTraceHotspots, formatTraceHotspotsMarkdown } from './extract-trace-hotspots.mjs'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const DEFAULT_PORT = Number(process.env.PROFILE_PORT ?? 4173)
const DEFAULT_BASE_URL = process.env.PROFILE_BASE_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`
const OUT_ROOT = process.env.PROFILE_OUT_DIR ?? path.join('test-output', 'perf', new Date().toISOString().replace(/[:.]/g, '-'))
const TOUR_STORAGE_KEY = 'planet-parade-tour-seen'

const SKIP_BUILD = parseBool(process.env.PROFILE_SKIP_BUILD)
const SKIP_SERVER = parseBool(process.env.PROFILE_SKIP_SERVER)
const HEADLESS = !parseBool(process.env.PROFILE_HEADFUL)

const SEGMENTS = [
  { label: 'idle_initial', durationMs: 4_000 },
  { label: 'solar_playback', durationMs: 8_000 },
  { label: 'planetarium_playback', durationMs: 10_000 },
  { label: 'skychart_texture_playback', durationMs: 12_000 },
  { label: 'idle_final', durationMs: 3_000 },
]

function parseBool(value) {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.inheritStdio ? 'inherit' : 'pipe',
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString()
        stdout += text
        if (options.streamStdout) process.stdout.write(text)
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString()
        stderr += text
        if (options.streamStderr) process.stderr.write(text)
      })
    }

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

async function waitForServer(url, timeoutMs = 90_000) {
  const start = Date.now()
  let lastError = ''

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    await sleep(500)
  }

  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms (${lastError})`)
}

function waitForChildExit(child, timeoutMs = 4_000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true)
      return
    }

    const onExit = () => {
      clearTimeout(timer)
      child.off('close', onExit)
      resolve(true)
    }

    const timer = setTimeout(() => {
      child.off('close', onExit)
      resolve(false)
    }, timeoutMs)

    child.once('close', onExit)
  })
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return

  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  } else {
    child.kill('SIGTERM')
  }

  const exitedGracefully = await waitForChildExit(child)
  if (exitedGracefully) return

  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  } else {
    child.kill('SIGKILL')
  }

  await waitForChildExit(child, 2_000)
}

function getTraceStreamHandle(eventPayload) {
  if (!eventPayload || typeof eventPayload !== 'object') return null

  const payload = eventPayload
  const maybeParams = typeof payload.params === 'object' && payload.params ? payload.params : null

  for (const handle of [
    payload.stream,
    payload.streamHandle,
    maybeParams?.stream,
    maybeParams?.streamHandle,
  ]) {
    if (typeof handle === 'string' && handle.length) return handle
  }

  return null
}

function metricsToMap(metrics) {
  const map = {}
  for (const metric of metrics) map[metric.name] = metric.value
  return map
}

function diffMetrics(before, after) {
  const keys = [
    'TaskDuration',
    'ScriptDuration',
    'LayoutDuration',
    'RecalcStyleDuration',
    'OtherDuration',
  ]
  const delta = {}
  for (const key of keys) {
    delta[key] = (after[key] ?? 0) - (before[key] ?? 0)
  }
  delta.JSHeapUsedSize = after.JSHeapUsedSize ?? 0
  delta.JSHeapTotalSize = after.JSHeapTotalSize ?? 0
  return delta
}

function maybeMetricTimestampSeconds(metrics) {
  const raw = Number(metrics?.Timestamp)
  if (!Number.isFinite(raw)) return null
  return Number(raw.toFixed(6))
}

function aggregateSegments(segments) {
  const totalMs = segments.reduce((sum, s) => sum + s.durationMs, 0)
  const weightedFps = segments.reduce((sum, s) => sum + (s.fps * s.durationMs), 0) / Math.max(totalMs, 1)
  const worstP99 = Math.max(...segments.map((s) => s.p99FrameMs))
  const worstMax = Math.max(...segments.map((s) => s.maxFrameMs))
  const longTasks = segments.reduce((sum, s) => sum + s.longTaskCount, 0)
  return {
    totalProfileMs: totalMs,
    weightedAvgFps: Number(weightedFps.toFixed(2)),
    worstP99FrameMs: Number(worstP99.toFixed(2)),
    worstMaxFrameMs: Number(worstMax.toFixed(2)),
    longTaskCount: longTasks,
  }
}

function formatSummaryMarkdown({ startedAt, endedAt, config, gitCommit, segments, aggregate }) {
  const lines = []
  lines.push('# Playwright Profiling Summary')
  lines.push('')
  lines.push(`- Started: ${startedAt}`)
  lines.push(`- Ended: ${endedAt}`)
  lines.push(`- Commit: ${gitCommit}`)
  lines.push(`- Base URL: ${config.baseUrl}`)
  lines.push(`- Headless: ${config.headless}`)
  lines.push('')
  lines.push('## Aggregate')
  lines.push('')
  lines.push(`- Weighted FPS: ${aggregate.weightedAvgFps}`)
  lines.push(`- Worst p99 frame (ms): ${aggregate.worstP99FrameMs}`)
  lines.push(`- Worst max frame (ms): ${aggregate.worstMaxFrameMs}`)
  lines.push(`- Long tasks: ${aggregate.longTaskCount}`)
  lines.push('')
  lines.push('## Segments')
  lines.push('')
  lines.push('| Segment | Duration (ms) | FPS | p95 frame (ms) | p99 frame (ms) | Max frame (ms) | Long tasks |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const segment of segments) {
    lines.push(`| ${segment.label} | ${segment.durationMs} | ${segment.fps} | ${segment.p95FrameMs} | ${segment.p99FrameMs} | ${segment.maxFrameMs} | ${segment.longTaskCount} |`)
  }
  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push('- Chrome trace is saved as `chrome-trace.json` in this artifact folder.')
  lines.push('- Derived long-task hotspots are saved as `hotspots.json` and `hotspots.md`.')
  lines.push('- Playwright interaction trace is saved as `playwright-trace.zip`.')
  return `${lines.join('\n')}\n`
}

async function readCdpStream(cdp, stream) {
  let content = ''
  while (true) {
    const chunk = await cdp.send('IO.read', { handle: stream })
    content += chunk.data
    if (chunk.eof) break
  }
  await cdp.send('IO.close', { handle: stream })
  return content
}

async function captureFrameStats(page, durationMs) {
  return page.evaluate(async ({ durationMs: ms }) => {
    function percentile(sorted, p) {
      if (!sorted.length) return 0
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
      return sorted[idx]
    }

    const frameDeltas = []
    const longTasks = []
    let observer = null

    if ('PerformanceObserver' in window) {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration)
        })
        observer.observe({ type: 'longtask', buffered: true })
      } catch {
        observer = null
      }
    }

    const start = performance.now()

    await new Promise((resolve) => {
      let last = start
      const tick = (now) => {
        const dt = now - last
        last = now
        if (dt > 0 && dt < 1000) frameDeltas.push(dt)
        if (now - start >= ms) {
          resolve(null)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    if (observer) observer.disconnect()

    const sorted = [...frameDeltas].sort((a, b) => a - b)
    const avgFrameMs = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
    const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0

    return {
      sampledFrames: sorted.length,
      avgFrameMs,
      fps,
      p95FrameMs: percentile(sorted, 95),
      p99FrameMs: percentile(sorted, 99),
      maxFrameMs: sorted.length ? sorted[sorted.length - 1] : 0,
      longTaskCount: longTasks.length,
      longTaskMaxMs: longTasks.length ? Math.max(...longTasks) : 0,
    }
  }, { durationMs })
}

async function safeClick(locator) {
  if (await locator.count() === 0) return false
  const first = locator.first()
  await first.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null)
  if (!(await first.isVisible())) return false
  await first.click({ timeout: 10_000, trial: true }).catch(() => null)
  await first.click({ timeout: 10_000 })
  return true
}

async function dismissDriverOverlay(page) {
  const closeButtons = [
    page.locator('.driver-popover .driver-popover-close-btn'),
    page.locator('.driver-popover .driver-popover-close-btn-text'),
    page.getByRole('button', { name: /^skip$/i }),
    page.getByRole('button', { name: /^close$/i }),
  ]

  for (const button of closeButtons) {
    if (await button.count()) {
      const first = button.first()
      if (await first.isVisible().catch(() => false)) {
        await first.click({ timeout: 2_000 }).catch(() => null)
      }
    }
  }

  // Hard cleanup fallback for detached/partially rendered tour layers.
  await page.evaluate(() => {
    for (const selector of ['.driver-overlay', '.driver-popover', '.driver-active-element']) {
      document.querySelectorAll(selector).forEach((el) => el.remove())
    }
  })
}

async function markSegmentBoundary(page, phase, label) {
  await page.evaluate(({ phaseName, segmentLabel }) => {
    try {
      performance.mark(`perf.segment.${phaseName}:${segmentLabel}`)
    } catch {
      // Ignore user-timing failures in restricted environments.
    }
  }, {
    phaseName: phase,
    segmentLabel: label,
  })
}

async function runScenario(page, cdp, segments) {
  const results = []

  for (const segment of segments) {
    if (segment.label === 'solar_playback') {
      await dismissDriverOverlay(page)
      await safeClick(page.locator('.playback-bar .play-btn'))
    }

    if (segment.label === 'planetarium_playback') {
      await safeClick(page.locator('.scene-view-tab').filter({ hasText: 'Planetarium' }))
      await sleep(700)
    }

    if (segment.label === 'skychart_texture_playback') {
      await safeClick(page.locator('.scene-view-tab').filter({ hasText: 'Solar System' }))
      await sleep(400)
      await safeClick(page.locator('.skychart-layer-btn'))
      await safeClick(page.locator('.skychart-mw-pill').filter({ hasText: 'Tex' }))
      await sleep(400)
    }

    if (segment.label === 'idle_final') {
      await safeClick(page.locator('.playback-bar .play-btn'))
    }

    await markSegmentBoundary(page, 'start', segment.label)
    const beforeMetrics = metricsToMap((await cdp.send('Performance.getMetrics')).metrics)
    const frameStats = await captureFrameStats(page, segment.durationMs)
    await markSegmentBoundary(page, 'end', segment.label)
    const afterMetrics = metricsToMap((await cdp.send('Performance.getMetrics')).metrics)

    results.push({
      label: segment.label,
      durationMs: segment.durationMs,
      sampledFrames: frameStats.sampledFrames,
      fps: Number(frameStats.fps.toFixed(2)),
      avgFrameMs: Number(frameStats.avgFrameMs.toFixed(2)),
      p95FrameMs: Number(frameStats.p95FrameMs.toFixed(2)),
      p99FrameMs: Number(frameStats.p99FrameMs.toFixed(2)),
      maxFrameMs: Number(frameStats.maxFrameMs.toFixed(2)),
      longTaskCount: frameStats.longTaskCount,
      longTaskMaxMs: Number(frameStats.longTaskMaxMs.toFixed(2)),
      metricTimestampStartSec: maybeMetricTimestampSeconds(beforeMetrics),
      metricTimestampEndSec: maybeMetricTimestampSeconds(afterMetrics),
      cdpDelta: diffMetrics(beforeMetrics, afterMetrics),
    })
  }

  return results
}

async function main() {
  const startedAt = new Date().toISOString()
  await mkdir(OUT_ROOT, { recursive: true })

  const config = {
    baseUrl: DEFAULT_BASE_URL,
    port: DEFAULT_PORT,
    headless: HEADLESS,
    skipBuild: SKIP_BUILD,
    skipServer: SKIP_SERVER,
  }

  let gitCommit = 'unknown'
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    // no-op
  }

  if (!SKIP_BUILD) {
    console.log('[profile] Building app...')
    await run(npmCmd, ['run', 'build'], { inheritStdio: true })
  }

  let server = null
  let browser = null
  let context = null
  let page = null
  let cdp = null
  let playwrightTracePath = null
  let playwrightTraceStopped = false

  try {
    if (!SKIP_SERVER) {
      console.log(`[profile] Starting preview server on ${config.baseUrl} ...`)
      server = spawn(npmCmd, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(config.port), '--strictPort'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: process.env,
        detached: process.platform !== 'win32',
      })
      server.stdout?.on('data', (chunk) => process.stdout.write(`[preview] ${chunk.toString()}`))
      server.stderr?.on('data', (chunk) => process.stderr.write(`[preview] ${chunk.toString()}`))
      await waitForServer(config.baseUrl)
    }

    browser = await chromium.launch({
      headless: config.headless,
      args: ['--enable-precise-memory-info'],
    })
    context = await browser.newContext({ viewport: { width: 1720, height: 980 } })
    await context.addInitScript(({ storageKey }) => {
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        // Ignore storage failures.
      }
    }, { storageKey: TOUR_STORAGE_KEY })
    await context.tracing.start({ screenshots: true, snapshots: false, sources: false })
    playwrightTracePath = path.join(OUT_ROOT, 'playwright-trace.zip')

    page = await context.newPage()
    cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')

    const traceCompletePromise = new Promise((resolve) => {
      cdp.once('Tracing.tracingComplete', resolve)
    })

    await cdp.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        'disabled-by-default-devtools.timeline.stack',
        'blink.user_timing',
        'loading',
        'toplevel',
        'v8.execute',
      ].join(','),
      transferMode: 'ReturnAsStream',
    })

    console.log(`[profile] Navigating to ${config.baseUrl} ...`)
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' })
    await page.waitForSelector('.scene-view-toggle', { timeout: 30_000 })
    await dismissDriverOverlay(page)
    await page.waitForTimeout(1000)

    const segments = await runScenario(page, cdp, SEGMENTS)

    await cdp.send('Tracing.end')
    const traceComplete = await traceCompletePromise
    const traceStreamHandle = getTraceStreamHandle(traceComplete)
    if (!traceStreamHandle) {
      throw new Error(`Tracing completed without stream handle: ${JSON.stringify(traceComplete)}`)
    }
    const traceContent = await readCdpStream(cdp, traceStreamHandle)

    const aggregate = aggregateSegments(segments)
    const endedAt = new Date().toISOString()

    const summary = {
      startedAt,
      endedAt,
      gitCommit,
      config,
      segments,
      aggregate,
      artifacts: {
        chromeTrace: 'chrome-trace.json',
        hotspotsJson: 'hotspots.json',
        hotspotsMarkdown: 'hotspots.md',
        playwrightTrace: 'playwright-trace.zip',
      },
    }

    const summaryPath = path.join(OUT_ROOT, 'summary.json')
    const markdownPath = path.join(OUT_ROOT, 'summary.md')
    const chromeTracePath = path.join(OUT_ROOT, 'chrome-trace.json')
    const hotspotsJsonPath = path.join(OUT_ROOT, 'hotspots.json')
    const hotspotsMarkdownPath = path.join(OUT_ROOT, 'hotspots.md')
    const screenshotPath = path.join(OUT_ROOT, 'final-screen.png')

    let hotspots = null
    try {
      hotspots = extractTraceHotspots({
        trace: JSON.parse(traceContent),
        summary,
      })
      await writeFile(hotspotsJsonPath, `${JSON.stringify(hotspots, null, 2)}\n`, 'utf8')
      await writeFile(hotspotsMarkdownPath, formatTraceHotspotsMarkdown(hotspots), 'utf8')
    } catch (error) {
      // Keep the profiling run usable even if hotspot derivation fails.
      console.warn('[profile] Hotspot extraction failed:', error instanceof Error ? error.message : String(error))
      delete summary.artifacts.hotspotsJson
      delete summary.artifacts.hotspotsMarkdown
    }

    await page.screenshot({ path: screenshotPath, fullPage: true })
    await writeFile(chromeTracePath, traceContent, 'utf8')
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    await writeFile(markdownPath, formatSummaryMarkdown({ startedAt, endedAt, config, gitCommit, segments, aggregate }), 'utf8')
    await context.tracing.stop({ path: playwrightTracePath })
    playwrightTraceStopped = true

    console.log(`[profile] Done. Artifacts written to ${OUT_ROOT}`)
    console.log(`[profile] Weighted FPS: ${aggregate.weightedAvgFps}`)
    console.log(`[profile] Worst p99 frame: ${aggregate.worstP99FrameMs} ms`)
    console.log(`[profile] Long tasks: ${aggregate.longTaskCount}`)
    if (hotspots) {
      console.log(`[profile] Hotspots: ${hotspotsJsonPath}`)
    }
  } finally {
    if (context && !playwrightTraceStopped) {
      try {
        await context.tracing.stop({ path: path.join(OUT_ROOT, 'playwright-trace.partial.zip') })
      } catch {
        // Ignore partial trace stop errors.
      }
    }

    if (cdp) {
      try {
        await cdp.detach()
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (context) {
      try {
        await context.close()
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (server) {
      await stopChildProcess(server)
    }
  }
}

main().catch((err) => {
  console.error('[profile] Failed:', err)
  process.exitCode = 1
})
