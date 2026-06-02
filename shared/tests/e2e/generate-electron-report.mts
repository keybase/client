import * as fs from 'fs'
import * as path from 'path'
import {createRequire} from 'module'
import {buildPage} from './generate-ios-report.mts'

const require = createRequire(import.meta.url)
// pngjs is a transitive dep (via image-diff etc.) — intentionally not in package.json
const {PNG} = require('pngjs') as {PNG: {sync: {read: (buf: Buffer) => {data: Buffer; width: number; height: number}}}}

const resultsPath = 'tests/results/report/results.json'
const debugDir = 'tests/results/electron-debug'
const prevDir = 'tests/results/electron-prev'
const storybookDir = 'tests/results/storybook-desktop'
const storybookPrevDir = 'tests/results/storybook-prev'
const outputPath = 'tests/results/electron-report.html'

type Attachment = {name: string; contentType: string; body?: string; path?: string}
type PlaywrightResult = {status: string; duration: number; attachments: Attachment[]; errors?: Array<{message?: string}>}
type PlaywrightTest = {status: string; projectName: string; results: PlaywrightResult[]}
type PlaywrightSpec = {title: string; ok: boolean; tests: PlaywrightTest[]}
type PlaywrightSuite = {title: string; specs: PlaywrightSpec[]; suites?: PlaywrightSuite[]}
type Report = {suites: PlaywrightSuite[]}

type DiffResult = {pct: number; changed: number; total: number}

type StorybookCase = {
  relPath: string
  label: string
  screenshotPath: string
  prevScreenshotPath: string | null
  diff: DiffResult | null
}

type TestCase = {
  key: string
  label: string
  passed: boolean
  durationMs: number
  screenshotPath: string | null
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

function computeDiff(pathA: string, pathB: string): DiffResult | null {
  try {
    const a = PNG.sync.read(fs.readFileSync(pathA))
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
      const baseKey = `${slugify(suiteName)}-${slugify(spec.title)}`

      // Group by project so light and dark produce separate TestCase entries
      const byProject = new Map<string, PlaywrightTest[]>()
      for (const t of spec.tests) {
        const proj = t.projectName ?? ''
        if (!byProject.has(proj)) byProject.set(proj, [])
        byProject.get(proj)!.push(t)
      }

      for (const [projectName, tests] of byProject) {
        const isDark = projectName.endsWith('-dark')
        const key = isDark ? `${baseKey}-dark` : baseKey
        const label = isDark ? `${suiteName} · ${spec.title} (dark)` : `${suiteName} · ${spec.title}`

        // take the last non-skipped result (handles retries)
        const allResults = tests.flatMap(t => t.results)
        const result = allResults.filter(r => r.status !== 'skipped').at(-1) ?? allResults.at(-1)
        if (!result) continue

        const passed = tests.every(t => t.status === 'expected')
        const durationMs = result.duration
        const errorMessage = !passed
          ? (result.errors?.[0]?.message?.split('\n')[0] ?? 'test failed')
          : null

        const screenshotAtt = result.attachments.find(a => a.name === 'screenshot' && a.contentType === 'image/png')
        let screenshotPath: string | null = null
        if (screenshotAtt) {
          const buf = screenshotAtt.body
            ? Buffer.from(screenshotAtt.body, 'base64')
            : screenshotAtt.path ? fs.readFileSync(screenshotAtt.path) : null
          if (buf) {
            fs.mkdirSync(debugDir, {recursive: true})
            screenshotPath = path.join(debugDir, `${key}.png`)
            fs.writeFileSync(screenshotPath, buf)
          }
        }

        const prevPath = path.join(prevDir, `${key}.png`)
        const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
        const diff = screenshotPath && prevScreenshotPath ? computeDiff(screenshotPath, prevScreenshotPath) : null

        cases.push({key, label, passed, durationMs, screenshotPath, prevScreenshotPath, diff, errorMessage})
      }
    }
  }
  return cases
}

function parseStorybookScreenshots(): StorybookCase[] {
  if (!fs.existsSync(storybookDir)) return []
  const cases: StorybookCase[] = []
  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else if (entry.name.endsWith('.png')) {
        const label = relPath.replace('.png', '').replace('/', ' / ').replace(/-/g, ' ')
        const prevPath = path.join(storybookPrevDir, relPath)
        const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
        const diff = prevScreenshotPath ? computeDiff(fullPath, prevScreenshotPath) : null
        cases.push({relPath, label, screenshotPath: fullPath, prevScreenshotPath, diff})
      }
    }
  }
  walk(storybookDir, '')
  return cases.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

