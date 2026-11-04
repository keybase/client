import * as fs from 'fs'
import * as path from 'path'
import {buildReport, buildChecklist, chooseCardStep, computeDiff, sortSteps} from '../../generate-report-shared.mts'
import {parseStepName, slug} from '../step-name.ts'
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
type Report = {suites: PlaywrightSuite[]; errors?: Array<{message?: string} | string>; stats?: {startTime?: string}}

// The report keeps every test's newest card (its store, beside the html), so a run of only some
// tests still yields a full report: each card says when its run was, and a card from an older run
// than the one stored is never written over the newer one.
type StoredCard = CardData & {key: string; runAt: number}
type CardStore = {flows: Array<StoredCard>; tour: Array<StoredCard>}

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

const stamp = (t: number) => new Date(t).toLocaleString()

const storePath = (p: FlowReportPlatform) => p.outputPath.replace(/\.html$/, '') + '.cards.json'

const readStore = (p: FlowReportPlatform): CardStore => {
  try {
    const s = JSON.parse(fs.readFileSync(storePath(p), 'utf8')) as Partial<CardStore>
    return {flows: s.flows ?? [], tour: s.tour ?? []}
  } catch {
    return {flows: [], tour: []}
  }
}

const writeStore = (p: FlowReportPlatform, store: CardStore) => {
  const strip = (cards: Array<StoredCard>) => cards.map(({fresh: _, ...c}) => c)
  fs.writeFileSync(storePath(p), JSON.stringify({flows: strip(store.flows), tour: strip(store.tour)}))
}

// Writes a run's screenshot to `file`. When the run no longer has it (its raw results were cleared),
// the copy the report already made there stays.
const place = (file: string, buf: Buffer | null) => {
  if (buf) {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, buf)
    return file
  }
  return fs.existsSync(file) ? file : null
}

// A flow card's screenshots in debugDir
const removeCardFiles = (p: FlowReportPlatform, key: string) => {
  fs.rmSync(path.join(p.debugDir, key), {force: true, recursive: true})
  fs.rmSync(path.join(p.debugDir, `${key}.png`), {force: true})
  fs.rmSync(path.join(p.debugDir, `${key}-failure.png`), {force: true})
}

// The stored cards with this run's in their place, and its new ones after them. A full run (`prune`)
// sets the order and drops what it no longer has, unless a newer run made it.
const mergeCards = (stored: Array<StoredCard>, run: Array<StoredCard>, runAt: number, prune: boolean) => {
  const fromRun = new Map(run.map(c => [c.key, c]))
  const kept = stored.filter(c => !fromRun.has(c.key))
  const dropped = prune ? kept.filter(c => c.runAt < runAt) : []
  const leftovers = kept.filter(c => !dropped.includes(c))
  const storedKeys = new Set(stored.map(c => c.key))
  const merged = prune
    ? [...run, ...leftovers]
    : [...stored.filter(c => !dropped.includes(c)).map(c => fromRun.get(c.key) ?? c), ...run.filter(c => !storedKeys.has(c.key))]
  return {dropped, merged}
}

const withFresh = (cards: Array<StoredCard>, runAt: number | undefined) => cards.map(c => ({...c, fresh: c.runAt === runAt}))

