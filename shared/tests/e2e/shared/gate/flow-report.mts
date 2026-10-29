import * as fs from 'fs'
import * as path from 'path'
import {buildReport, buildChecklist, chooseCardStep, computeDiff, parseStepName, sortSteps} from '../../generate-report-shared.mts'
import {knownFlowCause, knownNote, knownRenderCause, knownVerdict, type KnownList} from './known.ts'
import {eachFlowTest, specFileStem, stripAnsi, type SuiteOf} from './release-lib.ts'
import type {CardData, Section} from '../../generate-report-shared.mts'

// All paths are relative to the cwd (shared/).
export type FlowReportPlatform = {
  title: string
  resultsPath: string
  outputPath: string
  checklistPath: string
  debugDir: string
  prevDir: string
  // sections appended after the flows, e.g. desktop's storybook
  extraSections?: () => Array<Section>
  // names the extra sections' cards in the summary line, e.g. 'storybook stories'
  extraLabel?: string
  // --save-baseline for the extra sections' screenshots
  saveExtraBaseline?: (cards: Array<CardData>) => void
  manualOnly: Record<string, {title: string; doByHand: string}>
  known: KnownList
  knownListFile: string
  // The variant a project runs (e.g. dark), or undefined for the plain run. A variant suffixes the card's
  // key and label and never takes a known-failures verdict. Without it cards are keyed by spec only.
  variantOf?: (projectName: string) => string | undefined
  // names the command that produces the results, e.g. 'yarn test:e2e:desktop'
  runHint: string
}

type Attachment = {name: string; contentType: string; body?: string; path?: string}
type PlaywrightResult = {status: string; duration: number; attachments: Attachment[]; errors?: Array<{message?: string}>}
type PlaywrightTest = {status: string; projectName: string; results: PlaywrightResult[]; annotations?: Array<{type: string; description?: string}>}
type PlaywrightSuite = SuiteOf<PlaywrightTest>
// Playwright's json reporter also emits top-level `errors` for global failures
// (global-setup throw, worker crash) that never attach to a spec.
type Report = {suites: PlaywrightSuite[]; errors?: Array<{message?: string} | string>}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// A failed card with no screenshot — used to surface run-level failures (missing
// results, global errors) in the HTML so a crashed run produces a report that
// explains itself instead of vanishing with a bare process.exit(1).
function errorCard(label: string, message: string): CardData {
  return {label, passed: false, durationMs: 0, screenshotPath: null, prevScreenshotPath: null, diff: null, errorMessage: stripAnsi(message).split('\n')[0] || message}
}

function writeReport(p: FlowReportPlatform, sections: Section[]) {
  const timestamp = new Date().toLocaleString()
  const html = buildReport(p.title, sections, timestamp, p.outputPath)
  const outDir = path.dirname(p.outputPath)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})
  fs.writeFileSync(p.outputPath, html)
}

// Each spec's tests grouped by project, in report order, with the spec's file and its describe
// titles and title (its known-failures key)
function specTests(report: Report) {
  const specs = new Map<string, {file: string; titles: Array<string>; byProject: Map<string, Array<PlaywrightTest>>}>()
  eachFlowTest(report.suites, undefined, (t, file, titles) => {
    const id = JSON.stringify([file, ...titles])
    const spec = specs.get(id) ?? {byProject: new Map<string, Array<PlaywrightTest>>(), file, titles}
    specs.set(id, spec)
    spec.byProject.set(t.projectName, [...(spec.byProject.get(t.projectName) ?? []), t])
  })
  return [...specs.values()]
}

function attachmentBuffer(a: Attachment): Buffer | null {
  if (a.body) return Buffer.from(a.body, 'base64')
  return a.path && fs.existsSync(a.path) ? fs.readFileSync(a.path) : null
}

// Text attachments shown under a failed card, in this order
const detailNames = ['renderer-console-errors', 'renderer-page-errors', 'app-log-tail', 'service-log-tail']
const isDetail = (name: string) => name.startsWith('renderer-') || detailNames.includes(name)

