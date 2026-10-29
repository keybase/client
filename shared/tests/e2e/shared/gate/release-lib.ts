// What the release summary and the census read from a gate run: Playwright's json report, the flow and
// render tallies, and the phase summary. Free of I/O so they can be tested.
import {flowTestKey, knownFlowCause, knownRenderCause, knownVerdict, type KnownVerdict} from './known.ts'

export type Outcome = {ok: true} | {ok: false; error: string}

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

export const summarizeFlows = (report: PwReport, project: string, known: Record<string, string>): FlowSummary => {
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

export const summarizeRender = (rows: ReadonlyArray<RenderResultRow>, known: Record<string, string>): Tally =>
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
