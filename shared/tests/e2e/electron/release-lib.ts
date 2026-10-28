// The release command's decisions, kept free of I/O so they can be tested: whether a run may
// start (preflightProblems), and what the flow and render results add up to.
import {flowTestKey, knownFlowCause, knownRenderCause, knownVerdict, type KnownVerdict} from './known-failures.ts'

export const KBFS_START_COMMAND = '~/go/bin/kbfsfuse -debug -log-file /tmp/kb-e2e/kbfs.log /Volumes/Keybase &'

export type PortHolder = {pid: number; pgid: number; command: string}
export type Outcome = {ok: true} | {ok: false; error: string}

export type PreflightState = {
  // the release lock's live holder, when another release run holds it: nothing else is checked
  releaseLockHeld?: string
  // `user` is who the main service is signed in as ('' when nobody)
  whoami: {ok: true; user: string} | {ok: false; error: string}
  smokeUser: string
  // `error` when lsof could not say who listens
  ports: ReadonlyArray<{port: number; holders: ReadonlyArray<PortHolder>; error?: string}>
  // the process group launch-app.mts recorded for the app it started, if any
  appPgid: number | undefined
  // the visual gate lock's holder, when a live process holds it
  lockHeld: string | undefined
  // these are left out when not checked: KBFS while the main service is not on the smoke account,
  // peers and setup until every check above them passes
  kbfs?: Outcome & {path: string}
  peers?: ReadonlyArray<{role: string} & Outcome>
  setupCheck?: Outcome
}

// Every reason the run must not start, each saying what to do about it. Empty: go ahead.
export const preflightProblems = (s: PreflightState): Array<string> => {
  if (s.releaseLockHeld) return [`${s.releaseLockHeld}; another release run is going, wait for it to finish`]
  const out: Array<string> = []
  if (!s.whoami.ok) {
    out.push(`the main keybase service does not answer whoami (${s.whoami.error}); start it signed in as KB_SMOKE_USER`)
  } else if (s.whoami.user !== s.smokeUser) {
    out.push(
      `the main keybase service is signed in as ${s.whoami.user || 'nobody'}, not KB_SMOKE_USER; ` +
        'sign it back in yourself (the release command never switches it)'
    )
  }
  for (const {error, port, holders} of s.ports) {
    if (error !== undefined) out.push(`could not tell whether port ${port} is free (${error}); fix lsof and rerun`)
    for (const h of holders) {
      if (s.appPgid !== undefined && h.pgid === s.appPgid) continue
      out.push(`port ${port} is held by pid ${h.pid} (${h.command}), which launch-app.mts did not start; stop it to free the port`)
    }
  }
  if (s.lockHeld) out.push(`${s.lockHeld}; wait for that run to finish`)
  if (s.kbfs && !s.kbfs.ok) out.push(`KBFS does not answer for ${s.kbfs.path} (${s.kbfs.error}); start it: ${KBFS_START_COMMAND}`)
  for (const p of s.peers ?? []) {
    if (!p.ok) out.push(`peer ${p.role}: ${p.error}`)
  }
  if (s.setupCheck && !s.setupCheck.ok) out.push(`yarn test:e2e:accounts:setup --check failed:\n    ${s.setupCheck.error.trim().split('\n').join('\n    ')}`)
  return out
}

// `lsof -t -iTCP:<port> -sTCP:LISTEN`: exit 0 lists the listeners' pids, and exit 1 with nothing
// said means no listener. Anything else is an error, never read as a free port.
export const parseLsof = (r: {status: number | null; stdout: string; stderr: string; error?: string}): {pids: Array<number>} | {error: string} => {
  if (r.error !== undefined) return {error: r.error}
  if (r.status === 0 || (r.status === 1 && !r.stdout.trim() && !r.stderr.trim())) {
    return {pids: r.stdout.split('\n').map(s => Number(s.trim())).filter(n => n > 0)}
  }
  return {error: `lsof exited ${r.status}: ${(r.stderr || r.stdout).trim() || '(no output)'}`}
}

