// What the release summary and the census read from a gate run: Playwright's json report, the flow and
// render tallies, and the phase summary. Free of I/O so they can be tested.
import {signedInName} from '../../accounts/sweep-lib.ts'
import {flowTestKey, knownFlowCause, knownRenderCause, knownVerdict, type KnownVerdict} from './known.ts'
import {KBFS_START_COMMAND} from './processes.ts'

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

// Calls `f` for each test of `project` (of every project when undefined) with its spec's file and its
// describe titles and title (a suite titled by a file is not a describe).
export const eachFlowTest = <T extends {projectName: string}>(
  suites: ReadonlyArray<SuiteOf<T>>,
  project: string | undefined,
  f: (test: T, specFile: string, titles: Array<string>) => void
) => {
  const walk = (s: SuiteOf<T>, titles: Array<string>) => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests) if (project === undefined || t.projectName === project) f(t, spec.file, [...titles, spec.title])
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

// `note`: why an entry that passed was captured twice (only the iOS driver sets one)
export type RenderResultRow = {id: string; status: string; error?: string; note?: string}
export type RenderTally = Tally & {recaptured: Array<string>}

export const summarizeRender = (rows: ReadonlyArray<RenderResultRow>, known: Record<string, string>): RenderTally => ({
  ...tally(rows.map(r => ({cause: knownRenderCause(r.id, known), name: r.id, passed: r.status !== 'failed'}))),
  recaptured: rows.filter(r => r.status !== 'failed' && r.note).map(r => r.id),
})

// ---------------------------------------------------------------- summary

export type Phase = {name: string; ok: boolean; line: string; ms?: number}

const knownPart = (t: Tally) =>
  t.failed ? ` (${t.known.length} known on master, ${t.fresh.length} new)` : ''

export const flowsLine = (s: FlowSummary) =>
  `${s.passed} passed, ${s.failed} failed${knownPart(s)}, ${s.flaky.length} flaky, ${s.skipped.length} skipped` +
  (s.runErrors.length ? `, ${s.runErrors.length} run errors` : '') +
  (s.nowPasses.length ? `; ${s.nowPasses.length} known failures now pass` : '')

export const renderLine = (t: RenderTally) =>
  `${t.passed} rendered, ${t.failed} failed${knownPart(t)}` +
  (t.recaptured.length ? `, ${t.recaptured.length} recaptured after the inspector page dropped` : '') +
  (t.nowPasses.length ? `; ${t.nowPasses.length} known failures now pass` : '')

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
export const parseTimeoutMin = (raw: string | undefined, fallback: number): {minutes: number} | {error: string} => {
  if (raw === undefined || raw === '') return {minutes: fallback}
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return {error: `KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(raw)} is not a positive number of minutes`}
  // setTimeout fires at once for a delay over 2^31-1 ms
  if (n > MAX_TIMEOUT_MIN) return {error: `KB_E2E_RELEASE_TIMEOUT_MIN=${JSON.stringify(raw)} is over ${MAX_TIMEOUT_MIN} minutes, the longest a timer can wait`}
  return {minutes: n}
}

// ---------------------------------------------------------------- phase results

// `ms` down to its second: file times and ps start times are kept to the second on some filesystems
export const toSecond = (ms: number) => Math.floor(ms / 1000) * 1000

// A finished child, as the release run's runChild reports it.
type PhaseChild = {code: number | null; stdout: string; logError?: string}
// An output the phase must have written: `mtimeMs` left out when the file does not exist.
type PhaseOutput = {path: string; mtimeMs?: number}

export const logFailed = (c: Pick<PhaseChild, 'logError'>) => (c.logError ? ` (its log could not be written: ${c.logError})` : '')
// since `start`, to the second
export const writtenSince = (o: PhaseOutput, start: number) => o.mtimeMs !== undefined && o.mtimeMs >= toSecond(start)

