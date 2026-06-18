import * as fs from 'fs'
import * as path from 'path'
import {computeDiff, buildReport} from './generate-report-shared.mts'
import type {CardData, Section} from './generate-report-shared.mts'

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
// Playwright's json reporter also emits top-level `errors` for global failures
// (global-setup throw, worker crash) that never attach to a spec.
type Report = {suites: PlaywrightSuite[]; errors?: Array<{message?: string} | string>}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

// A failed card with no screenshot — used to surface run-level failures (missing
// results, global errors) in the HTML so a crashed run produces a report that
// explains itself instead of vanishing with a bare process.exit(1).
function errorCard(label: string, message: string): CardData {
  return {label, passed: false, durationMs: 0, screenshotPath: null, prevScreenshotPath: null, diff: null, errorMessage: stripAnsi(message).split('\n')[0] || message}
}

function writeReport(sections: Section[]) {
  const timestamp = new Date().toLocaleString()
  const html = buildReport('Keybase Electron E2E Tests', sections, timestamp, outputPath)
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(outputPath, html)
}

function flattenSpecs(suite: PlaywrightSuite): Array<{suiteName: string; spec: PlaywrightSpec}> {
  const out: Array<{suiteName: string; spec: PlaywrightSpec}> = []
  const name = suite.title.replace(/^.*\//, '').replace(/\.test\.ts$/, '')
  for (const spec of suite.specs) out.push({suiteName: name, spec})
  for (const child of suite.suites ?? []) out.push(...flattenSpecs(child))
  return out
}

function parseReport(report: Report): CardData[] {
  const cards: CardData[] = []
  for (const suite of report.suites) {
    for (const {suiteName, spec} of flattenSpecs(suite)) {
      const baseKey = `${slugify(suiteName)}-${slugify(spec.title)}`

      const byProject = new Map<string, PlaywrightTest[]>()
      for (const t of spec.tests) {
        const proj = t.projectName
        if (!byProject.has(proj)) byProject.set(proj, [])
        byProject.get(proj)!.push(t)
      }

      for (const [projectName, tests] of byProject) {
        const isDark = projectName.endsWith('-dark')
        const key = isDark ? `${baseKey}-dark` : baseKey
        const label = isDark ? `${suiteName} · ${spec.title} (dark)` : `${suiteName} · ${spec.title}`

        const allResults = tests.flatMap(t => t.results)
        const result = allResults.filter(r => r.status !== 'skipped').at(-1) ?? allResults.at(-1)
        if (!result) continue

        const passed = tests.every(t => t.status === 'expected' || t.status === 'flaky' || t.status === 'skipped')
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

        cards.push({label, passed, durationMs, screenshotPath, prevScreenshotPath, diff, errorMessage})
      }
    }
  }
  return cards
}

function parseStorybookScreenshots(): CardData[] {
  if (!fs.existsSync(storybookDir)) return []
  const cases: CardData[] = []
  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else if (entry.name.endsWith('.png')) {
        const label = relPath.replace(/\.png$/, '').replaceAll('/', ' / ').replace(/-/g, ' ')
        const prevPath = path.join(storybookPrevDir, relPath)
        const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
        const diff = prevScreenshotPath ? computeDiff(fullPath, prevScreenshotPath) : null
        cases.push({label, passed: true, durationMs: 0, screenshotPath: fullPath, prevScreenshotPath, diff, errorMessage: null})
      }
    }
  }
  walk(storybookDir, '')
  return cases.sort((a, b) => a.label.localeCompare(b.label))
}

function saveBaseline(cards: CardData[]) {
  fs.mkdirSync(prevDir, {recursive: true})
  let saved = 0
  for (const card of cards) {
    if (!card.screenshotPath || !fs.existsSync(card.screenshotPath)) continue
    fs.copyFileSync(card.screenshotPath, path.join(prevDir, path.basename(card.screenshotPath)))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${prevDir}/`)
}

function saveStorybookBaseline(cards: CardData[]) {
  fs.mkdirSync(storybookPrevDir, {recursive: true})
  let saved = 0
  for (const card of cards) {
    if (!card.screenshotPath || !fs.existsSync(card.screenshotPath)) continue
    const relPath = path.relative(storybookDir, card.screenshotPath)
    const destDir = path.dirname(path.join(storybookPrevDir, relPath))
    fs.mkdirSync(destDir, {recursive: true})
    fs.copyFileSync(card.screenshotPath, path.join(storybookPrevDir, relPath))
    saved++
  }
  console.log(`Storybook baseline saved: ${saved} screenshots to ${storybookPrevDir}/`)
}

function main() {
  const isSaveBaseline = process.argv.includes('--save-baseline')

  // No results.json => the Playwright run crashed before producing output (build
  // / app-launch failure, config error). Baseline mode still hard-fails, but for
  // a normal report write an error report explaining it rather than vanishing.
  if (!fs.existsSync(resultsPath)) {
    console.error(`Results not found: ${resultsPath}`)
    console.error('Run yarn test:e2e:desktop first.')
    if (!isSaveBaseline) {
      writeReport([
        {
          header: 'Run errors',
          cards: [
            errorCard(
              'Run error — no Playwright results',
              `${resultsPath} not found. The run likely crashed before any test produced output (build or app-launch failure). Run yarn test:e2e:desktop first.`
            ),
          ],
        },
      ])
    }
    process.exit(1)
  }

  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Report
  const e2eCards = parseReport(report)
  // Top-level global errors (no spec to hang off) — surface each as its own card.
  const globalErrorCards = (report.errors ?? []).map((e, i) =>
    errorCard(`Run error ${i + 1}`, (typeof e === 'string' ? e : e.message) ?? 'unknown run error')
  )

  if (isSaveBaseline) {
    if (e2eCards.length === 0) {
      console.error('No test cases found in', resultsPath)
      process.exit(1)
    }
    saveBaseline(e2eCards)
    saveStorybookBaseline(parseStorybookScreenshots())
    return
  }

  const sbCards = parseStorybookScreenshots()

  const sections: Section[] = []
  if (globalErrorCards.length > 0) sections.push({header: 'Run errors', cards: globalErrorCards})
  // Flag a results file that parsed but yielded zero tests (all filtered/skipped
  // or a malformed run) so the report still says something happened.
  if (e2eCards.length === 0 && globalErrorCards.length === 0) {
    sections.push({
      header: 'Run errors',
      cards: [errorCard('Run error — no tests', `No test cases found in ${resultsPath}.`)],
    })
  }
  if (e2eCards.length > 0) sections.push({cards: e2eCards})
  if (sbCards.length > 0) {
    sections.push({header: `Storybook · ${sbCards.length} stories`, cards: sbCards, excludeFromStats: true})
  }

  writeReport(sections)

  const withDiff = [...e2eCards, ...sbCards].filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  const sbNote = sbCards.length > 0 ? `, ${sbCards.length} storybook stories` : ''
  const errNote = globalErrorCards.length > 0 ? `, ${globalErrorCards.length} run error(s)` : ''
  console.log(`Report written to ${outputPath} (${e2eCards.filter(c => c.passed).length}/${e2eCards.length} passed${diffNote}${sbNote}${errNote})`)
}

main()