// `reachedManual` collects manual-only id -> that run's manual-<id> screenshot, relative to the checklist file
function parseReport(p: FlowReportPlatform, report: Report, reachedManual: Map<string, string>): CardData[] {
  const cards: CardData[] = []
  for (const {file, titles, byProject} of specTests(report)) {
    const title = titles.at(-1) ?? ''
    // the innermost describe, else the spec's file
    const suiteName = specFileStem(titles.at(-2) ?? file)
    const baseKey = `${slugify(suiteName)}-${slugify(title)}`
    for (const [projectName, tests] of byProject) {
      const variant = p.variantOf?.(projectName)
      const key = variant ? `${baseKey}-${variant}` : baseKey
      const label = variant ? `${suiteName} · ${title} (${variant})` : `${suiteName} · ${title}`

      const allResults = tests.flatMap(t => t.results)
      const result = allResults.filter(r => r.status !== 'skipped').at(-1) ?? allResults.at(-1)
      if (!result) continue

      const passed = tests.every(t => t.status === 'expected' || t.status === 'flaky' || t.status === 'skipped')
      const durationMs = result.duration
      // a skipped test never counts against or for a known failure
      const ran = tests.some(t => t.status !== 'skipped')
      const cause = variant || !ran ? undefined : knownFlowCause(specFileStem(file), titles, p.known.flows)
      const note = knownNote(knownVerdict(passed, cause), cause, p.knownListFile)
      const failure = !passed ? stripAnsi(result.errors?.[0]?.message?.split('\n')[0] ?? 'test failed') : null
      const errorMessage = [note, failure].filter(Boolean).join(' — ') || null

      const stepAtts = sortSteps(result.attachments.filter(a => a.contentType === 'image/png'))
      const marked = tests.flatMap(t => t.annotations ?? []).filter(a => a.type === 'card-step').map(a => a.description ?? '')
      const screenshotAtt =
        chooseCardStep(stepAtts, marked) ?? result.attachments.find(a => a.name === 'screenshot' && a.contentType === 'image/png')
      let screenshotPath: string | null = null
      if (screenshotAtt) {
        const buf = screenshotAtt.body
          ? Buffer.from(screenshotAtt.body, 'base64')
          : screenshotAtt.path ? fs.readFileSync(screenshotAtt.path) : null
        if (buf) {
          fs.mkdirSync(p.debugDir, {recursive: true})
          screenshotPath = path.join(p.debugDir, `${key}.png`)
          fs.writeFileSync(screenshotPath, buf)
        }
      }

      const steps: Array<{name: string; path: string}> = []
      for (const att of stepAtts) {
        const buf = attachmentBuffer(att)
        if (!buf) continue
        const parsed = parseStepName(att.name)!
        const file = path.join(p.debugDir, key, `${att.name}.png`)
        fs.mkdirSync(path.dirname(file), {recursive: true})
        fs.writeFileSync(file, buf)
        steps.push({name: parsed.slug, path: file})
        const manual = /^manual-(.+)$/.exec(parsed.slug)
        if (manual && !reachedManual.has(manual[1]!)) {
          reachedManual.set(manual[1]!, path.relative(path.dirname(p.checklistPath), file))
        }
      }

      let failureScreenshotPath: string | null = null
      const failureAtt = passed ? undefined : result.attachments.filter(a => a.name === 'screenshot' && a.contentType === 'image/png').at(-1)
      const failureBuf = failureAtt && failureAtt !== screenshotAtt ? attachmentBuffer(failureAtt) : null
      if (failureAtt && failureAtt === screenshotAtt) {
        failureScreenshotPath = screenshotPath
      } else if (failureBuf) {
        fs.mkdirSync(p.debugDir, {recursive: true})
        failureScreenshotPath = path.join(p.debugDir, `${key}-failure.png`)
        fs.writeFileSync(failureScreenshotPath, failureBuf)
      }

      const details: Array<{name: string; text: string}> = []
      if (!passed) {
        const fullError = result.errors?.map(e => stripAnsi(e.message ?? '')).filter(Boolean).join('\n\n')
        if (fullError) details.push({name: 'error', text: fullError})
        const textAtts = result.attachments.filter(a => isDetail(a.name))
        textAtts.sort((a, b) => detailNames.indexOf(a.name) - detailNames.indexOf(b.name))
        for (const att of textAtts) {
          const buf = attachmentBuffer(att)
          if (buf) details.push({name: att.name, text: buf.toString('utf8')})
        }
      }

      const prevPath = path.join(p.prevDir, `${key}.png`)
      const prevScreenshotPath = fs.existsSync(prevPath) ? prevPath : null
      const diff = screenshotPath && prevScreenshotPath ? computeDiff(screenshotPath, prevScreenshotPath) : null

      cards.push({label, passed, durationMs, screenshotPath, prevScreenshotPath, failureScreenshotPath, diff, errorMessage, steps, details})
    }
  }
  return cards
}

type RenderRow = {id: string; status: string; error?: string; png: string | null}