// The flows phase reads only a results json wdio wrote since the phase started (one from an earlier run
// is not this run's flows); `summarize` reads it. `summary` is left out when there was none to read.
export const flowsPhaseResult = (c: PhaseChild, results: PhaseOutput, start: number, summarize: () => FlowSummary) => {
  if (!writtenSince(results, start)) return {line: `wdio exited ${c.code} and wrote no ${results.path}${logFailed(c)}`, ok: false}
  const summary = summarize()
  return {line: `${flowsLine(summary)}${c.code === 0 ? '' : ` (wdio exited ${c.code})`}${logFailed(c)}`, ok: flowsOk(summary, c.code) && !c.logError, summary}
}

// The census phase passes only on what its own child did: its `census: routes …` line, and a census
// json written since the phase started (a file from an earlier run is not this run's census).
export const censusPhaseResult = (c: PhaseChild, json: PhaseOutput, start: number) => {
  const line = /^census: (routes .+)$/m.exec(c.stdout)?.[1]
  if (line === undefined) return {line: `census exited ${c.code} and printed no census line${logFailed(c)}`, ok: false}
  if (!writtenSince(json, start)) return {line: `${line}; ${json.path} was not written by this run${logFailed(c)}`, ok: false}
  return {line: `${line}${logFailed(c)}`, ok: c.code === 0 && !c.logError}
}

// The report phase passes only on a report written since the phase started.
export const reportPhaseResult = (c: PhaseChild, report: PhaseOutput, start: number) => {
  if (c.code !== 0) return {line: `report generator exited ${c.code}${logFailed(c)}`, ok: false}
  if (!writtenSince(report, start)) return {line: `report generator exited 0 and ${report.path} was not written by this run${logFailed(c)}`, ok: false}
  return {line: `${report.path}${logFailed(c)}`, ok: !c.logError}
}

// ---------------------------------------------------------------- preflight

// What both release commands' preflights check the same way. Left out when not checked: KBFS while
// the service is not on the smoke account, peers and setup until every check above them passes.
export type CommonPreflightState = {
  // the release lock's live holder, when another release run holds it: nothing else is checked
  releaseLockHeld?: string
  // the visual gate lock's holder, when a live process holds it
  lockHeld?: string | undefined
  // whether the macOS session is locked; `error` when ioreg could not say
  screen?: {locked: boolean} | {error: string}
  kbfs?: Outcome & {path: string}
  peers?: ReadonlyArray<{role: string} & Outcome>
  setupCheck?: Outcome
}

// Every reason the run must not start, each saying what to do about it; `platform` gives the
// platform's own, which come first. Empty: go ahead. `lockedWhy` says what a locked session breaks.
export const commonPreflightProblems = (s: CommonPreflightState, platform: () => Array<string>, o: {lockedWhy: string}): Array<string> => {
  if (s.releaseLockHeld) return [`${s.releaseLockHeld}; another release run is going, wait for it to finish`]
  const out = platform()
  if (s.lockHeld) out.push(`${s.lockHeld}; wait for that run to finish`)
  if (s.screen && 'error' in s.screen) out.push(`could not tell whether the macOS session is locked (${s.screen.error}); fix ioreg and rerun`)
  else if (s.screen?.locked) out.push(`the macOS session is locked, and ${o.lockedWhy}; unlock it and rerun`)
  if (s.kbfs && !s.kbfs.ok) out.push(`KBFS does not answer for ${s.kbfs.path} (${s.kbfs.error}); start it: ${KBFS_START_COMMAND}`)
  for (const p of s.peers ?? []) {
    if (!p.ok) out.push(`peer ${p.role}: ${p.error}; yarn test:e2e:accounts:setup provisions and signs in the peers`)
  }
  if (s.setupCheck && !s.setupCheck.ok) out.push(`yarn test:e2e:accounts:setup --check failed:\n    ${s.setupCheck.error.trim().split('\n').join('\n    ')}`)
  return out
}

// Who a service is signed in as, for a refusal: a test account by role, never another account's name.
export const serviceAccountName = (user: string, s: {smokeUser: string; secondUser: string}) => signedInName(user, {second: s.secondUser, smoke: s.smokeUser})