// `reachedManual` collects manual-only id -> that run's manual-<id> screenshot, relative to the checklist file
function parseReport(
  p: FlowReportPlatform,
  report: Report,
  reachedManual: Map<string, string>,
  runAt: number,
  stored: ReadonlyMap<string, StoredCard>
): Array<StoredCard> {
  const cards: Array<StoredCard> = []
  for (const {file, titles, byProject} of specTests(report)) {
    const title = titles.at(-1) ?? ''
    // the innermost describe, else the spec's file
    const suiteName = specFileStem(titles.at(-2) ?? file)
    const baseKey = `${slug(suiteName)}-${slug(title)}`
    for (const [projectName, tests] of byProject) {
      const variant = p.variantOf?.(projectName)
      const key = variant ? `${baseKey}-${variant}` : baseKey
      const label = variant ? `${suiteName} · ${title} (${variant})` : `${suiteName} · ${title}`
      const newer = stored.get(key)
      if (newer && newer.runAt > runAt) {
        cards.push(newer)
        continue
      }

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
      const screenshotPath = screenshotAtt ? place(path.join(p.debugDir, `${key}.png`), attachmentBuffer(screenshotAtt)) : null

      const steps: Array<{name: string; path: string}> = []
      for (const att of stepAtts) {
        const parsed = parseStepName(att.name)!
        const file = place(path.join(p.debugDir, key, `${att.name}.png`), attachmentBuffer(att))
        if (!file) continue
        steps.push({name: parsed.slug, path: file})
        const manual = /^manual-(.+)$/.exec(parsed.slug)
        if (manual && !reachedManual.has(manual[1]!)) {
          reachedManual.set(manual[1]!, path.relative(path.dirname(p.checklistPath), file))
        }
      }

      const failureAtt = passed ? undefined : result.attachments.filter(a => a.name === 'screenshot' && a.contentType === 'image/png').at(-1)
      const failureFile = path.join(p.debugDir, `${key}-failure.png`)
      const failureScreenshotPath =
        failureAtt === undefined ? null : failureAtt === screenshotAtt ? screenshotPath : place(failureFile, attachmentBuffer(failureAtt))
      // an earlier run's files this one has no counterpart for
      if (failureScreenshotPath !== failureFile) fs.rmSync(failureFile, {force: true})
      const stepDir = path.join(p.debugDir, key)
      const stepFiles = new Set(steps.map(st => path.basename(st.path)))
      if (fs.existsSync(stepDir)) for (const n of fs.readdirSync(stepDir)) if (!stepFiles.has(n)) fs.rmSync(path.join(stepDir, n), {force: true})

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

      const timestamp = stamp(runAt)
      cards.push({label, passed, durationMs, screenshotPath, prevScreenshotPath, failureScreenshotPath, diff, errorMessage, steps, details, key, runAt, timestamp})
    }
  }
  return cards
}

type RenderRow = {id: string; status: string; error?: string; note?: string; png: string | null}

// When a render ran: its dir is named for its start (store.mts), e.g. 2026-11-04T18-07-52-894Z
const renderRunAt = (dir: string) => {
  const iso = path.basename(dir).replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, 'T$1:$2:$3.$4Z')
  const t = Date.parse(iso)
  return Number.isNaN(t) ? fs.statSync(path.join(dir, 'render.json')).mtimeMs : t
}