// One card per tour entry of a `yarn visual:render` run (`--render <dir>`), labelled like the flows
// when listed in the platform's known-failures list.
function parseRender(p: FlowReportPlatform, dir: string): CardData[] {
  const file = path.join(dir, 'render.json')
  if (!fs.existsSync(file)) return [errorCard('Render error — no render.json', `${file} not found`)]
  const {entries} = JSON.parse(fs.readFileSync(file, 'utf8')) as {entries: RenderRow[]}
  return entries.map(e => {
    const passed = e.status !== 'failed'
    const cause = knownRenderCause(e.id, p.known.render)
    const note = knownNote(knownVerdict(passed, cause), cause, p.knownListFile)
    const failure = passed ? null : (e.error ?? 'failed')
    return {
      diff: null,
      durationMs: 0,
      errorMessage: [note, failure].filter(Boolean).join(' — ') || null,
      label: `tour · ${e.id}${e.status === 'unstable' ? ' (unstable)' : ''}`,
      passed,
      prevScreenshotPath: null,
      screenshotPath: e.png && fs.existsSync(e.png) ? e.png : null,
    }
  })
}

function saveBaseline(p: FlowReportPlatform, cards: CardData[]) {
  fs.mkdirSync(p.prevDir, {recursive: true})
  let saved = 0
  for (const card of cards) {
    if (!card.screenshotPath || !fs.existsSync(card.screenshotPath)) continue
    fs.copyFileSync(card.screenshotPath, path.join(p.prevDir, path.basename(card.screenshotPath)))
    saved++
  }
  console.log(`Baseline saved: ${saved} screenshots to ${p.prevDir}/`)
}

export const runFlowReport = (p: FlowReportPlatform, argv: ReadonlyArray<string> = process.argv): number => {
  const isSaveBaseline = argv.includes('--save-baseline')
  const renderAt = argv.indexOf('--render')
  const renderDir = renderAt === -1 ? undefined : argv[renderAt + 1]

  // No results.json => the Playwright run crashed before producing output (build
  // / app-launch failure, config error). Baseline mode still hard-fails, but for
  // a normal report write an error report explaining it rather than vanishing.
  if (!fs.existsSync(p.resultsPath)) {
    console.error(`Results not found: ${p.resultsPath}`)
    console.error(`Run ${p.runHint} first.`)
    if (!isSaveBaseline) {
      writeReport(p, [
        {
          header: 'Run errors',
          cards: [
            errorCard(
              'Run error — no Playwright results',
              `${p.resultsPath} not found. The run likely crashed before any test produced output (build or app-launch failure). Run ${p.runHint} first.`
            ),
          ],
        },
      ])
    }
    return 1
  }

  const report = JSON.parse(fs.readFileSync(p.resultsPath, 'utf8')) as Report
  const reachedManual = new Map<string, string>()
  const e2eCards = parseReport(p, report, reachedManual)
  // Top-level global errors (no spec to hang off) — surface each as its own card.
  const globalErrorCards = (report.errors ?? []).map((e, i) =>
    errorCard(`Run error ${i + 1}`, (typeof e === 'string' ? e : e.message) ?? 'unknown run error')
  )

  const extraSections = p.extraSections?.() ?? []
  const extraCards = extraSections.flatMap(s => s.cards)

  if (isSaveBaseline) {
    if (e2eCards.length === 0) {
      console.error('No test cases found in', p.resultsPath)
      return 1
    }
    saveBaseline(p, e2eCards)
    p.saveExtraBaseline?.(extraCards)
    return 0
  }

  const sections: Section[] = []
  if (globalErrorCards.length > 0) sections.push({header: 'Run errors', cards: globalErrorCards})
  // Flag a results file that parsed but yielded zero tests (all filtered/skipped
  // or a malformed run) so the report still says something happened.
  if (e2eCards.length === 0 && globalErrorCards.length === 0) {
    sections.push({
      header: 'Run errors',
      cards: [errorCard('Run error — no tests', `No test cases found in ${p.resultsPath}.`)],
    })
  }
  if (e2eCards.length > 0) sections.push({cards: e2eCards})
  const renderCards = renderDir ? parseRender(p, renderDir) : []
  if (renderCards.length > 0) sections.push({header: `Visual tour (render) · ${renderCards.length} entries`, cards: renderCards})
  sections.push(...extraSections)

  writeReport(p, sections)
  const entries = Object.entries(p.manualOnly).map(([id, e]) => ({id, ...e}))
  fs.writeFileSync(p.checklistPath, buildChecklist(entries, reachedManual))

  const withDiff = [...e2eCards, ...extraCards].filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  const extraNote = extraCards.length > 0 ? `, ${extraCards.length} ${p.extraLabel ?? 'extra cards'}` : ''
  const errNote = globalErrorCards.length > 0 ? `, ${globalErrorCards.length} run error(s)` : ''
  const renderNote = renderCards.length > 0 ? `, tour ${renderCards.filter(c => c.passed).length}/${renderCards.length} rendered` : ''
  console.log(`Report written to ${p.outputPath} (${e2eCards.filter(c => c.passed).length}/${e2eCards.length} passed${diffNote}${extraNote}${errNote}${renderNote})`)
  return 0
}
