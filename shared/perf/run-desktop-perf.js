#!/usr/bin/env node
/* global __dirname, console, process, require, window */
// Automated desktop performance test.
// Connects to a running Electron app via CDP, navigates to a screen, scrolls, and saves FPS + React render stats.
//
// Prerequisites:
//   - App running: yarn start-hot-debug
//   - playwright-core installed globally: yarn global add playwright-core
//
// Capture:  node perf/run-desktop-perf.js [--flow <name>] [--runs N] [--no-navigate]
// Compare:  node perf/run-desktop-perf.js --compare <baseline-a> <baseline-b>
//
// Flows: thread (default), inbox

const fs = require('fs')
const path = require('path')
const {execSync} = require('child_process')
const {compareBaselines, resolveBaseline} = require('./compare-perf.js')

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(name)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return fallback
}
function hasFlag(name) {
  return args.includes(name)
}

// --- Compare mode: offline, no CDP connection needed ---
if (hasFlag('--compare')) {
  const idx = args.indexOf('--compare')
  const aArg = args[idx + 1]
  const bArg = args[idx + 2]
  if (!aArg || !bArg) {
    console.error('Usage: --compare <baseline-a> <baseline-b>')
    process.exit(1)
  }
  compareBaselines(resolveBaseline(aArg), resolveBaseline(bArg))
  process.exit(0)
}

// --- Flow definitions ---
// Each flow: { label, navigate(page), scrollSelector }
// navigate is skipped when --no-navigate is passed.
const flows = {
  inbox: {
    label: 'Inbox scroll',
    navigate: async page => {
      await page.click('text=Chat')
      await page.waitForSelector('[data-testid="inbox-list"]', {timeout: 10000})
    },
    // LegendList renders an inner scroll container as first child of the testid div
    scrollSelector: '[data-testid="inbox-list"] > :first-child',
  },
  thread: {
    label: 'Thread scroll',
    navigate: async page => {
      await page.click('text=Chat')
      await page.waitForSelector('[data-testid="inbox-list"]', {timeout: 10000})
      await page.click('[data-testid="inbox-list"] > :first-child')
      await page.waitForSelector('[data-testid="message-list"]', {timeout: 10000})
    },
    scrollSelector: '[data-testid="message-list"]',
  },
}

// --- Capture mode ---
const flowName = getArg('--flow', 'thread')
const runs = parseInt(getArg('--runs', '3'), 10)
const noNavigate = hasFlag('--no-navigate')

const flow = flows[flowName]
if (!flow) {
  console.error(`Unknown flow: "${flowName}". Available: ${Object.keys(flows).join(', ')}`)
  process.exit(1)
}

const BASELINES_DIR = path.resolve(__dirname, 'baselines')
const INJECT_PATH = path.resolve(__dirname, 'desktop-perf-inject.js')

function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', {encoding: 'utf8'}).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {encoding: 'utf8'}).trim()
    return {branch, hash}
  } catch (_e) {
    return {branch: 'unknown', hash: 'unknown'}
  }
}

function resolveBaselineDir(hash) {
  const base = path.join(BASELINES_DIR, hash)
  if (!fs.existsSync(base)) return base
  let n = 1
  while (fs.existsSync(`${base}-${n}`)) n++
  return `${base}-${n}`
}

async function main() {
  let playwright
  try {
    playwright = require('playwright-core')
  } catch (_e) {
    try {
      const globalDir = execSync('yarn global dir', {encoding: 'utf8'}).trim()
      playwright = require(path.join(globalDir, 'node_modules', 'playwright-core'))
    } catch (_e2) {
      console.error('playwright-core not found. Install it: yarn global add playwright-core')
      process.exit(1)
    }
  }

  console.log(`Flow: ${flow.label}`)
  console.log('Connecting to Electron app on localhost:9222...')
  let browser
  try {
    browser = await playwright.chromium.connectOverCDP('http://localhost:9222')
  } catch (e) {
    console.error('Failed to connect. Is the app running with yarn start-hot-debug?')
    console.error(e.message)
    process.exit(1)
  }

  const contexts = browser.contexts()
  if (!contexts.length) { console.error('No browser contexts found.'); process.exit(1) }
  const pages = contexts[0].pages()
  if (!pages.length) { console.error('No pages found.'); process.exit(1) }
  const page = pages[0]
  console.log(`Connected. Page title: "${await page.title()}"`)

  if (!noNavigate) {
    console.log('Navigating...')
    await flow.navigate(page)
    console.log('Ready.')
  }

  const injectSrc = fs.readFileSync(INJECT_PATH, 'utf8')
  await page.evaluate(injectSrc)

  const hasReactProfiler = await page.evaluate(() => !!window.__perfReact)
  if (!hasReactProfiler) {
    console.log('  (window.__perfReact not found — React render stats unavailable)')
  }

  const results = []

  for (let i = 1; i <= runs; i++) {
    console.log(`\n--- Run ${i} of ${runs} ---`)

    if (hasReactProfiler) await page.evaluate(() => window.__perfReact.reset())
    await page.evaluate(() => window.__perf.start())
    await page.evaluate(
      ({selector}) =>
        window.__perf.scrollContainer(selector, {direction: 'down', distance: 8000, stepMs: 16, stepPx: 80}),
      {selector: flow.scrollSelector}
    )
    await page.evaluate(
      ({selector}) =>
        window.__perf.scrollContainer(selector, {direction: 'up', distance: 8000, stepMs: 16, stepPx: 80}),
      {selector: flow.scrollSelector}
    )
    const result = await page.evaluate(() => window.__perf.stop())
    if (hasReactProfiler) {
      result.react = await page.evaluate(() => window.__perfReact.aggregate())
    }
    results.push(result)

    console.log(`  FPS avg: ${result.fps.avg}  p5: ${result.fps.p5}  min: ${result.fps.min}  max: ${result.fps.max}`)
    console.log(`  Long tasks: ${result.longTasks.count}  totalMs: ${result.longTasks.totalMs}`)
    console.log(`  Memory: start=${result.memory.startHeapMB}MB  end=${result.memory.endHeapMB}MB  peak=${result.memory.peakHeapMB}MB`)
    if (result.react) {
      console.log(`  React: ${result.react.totalDurationMs}ms / ${result.react.totalRenders} renders`)
      for (const [id, stats] of Object.entries(result.react.components)) {
        const count = stats.mountCount + stats.updateCount
        console.log(`    ${id}: ${stats.totalMs}ms / ${count} renders (avg ${stats.avgMs}ms, max ${stats.maxMs}ms)`)
      }
    }
  }

  const sorted = [...results].sort((a, b) => a.fps.avg - b.fps.avg)
  const median = sorted[Math.floor(sorted.length / 2)]
  const medianIdx = results.indexOf(median) + 1
  console.log(`\n=== Selecting median run ===`)
  console.log(`  Median: run-${medianIdx} (fps.avg=${median.fps.avg})`)

  const {hash, branch} = getGitInfo()
  const baselineDir = resolveBaselineDir(hash)
  fs.mkdirSync(baselineDir, {recursive: true})

  fs.writeFileSync(path.join(baselineDir, 'perf.json'), JSON.stringify(median, null, 2))
  fs.writeFileSync(
    path.join(baselineDir, 'meta.json'),
    JSON.stringify({branch, date: new Date().toISOString(), flow: flowName, gitHash: hash, runs, script: 'run-desktop-perf.js'}, null, 2)
  )
  const relDir = path.relative(path.resolve(__dirname, '..'), baselineDir)
  console.log(`\n=== Baseline saved to ${relDir}/ ===`)
  console.log('  perf.json  meta.json')

  await browser.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