// ---------------------------------------------------------------- flow results

type PwTest = {projectName: string; status: string; results: Array<{status: string; errors?: Array<{message?: string}>}>}
type SpecOf<T> = {file: string; title: string; tests: Array<T>}
// A Playwright json report suite, with `T` the parts of a test the reader uses.
export type SuiteOf<T> = {title?: string; specs?: Array<SpecOf<T>>; suites?: Array<SuiteOf<T>>}
export type PwSuite = SuiteOf<PwTest>
export type PwReport = {suites: Array<PwSuite>; errors?: Array<{message?: string} | string>}

export type FlowRow = {file: string; titles: Array<string>; status: string; error?: string}

// The spec's file name without its directory and .test.ts, as known-failures.ts keys it.
export const specFileStem = (file: string) => file.replace(/^.*\//, '').replace(/\.test\.ts$/, '')

// How the release summary, the census and the report name a flow test: `<file> › <describe…> › <title>`.
export const flowTestName = (specFile: string, titles: ReadonlyArray<string>) => flowTestKey(specFileStem(specFile), titles)

// eslint-disable-next-line no-control-regex
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

// One row per test of `project`, with Playwright's overall status for it: expected, unexpected,
// flaky or skipped.
export const flowRows = (report: PwReport, project: string): Array<FlowRow> => {
  const out: Array<FlowRow> = []
  eachFlowTest(report.suites, project, (t, specFile, titles) => {
    const error = t.results.at(-1)?.errors?.[0]?.message
    out.push({
      file: specFileStem(specFile),
      status: t.status,
      titles,
      ...(error ? {error: stripAnsi(error).split('\n')[0]} : {}),
    })
  })
  return out
}

// Calls `f` for each test of `project` with its spec's file and its describe titles and title (a
// suite titled by a file is not a describe).
export const eachFlowTest = <T extends {projectName: string}>(
  suites: ReadonlyArray<SuiteOf<T>>,
  project: string,
  f: (test: T, specFile: string, titles: Array<string>) => void
) => {
  const walk = (s: SuiteOf<T>, titles: Array<string>) => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests) if (t.projectName === project) f(t, spec.file, [...titles, spec.title])
    }
    for (const c of s.suites ?? []) walk(c, c.title && !c.title.endsWith('.ts') ? [...titles, c.title] : titles)
  }
  for (const s of suites) walk(s, [])
}

export type Tally = {
  passed: number
  failed: number
  // failures and passes of listed known failures, by name
  known: Array<string>
  fresh: Array<string>
  nowPasses: Array<string>
}

const tally = (rows: ReadonlyArray<{name: string; passed: boolean; cause: string | undefined}>): Tally => {
  const t: Tally = {failed: 0, fresh: [], known: [], nowPasses: [], passed: 0}
  for (const r of rows) {
    const v: KnownVerdict = knownVerdict(r.passed, r.cause)
    if (r.passed) t.passed++
    else t.failed++
    if (v === 'known failure') t.known.push(r.name)
    else if (v === 'new failure') t.fresh.push(r.name)
    else if (v === 'known now passes') t.nowPasses.push(r.name)
  }
  return t
}

// A flaky test passed only on its retry, and a skipped one checked nothing: both fail the release,
// by name. Neither counts as passed or failed.
export type FlowSummary = Tally & {flaky: Array<string>; skipped: Array<string>; runErrors: Array<string>}