// One card per tour entry of a `yarn visual:render` run (`--render <dir>`), labelled like the flows
// when listed in the platform's known-failures list.
function parseRender(p: FlowReportPlatform, dir: string, runAt: number): Array<StoredCard> {
  const {entries} = JSON.parse(fs.readFileSync(path.join(dir, 'render.json'), 'utf8')) as {entries: RenderRow[]}
  return entries.map(e => {
    const passed = e.status !== 'failed'
    const cause = knownRenderCause(e.id, p.known.render)
    const note = knownNote(knownVerdict(passed, cause), cause, p.knownListFile)
    const failure = passed ? null : (e.error ?? 'failed')
    return {
      diff: null,
      durationMs: 0,
      errorMessage: [note, failure, e.note].filter(Boolean).join(' — ') || null,
      key: `tour:${e.id}`,
      label: `tour · ${e.id}${e.status === 'unstable' ? ' (unstable)' : ''}${e.note ? ' (recaptured)' : ''}`,
      passed,
      prevScreenshotPath: null,
      runAt,
      screenshotPath: e.png && fs.existsSync(e.png) ? e.png : null,
      timestamp: stamp(runAt),
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

// The report's sections: this build's run errors, then every stored flow and tour card
const storeSections = (store: CardStore, runAt: number | undefined, renderAt: number | undefined): Array<Section> => {
  const sections: Array<Section> = []
  if (store.flows.length) sections.push({cards: withFresh(store.flows, runAt)})
  if (store.tour.length) sections.push({cards: withFresh(store.tour, renderAt), header: `Visual tour (render) · ${store.tour.length} entries`})
  return sections
}

// --targeted: the results are a run of some tests (not the gate's full run), so the cards it lacks stay
export const runFlowReport = (p: FlowReportPlatform, argv: ReadonlyArray<string> = process.argv): number => {
  const isSaveBaseline = argv.includes('--save-baseline')
  const prune = !argv.includes('--targeted')
  const renderAt = argv.indexOf('--render')
  const renderDir = renderAt === -1 ? undefined : argv[renderAt + 1]
  const store = readStore(p)
  const extraSections = p.extraSections?.() ?? []

  // No results.json => the Playwright run crashed before producing output (build
  // / app-launch failure, config error). Baseline mode still hard-fails, but for
  // a normal report write an error report explaining it, with the stored cards under it.
  if (!fs.existsSync(p.resultsPath)) {
    console.error(`Results not found: ${p.resultsPath}`)
    console.error(`Run ${p.runHint} first.`)
    if (!isSaveBaseline) {
      const message = `${p.resultsPath} not found. The run likely crashed before any test produced output (build or app-launch failure). Run ${p.runHint} first.`
      writeReport(p, [
        {cards: [errorCard('Run error — no Playwright results', message)], header: 'Run errors'},
        ...storeSections(store, undefined, undefined),
        ...extraSections,
      ])
    }
    return 1
  }

  const report = JSON.parse(fs.readFileSync(p.resultsPath, 'utf8')) as Report
  const started = report.stats?.startTime ? Date.parse(report.stats.startTime) : NaN
  const runAt = Number.isNaN(started) ? fs.statSync(p.resultsPath).mtimeMs : started
  const reachedManual = new Map<string, string>()
  const runCards = parseReport(p, report, reachedManual, runAt, new Map(store.flows.map(c => [c.key, c])))
  // Top-level global errors (no spec to hang off) — surface each as its own card.
  const globalErrorCards = (report.errors ?? []).map((e, i) =>
    errorCard(`Run error ${i + 1}`, (typeof e === 'string' ? e : e.message) ?? 'unknown run error')
  )
  const extraCards = extraSections.flatMap(s => s.cards)

  if (isSaveBaseline) {
    const fresh = runCards.filter(c => c.runAt === runAt)
    if (fresh.length === 0) {
      console.error('No test cases found in', p.resultsPath)
      return 1
    }
    saveBaseline(p, fresh)
    p.saveExtraBaseline?.(extraCards)
    return 0
  }

  const flows = mergeCards(store.flows, runCards, runAt, prune)
  for (const c of flows.dropped) removeCardFiles(p, c.key)
  let tour = store.tour
  let renderedAt: number | undefined
  const runErrors = [...globalErrorCards]
  if (renderDir) {
    if (fs.existsSync(path.join(renderDir, 'render.json'))) {
      renderedAt = renderRunAt(renderDir)
      const rendered = parseRender(p, renderDir, renderedAt)
      const stored = new Map(store.tour.map(c => [c.key, c]))
      // a render older than the stored card leaves it
      const run = rendered.map(c => {
        const newer = stored.get(c.key)
        return newer && newer.runAt > c.runAt ? newer : c
      })
      tour = mergeCards(store.tour, run, renderedAt, prune).merged
    } else {
      runErrors.push(errorCard('Render error — no render.json', `${path.join(renderDir, 'render.json')} not found`))
    }
  }
  const merged = {flows: flows.merged, tour}
  fs.mkdirSync(path.dirname(storePath(p)), {recursive: true})
  writeStore(p, merged)

  const sections: Section[] = []
  if (runErrors.length > 0) sections.push({header: 'Run errors', cards: runErrors})
  // Flag a results file that parsed but yielded zero tests (all filtered/skipped
  // or a malformed run) so the report still says something happened.
  if (runCards.length === 0 && globalErrorCards.length === 0) {
    sections.push({
      header: 'Run errors',
      cards: [errorCard('Run error — no tests', `No test cases found in ${p.resultsPath}.`)],
    })
  }
  sections.push(...storeSections(merged, runAt, renderedAt), ...extraSections)

  writeReport(p, sections)
  const entries = Object.entries(p.manualOnly).map(([id, e]) => ({id, ...e}))
  fs.writeFileSync(p.checklistPath, buildChecklist(entries, reachedManual))

  const flowCards = merged.flows
  const withDiff = [...flowCards, ...extraCards].filter(c => c.diff !== null).length
  const diffNote = withDiff > 0 ? `, ${withDiff} vs baseline` : ''
  const extraNote = extraSections.map(s => `, ${s.header ?? `${s.cards.length} extra cards`}`).join('')
  const errNote = globalErrorCards.length > 0 ? `, ${globalErrorCards.length} run error(s)` : ''
  const renderNote = tour.length > 0 ? `, tour ${tour.filter(c => c.passed).length}/${tour.length} rendered` : ''
  const freshNote = `, ${runCards.filter(c => c.runAt === runAt).length} from this run`
  console.log(`Report written to ${p.outputPath} (${flowCards.filter(c => c.passed).length}/${flowCards.length} passed${freshNote}${diffNote}${extraNote}${errNote}${renderNote})`)
  return 0
}
