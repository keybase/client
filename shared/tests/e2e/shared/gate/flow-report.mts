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
// tests still yields a full report. Each card says when its run was, and a card is never replaced by
// one from an older run. Only a full run (--prune) drops the cards of tests it no longer has.
// variant: the run variant that made it (variantOf), absent for the plain run
type StoredCard = CardData & {key: string; runAt: number; variant?: string}
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
  fs.mkdirSync(path.dirname(p.outputPath), {recursive: true})
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

// A store that does not parse throws: starting over would drop every card's screenshots unseen
const readStore = (p: FlowReportPlatform): CardStore => {
  if (!fs.existsSync(storePath(p))) return {flows: [], tour: []}
  const s = JSON.parse(fs.readFileSync(storePath(p), 'utf8')) as Partial<CardStore>
  return {flows: s.flows ?? [], tour: s.tour ?? []}
}

// through a temp file, so a build stopped mid-write leaves the last store whole
const writeStore = (p: FlowReportPlatform, store: CardStore) => {
  fs.mkdirSync(path.dirname(storePath(p)), {recursive: true})
  const tmp = `${storePath(p)}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store))
  fs.renameSync(tmp, storePath(p))
}

// A flow card's files in debugDir
const cardFiles = (p: FlowReportPlatform, key: string) => ({
  failure: path.join(p.debugDir, `${key}-failure.png`),
  shot: path.join(p.debugDir, `${key}.png`),
  stepDir: path.join(p.debugDir, key),
})

// Removes a card's files other than `keep` (all of them when it is empty)
const pruneCardFiles = (p: FlowReportPlatform, key: string, keep: ReadonlySet<string> = new Set()) => {
  const files = cardFiles(p, key)
  for (const f of [files.shot, files.failure]) if (!keep.has(f)) fs.rmSync(f, {force: true})
  if (!fs.existsSync(files.stepDir)) return
  for (const n of fs.readdirSync(files.stepDir)) {
    const f = path.join(files.stepDir, n)
    if (!keep.has(f)) fs.rmSync(f, {force: true})
  }
}

// Writes a run's screenshot to `file`. Rebuilding a run whose raw results were since cleared
// (`sameRun`) keeps the copy the report already made of it; any other run's missing screenshot is
// missing, never an older run's image under a newer verdict.
const place = (file: string, buf: Buffer | null, sameRun: boolean) => {
  if (buf) {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, buf)
    return file
  }
  return sameRun && fs.existsSync(file) ? file : null
}

// variantOf for projects named <name>-dark (the desktop and iOS dark runs)
export const darkVariantOf = (projectName: string) => (projectName.endsWith('-dark') ? 'dark' : undefined)

// The stored cards with this run's in their place (the newer of the two per test) and its new ones
// after them. A full run (`prune`) sets the order and drops the older cards it no longer has, of the
// variants it ran only: a plain run never drops a dark run's cards, nor the other way around.
const mergeCards = (stored: Array<StoredCard>, run: Array<StoredCard>, runAt: number, prune: boolean) => {
  const storedByKey = new Map(stored.map(c => [c.key, c]))
  const fromRun = new Map(
    run.map(c => {
      const kept = storedByKey.get(c.key)
      return [c.key, kept && kept.runAt > c.runAt ? kept : c] as const
    })
  )
  if (!prune) {
    const added = [...fromRun.values()].filter(c => !storedByKey.has(c.key))
    return {dropped: [], merged: [...stored.map(c => fromRun.get(c.key) ?? c), ...added]}
  }
  const kept: Array<StoredCard> = []
  const dropped: Array<StoredCard> = []
  const ranVariants = new Set(run.map(c => c.variant))
  for (const c of stored) if (!fromRun.has(c.key)) (c.runAt < runAt && ranVariants.has(c.variant) ? dropped : kept).push(c)
  return {dropped, merged: [...fromRun.values(), ...kept]}
}

const newestRun = (cards: ReadonlyArray<StoredCard>) => Math.max(...cards.map(c => c.runAt))

// Marks the cards of the section's newest run as latest and the rest as older
const withLatest = (cards: Array<StoredCard>) => {
  const newest = newestRun(cards)
  return cards.map(c => ({...c, latest: c.runAt === newest}))
}

// The baseline can change after a card was stored, so its diff is taken when the report is built
const withDiff = (p: FlowReportPlatform, c: StoredCard): StoredCard => {
  const prev = path.join(p.prevDir, `${c.key}.png`)
  const prevScreenshotPath = fs.existsSync(prev) ? prev : null
  const diff = c.screenshotPath && prevScreenshotPath && fs.existsSync(c.screenshotPath) ? computeDiff(c.screenshotPath, prevScreenshotPath) : null
  return {...c, diff, prevScreenshotPath}
}

// Every stored card's manual-<id> step screenshot, relative to the checklist file
const reachedManual = (p: FlowReportPlatform, cards: Array<StoredCard>) => {
  const reached = new Map<string, string>()
  for (const st of cards.flatMap(c => c.steps ?? [])) {
    const manual = /^manual-(.+)$/.exec(st.name)
    if (manual && !reached.has(manual[1]!) && fs.existsSync(st.path)) reached.set(manual[1]!, path.relative(path.dirname(p.checklistPath), st.path))
  }
  return reached
}

// This run's cards. A test a newer stored card covers, or one this run skipped, keeps its stored card
// and files.
function parseReport(
  p: FlowReportPlatform,
  report: Report,
  runAt: number,
  stored: ReadonlyMap<string, StoredCard>
): Array<StoredCard> {
  const cards: Array<StoredCard> = []
  // two tests whose names slug alike get a numbered key each, so neither replaces the other
  const seen = new Map<string, number>()
  for (const {file, titles, byProject} of specTests(report)) {
    const title = titles.at(-1) ?? ''
    // the innermost describe, else the spec's file
    const suiteName = specFileStem(titles.at(-2) ?? file)
    const baseKey = `${slug(suiteName)}-${slug(title)}`
    for (const [projectName, tests] of byProject) {
      const variant = p.variantOf?.(projectName)
      const named = variant ? `${baseKey}-${variant}` : baseKey
      const n = (seen.get(named) ?? 0) + 1
      seen.set(named, n)
      const key = n === 1 ? named : `${named}-${n}`
      const label = variant ? `${suiteName} · ${title} (${variant})` : `${suiteName} · ${title}`
      const allResults = tests.flatMap(t => t.results)
      // a skipped test, or one the run never reached (no results), never counts against or for a
      // known failure, and keeps its stored card
      const ran = allResults.some(r => r.status !== 'skipped')
      const kept = stored.get(key)
      if (kept && (kept.runAt > runAt || !ran)) {
        cards.push(kept)
        continue
      }
      const result = allResults.filter(r => r.status !== 'skipped').at(-1) ?? allResults.at(-1)
      if (!result) continue
      const sameRun = kept?.runAt === runAt
      const files = cardFiles(p, key)

      const passed = tests.every(t => t.status === 'expected' || t.status === 'flaky' || t.status === 'skipped')
      const durationMs = result.duration
      const cause = variant || !ran ? undefined : knownFlowCause(specFileStem(file), titles, p.known.flows)
      const note = knownNote(knownVerdict(passed, cause), cause, p.knownListFile)
      const failure = !passed ? stripAnsi(result.errors?.[0]?.message?.split('\n')[0] ?? 'test failed') : null
      const errorMessage = [note, failure].filter(Boolean).join(' — ') || null

      const stepAtts = sortSteps(result.attachments.filter(a => a.contentType === 'image/png'))
      const marked = tests.flatMap(t => t.annotations ?? []).filter(a => a.type === 'card-step').map(a => a.description ?? '')
      const screenshotAtt =
        chooseCardStep(stepAtts, marked) ?? result.attachments.find(a => a.name === 'screenshot' && a.contentType === 'image/png')
      const screenshotPath = screenshotAtt ? place(files.shot, attachmentBuffer(screenshotAtt), sameRun) : null

      const steps: Array<{name: string; path: string}> = []
      for (const att of stepAtts) {
        const parsed = parseStepName(att.name)!
        const file = place(path.join(files.stepDir, `${att.name}.png`), attachmentBuffer(att), sameRun)
        if (file) steps.push({name: parsed.slug, path: file})
      }

      const failureAtt = passed ? undefined : result.attachments.filter(a => a.name === 'screenshot' && a.contentType === 'image/png').at(-1)
      const failureScreenshotPath =
        failureAtt === undefined ? null : failureAtt === screenshotAtt ? screenshotPath : place(files.failure, attachmentBuffer(failureAtt), sameRun)
      // an earlier run's files this one has no counterpart for
      pruneCardFiles(p, key, new Set([screenshotPath, failureScreenshotPath, ...steps.map(st => st.path)].filter(x => x !== null)))

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

      const timestamp = stamp(runAt)
      cards.push({details, diff: null, durationMs, errorMessage, failureScreenshotPath, key, label, passed, prevScreenshotPath: null, runAt, screenshotPath, steps, timestamp, ...(variant ? {variant} : {})})
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

// The stored flow and tour cards, each section marking its newest run's cards
const storeSections = (p: FlowReportPlatform, store: CardStore): Array<Section> => {
  const sections: Array<Section> = []
  if (store.flows.length) sections.push({cards: withLatest(store.flows.map(c => withDiff(p, c)))})
  if (store.tour.length) sections.push({cards: withLatest(store.tour), header: `Visual tour (render) · ${store.tour.length} entries`})
  return sections
}

// --prune: the results are a full run, so the older cards of tests it no longer has go (the release
// commands pass it; a run of some tests, or a full run cut short, leaves every card).
// --save-baseline: the report's current flow cards become the baseline the diffs compare against.
export const runFlowReport = (p: FlowReportPlatform, argv: ReadonlyArray<string> = process.argv): number => {
  const prune = argv.includes('--prune')
  const renderAt = argv.indexOf('--render')
  const renderDir = renderAt === -1 ? undefined : argv[renderAt + 1]
  const store = readStore(p)
  const extraSections = p.extraSections?.() ?? []

  if (argv.includes('--save-baseline')) {
    if (store.flows.length === 0) {
      console.error(`No report cards in ${storePath(p)}: build the report first`)
      return 1
    }
    saveBaseline(p, store.flows)
    p.saveExtraBaseline?.(extraSections.flatMap(s => s.cards))
    return 0
  }

  // No results.json => the Playwright run crashed before producing output (build
  // / app-launch failure, config error): an error report explaining it, with the stored cards under it.
  if (!fs.existsSync(p.resultsPath)) {
    console.error(`Results not found: ${p.resultsPath}`)
    console.error(`Run ${p.runHint} first.`)
    const message = `${p.resultsPath} not found. The run likely crashed before any test produced output (build or app-launch failure). Run ${p.runHint} first.`
    writeReport(p, [{cards: [errorCard('Run error — no Playwright results', message)], header: 'Run errors'}, ...storeSections(p, store), ...extraSections])
    return 1
  }

  const report = JSON.parse(fs.readFileSync(p.resultsPath, 'utf8')) as Report
  const started = report.stats?.startTime ? Date.parse(report.stats.startTime) : NaN
  const runAt = Number.isNaN(started) ? fs.statSync(p.resultsPath).mtimeMs : started
  const runCards = parseReport(p, report, runAt, new Map(store.flows.map(c => [c.key, c])))
  // Top-level global errors (no spec to hang off) — surface each as its own card.
  const runErrors = (report.errors ?? []).map((e, i) =>
    errorCard(`Run error ${i + 1}`, (typeof e === 'string' ? e : e.message) ?? 'unknown run error')
  )
  // Flag a results file that parsed but yielded zero tests (all filtered/skipped
  // or a malformed run) so the report still says something happened.
  if (runCards.length === 0 && runErrors.length === 0) runErrors.push(errorCard('Run error — no tests', `No test cases found in ${p.resultsPath}.`))
  // A run that broke (a global error, a test it never reached) is not the full suite, so it drops nothing
  const unreached = specTests(report).some(sp => [...sp.byProject.values()].flat().some(t => t.results.length === 0))
  const full = prune && runErrors.length === 0 && !unreached
  if (prune && !full) console.log('report: not dropping any card; the run did not reach every test')

  const flows = mergeCards(store.flows, runCards, runAt, full)
  for (const c of flows.dropped) pruneCardFiles(p, c.key)
  let tour = store.tour
  if (renderDir && fs.existsSync(path.join(renderDir, 'render.json'))) {
    const renderedAt = renderRunAt(renderDir)
    tour = mergeCards(store.tour, parseRender(p, renderDir, renderedAt), renderedAt, full).merged
  } else if (renderDir) {
    runErrors.push(errorCard('Render error — no render.json', `${path.join(renderDir, 'render.json')} not found`))
  } else if (prune && tour.length) {
    runErrors.push(errorCard('Render error — this run rendered no tour', `the tour cards are from ${stamp(newestRun(tour))}`))
  }
  const merged = {flows: flows.merged, tour}
  writeStore(p, merged)

  const sections: Section[] = []
  if (runErrors.length > 0) sections.push({header: 'Run errors', cards: runErrors})
  sections.push(...storeSections(p, merged), ...extraSections)

  writeReport(p, sections)
  const entries = Object.entries(p.manualOnly).map(([id, e]) => ({id, ...e}))
  fs.writeFileSync(p.checklistPath, buildChecklist(entries, reachedManual(p, merged.flows)))

  const fromRun = runCards.filter(c => c.runAt === runAt).length
  const extraNote = extraSections.map(s => `, ${s.header ?? `${s.cards.length} extra cards`}`).join('')
  const errNote = runErrors.length > 0 ? `, ${runErrors.length} run error(s)` : ''
  const renderNote = tour.length > 0 ? `, tour ${tour.filter(c => c.passed).length}/${tour.length} rendered` : ''
  console.log(`Report written to ${p.outputPath} (${merged.flows.filter(c => c.passed).length}/${merged.flows.length} passed, ${fromRun} from this run${extraNote}${errNote}${renderNote})`)
  return 0
}