export const summarizeFlows = (report: PwReport, project: string, known?: Record<string, string>): FlowSummary => {
  const rows = flowRows(report, project).map(r => ({...r, name: flowTestKey(r.file, r.titles)}))
  const t = tally(
    rows
      .filter(r => r.status !== 'skipped' && r.status !== 'flaky')
      .map(r => ({cause: knownFlowCause(r.file, r.titles, known), name: r.name, passed: r.status === 'expected'}))
  )
  const runErrors = (report.errors ?? []).map(e => stripAnsi((typeof e === 'string' ? e : e.message) ?? 'unknown run error').split('\n')[0] ?? '')
  const named = (status: string) => rows.filter(r => r.status === status).map(r => r.name)
  return {...t, flaky: named('flaky'), runErrors, skipped: named('skipped')}
}

export const flowProblems = (s: FlowSummary) => [...s.flaky.map(n => `flaky: ${n}`), ...s.skipped.map(n => `skipped: ${n}`)]

// ---------------------------------------------------------------- render results

export type RenderResultRow = {id: string; status: string; error?: string}

export const summarizeRender = (rows: ReadonlyArray<RenderResultRow>, known?: Record<string, string>): Tally =>
  tally(rows.map(r => ({cause: knownRenderCause(r.id, known), name: r.id, passed: r.status !== 'failed'})))

// ---------------------------------------------------------------- summary

export type Phase = {name: string; ok: boolean; line: string; ms?: number}

const knownPart = (t: Tally) =>
  t.failed ? ` (${t.known.length} known on master, ${t.fresh.length} new)` : ''

export const flowsLine = (s: FlowSummary) =>
  `${s.passed} passed, ${s.failed} failed${knownPart(s)}, ${s.flaky.length} flaky, ${s.skipped.length} skipped` +
  (s.runErrors.length ? `, ${s.runErrors.length} run errors` : '') +
  (s.nowPasses.length ? `; ${s.nowPasses.length} known failures now pass` : '')

export const renderLine = (t: Tally) =>
  `${t.passed} rendered, ${t.failed} failed${knownPart(t)}` + (t.nowPasses.length ? `; ${t.nowPasses.length} known failures now pass` : '')

export const flowsOk = (s: FlowSummary, exitCode: number | null) =>
  exitCode === 0 && s.failed === 0 && !s.runErrors.length && !flowProblems(s).length

