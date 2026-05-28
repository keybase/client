import * as fs from 'fs'
import * as path from 'path'
import {createRequire} from 'module'
import {buildPage} from './generate-ios-report.mts'

const require = createRequire(import.meta.url)
const {PNG} = require('pngjs') as {PNG: {sync: {read: (buf: Buffer) => {data: Buffer; width: number; height: number}}}}

const resultsPath = 'tests/results/report/results.json'
const prevDir = 'tests/results/electron-prev'
const outputPath = 'tests/results/electron-report.html'

type Attachment = {name: string; contentType: string; body?: string; path?: string}
type PlaywrightResult = {status: string; duration: number; attachments: Attachment[]; errors?: Array<{message?: string}>}
type PlaywrightTest = {status: string; projectName: string; results: PlaywrightResult[]}
type PlaywrightSpec = {title: string; ok: boolean; tests: PlaywrightTest[]}
type PlaywrightSuite = {title: string; specs: PlaywrightSpec[]; suites?: PlaywrightSuite[]}
type Report = {suites: PlaywrightSuite[]}

type DiffResult = {pct: number; changed: number; total: number}

type TestCase = {
  key: string
  label: string
  passed: boolean
  durationMs: number
  screenshotB64: string | null
  prevScreenshotPath: string | null
  diff: DiffResult | null
  errorMessage: string | null
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function flattenSpecs(suite: PlaywrightSuite): Array<{suiteName: string; spec: PlaywrightSpec}> {
  const out: Array<{suiteName: string; spec: PlaywrightSpec}> = []
  const name = suite.title.replace(/^.*\//, '').replace(/\.test\.ts$/, '')
  for (const spec of suite.specs) out.push({suiteName: name, spec})
  for (const child of suite.suites ?? []) out.push(...flattenSpecs(child))
  return out
}

function computeDiff(bufA: Buffer, pathB: string): DiffResult | null {
  try {
    const a = PNG.sync.read(bufA)
    const b = PNG.sync.read(fs.readFileSync(pathB))
    if (a.width !== b.width || a.height !== b.height) return null
    const total = a.width * a.height
    let changed = 0
    for (let i = 0; i < a.data.length; i += 4) {
      if (Math.abs(a.data[i]! - b.data[i]!) + Math.abs(a.data[i + 1]! - b.data[i + 1]!) + Math.abs(a.data[i + 2]! - b.data[i + 2]!) > 45) changed++
    }
    return {pct: (changed / total) * 100, changed, total}
  } catch {
    return null
  }
}

function parseReport(report: Report): TestCase[] {
  const cases: TestCase[] = []
  for (const suite of report.suites) {
    for (const {suiteName, spec} of flattenSpecs(suite)) {
      const key = `${slugify(suiteName)}-${slugify(spec.title)}`
      // take the last non-skipped result (handles retries)
      const allResults = spec.tests.flatMap(t => t.results)
      const result = allResults.filter(r => r.status !== 'skipped').at(-1) ?? allResults.at(-1)
      if (!result) continue

      const passed = spec.ok
      const durationMs = result.duration
      const errorMessage = !passed
        ? (result.errors?.[0]?.message?.split('\n')[0] ?? 'test failed')
        : null

      const screenshotAtt = result.attachments.find(a => a.name === 'screenshot' && a.contentType === 'image/png')
      const screenshotB64 = screenshotAtt?.body
        ?? (screenshotAtt?.path ? fs.readFileSync(screenshotAtt.path).toString('base64') : null)

      const prevPath = path.join(prevDir, `${key}.png`)
      const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null

      let diff: DiffResult | null = null
      if (screenshotB64 && prevScreenshotPath) {
        diff = computeDiff(Buffer.from(screenshotB64, 'base64'), prevScreenshotPath)
      }

      cases.push({
        key,
        label: `${suiteName} · ${spec.title}`,
        passed,
        durationMs,
        screenshotB64,
        prevScreenshotPath,
        diff,
        errorMessage,
      })
    }
  }
  return cases
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function buildHtml(cases: TestCase[], timestamp: string): string {
  const totalPassed = cases.filter(c => c.passed).length
  const totalFailed = cases.length - totalPassed
  const allPassed = totalFailed === 0
  const hasDiff = cases.some(c => c.diff !== null)

  const cards = cases.map((c, i) => {
    const badge = c.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>'
    const error = c.errorMessage ? `<div class="error">${c.errorMessage}</div>` : ''
    const deltaBadge = c.diff
      ? `<span class="badge ${c.diff.pct < 1 ? 'diff-low' : c.diff.pct < 5 ? 'diff-mid' : 'diff-high'}" title="${c.diff.changed.toLocaleString()} of ${c.diff.total.toLocaleString()} pixels changed">Δ ${c.diff.pct.toFixed(1)}%</span>`
      : ''

    let visual: string
    if (c.screenshotB64 && c.prevScreenshotPath) {
      const curUrl = `data:image/png;base64,${c.screenshotB64}`
      const prevUrl = `data:image/png;base64,${fs.readFileSync(c.prevScreenshotPath).toString('base64')}`
      visual = `<div class="compare" id="cmp${i}">
  <img class="img-after" src="${curUrl}" alt="current">
  <img class="img-before" src="${prevUrl}" alt="baseline">
  <div class="handle"><div class="grip">⇔</div></div>
  <div class="lbl lbl-l">BASELINE</div>
  <div class="lbl lbl-r">NOW</div>
</div>`
    } else if (c.screenshotB64) {
      visual = `<div class="solo-wrap"><img class="solo" src="data:image/png;base64,${c.screenshotB64}" alt="${c.label}"></div>`
    } else {
      visual = `<div class="empty">No screenshot</div>`
    }

    return `<div class="card ${c.passed ? 'ok' : 'fail'}">
  <div class="hdr">${badge}${deltaBadge}<span class="name">${c.label}</span><span class="dur">${formatDuration(c.durationMs)}</span>${error}</div>
  ${visual}
</div>`
  }).join('\n')

  return buildPage('Keybase Electron E2E Tests', allPassed, totalPassed, totalFailed, cases.length, hasDiff, timestamp, cards)
}

// Save baseline: write current screenshots as PNGs to prevDir
function saveBaseline(cases: TestCase[]) {
  fs.mkdirSync(prevDir, {recursive: true})
  let saved = 0
  for (const c of cases) {
    if (!c.screenshotB64) continue
    fs.writeFileSync(path.join(prevDir, `${c.key}.png`), Buffer.from(c.screenshotB64, 'base64'))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${prevDir}/`)
}

function main() {
  const isSaveBaseline = process.argv.includes('--save-baseline')

  if (!fs.existsSync(resultsPath)) {
    console.error(`Results not found: ${resultsPath}`)
    console.error('Run yarn test:e2e:smoke first.')
    process.exit(1)
  }

  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Report
  const cases = parseReport(report)

  if (cases.length === 0) {
    console.error('No test cases found in', resultsPath)
    process.exit(1)
  }

  if (isSaveBaseline) {
    saveBaseline(cases)
    return
  }

  const timestamp = new Date().toLocaleString()
  const html = buildHtml(cases, timestamp)
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)

  const withDiff = cases.filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  console.log(`Report written to ${outputPath} (${cases.filter(c => c.passed).length}/${cases.length} passed${diffNote})`)
}

main()