function saveStorybookBaseline(cases: StorybookCase[]) {
  fs.mkdirSync(storybookPrevDir, {recursive: true})
  let saved = 0
  for (const c of cases) {
    if (!fs.existsSync(c.screenshotPath)) continue
    const destDir = path.dirname(path.join(storybookPrevDir, c.relPath))
    fs.mkdirSync(destDir, {recursive: true})
    fs.copyFileSync(c.screenshotPath, path.join(storybookPrevDir, c.relPath))
    saved++
  }
  console.log(`Storybook baseline saved: ${saved} screenshots to ${storybookPrevDir}/`)
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml(cases: TestCase[], storybookCases: StorybookCase[], timestamp: string): string {
  const totalPassed = cases.filter(c => c.passed).length
  const totalFailed = cases.length - totalPassed
  const allPassed = totalFailed === 0
  const hasDiff = cases.some(c => c.diff !== null) || storybookCases.some(c => c.diff !== null)

  const rel = (p: string) => path.relative(path.dirname(outputPath), p)

  const e2eCards = cases.map((c, i) => {
    const badge = c.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>'
    const error = c.errorMessage ? `<div class="error">${escapeHtml(c.errorMessage)}</div>` : ''
    const deltaBadge = c.diff
      ? `<span class="badge ${c.diff.pct < 1 ? 'diff-low' : c.diff.pct < 5 ? 'diff-mid' : 'diff-high'}" title="${c.diff.changed.toLocaleString()} of ${c.diff.total.toLocaleString()} pixels changed">Δ ${c.diff.pct.toFixed(1)}%</span>`
      : ''

    let visual: string
    if (c.screenshotPath && c.prevScreenshotPath) {
      visual = `<div class="compare" id="cmp${i}">
  <img class="img-after" src="${rel(c.screenshotPath)}" alt="current" loading="lazy">
  <img class="img-before" src="${rel(c.prevScreenshotPath)}" alt="baseline" loading="lazy">
  <div class="handle"><div class="grip">⇔</div></div>
  <div class="lbl lbl-l">BASELINE</div>
  <div class="lbl lbl-r">NOW</div>
</div>`
    } else if (c.screenshotPath) {
      visual = `<div class="solo-wrap"><img class="solo" src="${rel(c.screenshotPath)}" alt="${c.label}" loading="lazy"></div>`
    } else {
      visual = `<div class="empty">No screenshot</div>`
    }

    return `<div class="card ${c.passed ? 'ok' : 'fail'}">
  <div class="hdr">${badge}${deltaBadge}<span class="name">${escapeHtml(c.label)}</span><span class="dur">${formatDuration(c.durationMs)}</span>${error}</div>
  ${visual}
</div>`
  }).join('\n')

  const sbOffset = cases.length
  const sbCards = storybookCases.map((c, i) => {
    const deltaBadge = c.diff
      ? `<span class="badge ${c.diff.pct < 1 ? 'diff-low' : c.diff.pct < 5 ? 'diff-mid' : 'diff-high'}" title="${c.diff.changed.toLocaleString()} of ${c.diff.total.toLocaleString()} pixels changed">Δ ${c.diff.pct.toFixed(1)}%</span>`
      : ''

    let visual: string
    if (c.prevScreenshotPath) {
      visual = `<div class="compare" id="cmp${sbOffset + i}">
  <img class="img-after" src="${rel(c.screenshotPath)}" alt="current" loading="lazy">
  <img class="img-before" src="${rel(c.prevScreenshotPath)}" alt="baseline" loading="lazy">
  <div class="handle"><div class="grip">⇔</div></div>
  <div class="lbl lbl-l">BASELINE</div>
  <div class="lbl lbl-r">NOW</div>
</div>`
    } else {
      visual = `<div class="solo-wrap"><img class="solo" src="${rel(c.screenshotPath)}" alt="${escapeHtml(c.label)}" loading="lazy"></div>`
    }

    return `<div class="card ok">
  <div class="hdr">${deltaBadge}<span class="name">${escapeHtml(c.label)}</span></div>
  ${visual}
</div>`
  }).join('\n')

  const storybookSection = storybookCases.length > 0
    ? `<div class="section-hdr">Storybook · ${storybookCases.length} stories</div>\n${sbCards}`
    : ''

  const allCards = [e2eCards, storybookSection].filter(Boolean).join('\n')

  return buildPage('Keybase Electron E2E Tests', allPassed, totalPassed, totalFailed, cases.length, hasDiff, timestamp, allCards)
}

function saveBaseline(cases: TestCase[]) {
  fs.mkdirSync(prevDir, {recursive: true})
  let saved = 0
  for (const c of cases) {
    if (!c.screenshotPath || !fs.existsSync(c.screenshotPath)) continue
    fs.copyFileSync(c.screenshotPath, path.join(prevDir, `${c.key}.png`))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${prevDir}/`)
}

function main() {
  const isSaveBaseline = process.argv.includes('--save-baseline')

  if (!fs.existsSync(resultsPath)) {
    console.error(`Results not found: ${resultsPath}`)
    console.error('Run yarn test:e2e:electron first.')
    process.exit(1)
  }

  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Report
  const cases = parseReport(report)

  if (cases.length === 0) {
    console.error('No test cases found in', resultsPath)
    process.exit(1)
  }

  const storybookCases = parseStorybookScreenshots()

  if (isSaveBaseline) {
    saveBaseline(cases)
    saveStorybookBaseline(storybookCases)
    return
  }

  const timestamp = new Date().toLocaleString()
  const html = buildHtml(cases, storybookCases, timestamp)
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)

  const withDiff = [...cases, ...storybookCases].filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  const sbNote = storybookCases.length > 0 ? `, ${storybookCases.length} storybook stories` : ''
  console.log(`Report written to ${outputPath} (${cases.filter(c => c.passed).length}/${cases.length} passed${diffNote}${sbNote})`)
}

main()