export const fmtMs = (ms: number) => {
  const sec = Math.round(ms / 1000)
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`
}

export const summaryLines = (phases: ReadonlyArray<Phase>) => {
  const w = Math.max(...phases.map(p => p.name.length))
  return phases.map(p => `${p.ok ? 'ok  ' : 'FAIL'} ${p.name.padEnd(w)}  ${p.line}${p.ms === undefined ? '' : ` (${fmtMs(p.ms)})`}`)
}

export const releaseFailed = (phases: ReadonlyArray<Phase>) => phases.some(p => !p.ok)

const MAX_TIMEOUT_MIN = Math.floor((2 ** 31 - 1) / 60_000)

// KB_E2E_RELEASE_TIMEOUT_MIN: the overall deadline in minutes, or why the value is refused.
export const parseTimeoutMin = (raw: string | undefined, fallback = 150): {minutes: number} | {error: string} => {
  if (raw === undefined || raw === '') return {minutes: fallback}
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return {error: `KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(raw)} is not a positive number of minutes`}
  // setTimeout fires at once for a delay over 2^31-1 ms
  if (n > MAX_TIMEOUT_MIN) return {error: `KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(raw)} is over ${MAX_TIMEOUT_MIN} minutes, the longest a timer can wait`}
  return {minutes: n}
}

// ---------------------------------------------------------------- renderer watchdog

// What the watchdog reads from main.html each poll: #root and what it holds. main.html ships #root
// holding one static `title="loading..."` placeholder, which React replaces. Every reload shows it
// until the app's entry runs; a renderer whose module failed to load keeps showing only that, as a
// white page.
export type RendererProbe = {hasRoot: boolean; rootChildren: number; placeholderOnly: boolean}

export type BadKind = 'blank' | 'gone' | 'unanswered'
export type WatchSample = {kind: 'ok'} | {kind: BadKind | 'loading'; detail: string}

export const probeSample = (p: RendererProbe): WatchSample => {
  if (!p.hasRoot) return {detail: 'main.html has no #root', kind: 'blank'}
  if (p.rootChildren === 0) return {detail: '#root is empty', kind: 'blank'}
  if (p.placeholderOnly) return {detail: '#root holds only the static loading placeholder', kind: 'loading'}
  return {kind: 'ok'}
}

// A renderer blank, missing or silent for this long has gone blank.
export const WATCH_THRESHOLD_MS = 10_000
// Showing the placeholder is a reload in progress, which checkRendererAfterReload (the flows' own
// reloads and global-setup's) gives 20s: only a page still on it after this long is stuck.
export const WATCH_LOADING_THRESHOLD_MS = 30_000

type BadSample = Exclude<WatchSample, {kind: 'ok'}>
// badSince: the first poll of this bad stretch; hardSince: the first of its latest run of polls
// that were bad other than loading
export type WatchState = {badSince?: number; hardSince?: number; first?: BadSample}
export type WatchAlarm = {kind: BadKind; text: string}

// One good poll resets both clocks; after an alarm they start over.
export const nextWatch = (
  state: WatchState,
  sample: WatchSample,
  now: number,
  thresholds: {badMs?: number; loadingMs?: number} = {}
): {state: WatchState; alarm?: WatchAlarm} => {
  if (sample.kind === 'ok') return {state: {}}
  const badMs = thresholds.badMs ?? WATCH_THRESHOLD_MS
  const loadingMs = thresholds.loadingMs ?? WATCH_LOADING_THRESHOLD_MS
  const badSince = state.badSince ?? now
  const hardSince = sample.kind === 'loading' ? undefined : (state.hardSince ?? now)
  const first = state.first ?? sample
  const hardLong = hardSince !== undefined && now - hardSince >= badMs
  if (!hardLong && now - badSince < loadingMs) return {state: {badSince, first, ...(hardSince === undefined ? {} : {hardSince})}}
  const why =
    sample.kind === 'gone'
      ? 'its target is gone'
      : sample.kind === 'unanswered'
        ? 'it does not answer'
        : sample.kind === 'loading'
          ? 'it shows only the loading placeholder'
          : 'it is blank'
  const kind: BadKind = sample.kind === 'loading' ? 'blank' : sample.kind
  return {alarm: {kind, text: `${why} for ${Math.round((now - badSince) / 1000)}s (${sample.detail}; first: ${first.detail})`}, state: {}}
}

// The watchdog's incidents. The run's first alarm reloads the renderer; after that each phase
// records at most one more incident per state, and later alarms of that state only count.
export type IncidentBook = {
  reloaded: boolean
  entries: Array<{phase: string; kind: BadKind; text: string; afterReload: boolean; count: number}>
}
export const emptyIncidentBook = (): IncidentBook => ({entries: [], reloaded: false})

export const noteAlarm = (
  book: IncidentBook,
  phase: string,
  kind: BadKind,
  text: string
): {book: IncidentBook; action: 'reload' | 'record' | 'count'} => {
  if (!book.reloaded) {
    return {action: 'reload', book: {entries: [...book.entries, {afterReload: false, count: 1, kind, phase, text}], reloaded: true}}
  }
  const i = book.entries.findIndex(e => e.afterReload && e.phase === phase && e.kind === kind)
  if (i >= 0) {
    const entries = book.entries.map((e, j) => (j === i ? {...e, count: e.count + 1} : e))
    return {action: 'count', book: {...book, entries}}
  }
  return {action: 'record', book: {...book, entries: [...book.entries, {afterReload: true, count: 1, kind, phase, text}]}}
}

export const incidentLines = (book: IncidentBook) =>
  book.entries.map(e => (e.count > 1 ? `${e.text} (and ${e.count - 1} more ${e.count === 2 ? 'time' : 'times'})` : e.text))
