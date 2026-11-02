// What both release commands do the same way around createReleaseRun: their settings, the preflight
// and sweep phases, and how they log a flow or render tally.
import * as fs from 'fs'
import * as path from 'path'
import type {E2EEnv} from '../../accounts/env.ts'
import {formatSweep, sweep} from '../../accounts/sweep.mts'
import {runAbortable} from '../deadline.ts'
import {sessionLocked} from './processes.ts'
import {parseTimeoutMin, type Outcome, type Tally} from './release-lib.ts'
import {errText, type ReleaseRun} from './release-run.mts'

const MIN = 60_000

// Settled before a release run starts: its overall deadline (KB_E2E_RELEASE_TIMEOUT_MIN, a bad value
// refuses the run), the release lock both commands share (one run at a time: a second would sweep
// the same accounts, and relaunch and stop the app, under the first), and KB_VISUAL_RUN cleared (the
// visual gate's own runs set it to skip the lock check; a release command is not one of them).
export const releaseSettings = (tag: string, defaultMin: number) => {
  const timeout = parseTimeoutMin(process.env['KB_E2E_RELEASE_TIMEOUT_MIN'], defaultMin)
  if ('error' in timeout) {
    console.error(`${tag} refusing to run: ${timeout.error}`)
    process.exit(1)
  }
  delete process.env['KB_VISUAL_RUN']
  return {deadlineMs: timeout.minutes * MIN, lockPath: process.env['KB_E2E_RELEASE_LOCK'] ?? '/tmp/kb-e2e-release.lock'}
}

// node's arguments to run a script under shared/
export const nodeArgs =
  (sharedDir: string) =>
  (script: string, ...args: Array<string>) => ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(sharedDir, script), ...args]

export const outcome = async (p: Promise<unknown>): Promise<Outcome> =>
  p.then(
    () => ({ok: true}) as const,
    (e: unknown) => ({error: errText(e), ok: false}) as const
  )

export const screenState = (): {locked: boolean} | {error: string} => {
  try {
    return {locked: sessionLocked()}
  } catch (e) {
    return {error: errText(e)}
  }
}

// The preflight phase: `preflight`'s problems, each printed, refuse the run. The env it loaded, once
// nothing stands in the way.
export const preflightPhase = async <E,>(run: ReleaseRun, tag: string, preflight: () => Promise<{env: E; problems: ReadonlyArray<string>}>) => {
  let env: E | undefined
  const ready = await run.phase('preflight', async () => {
    const r = await preflight()
    if (r.problems.length) {
      console.error(`${tag} refusing to run:\n  - ${r.problems.join('\n  - ')}`)
      return {line: `refused: ${r.problems.length} problem(s)`, ok: false}
    }
    env = r.env
    return {line: 'ready', ok: true}
  })
  return ready ? env : undefined
}

// The sweep of what earlier runs left in the test accounts, also written to `logFile`. A sweep past
// its deadline is told to stop and waited for (each of its calls has its own deadline, the longest
// 90s), so no delete is still going when the flows start. True when it did not stop: then no flow
// may run beside it.
export const sweepPhase = async (run: ReleaseRun, env: E2EEnv, runId: string, o: {logFile?: string} = {}) => {
  const note = (text: string) => {
    if (o.logFile) fs.appendFileSync(o.logFile, `${text}\n`)
  }
  const state = {running: false}
  await run.phase('sweep', async () => {
    const r = await runAbortable('the sweep', Math.min(20 * MIN, run.remainingMs()), 2 * MIN, async signal =>
      sweep(env, {before: run.runStart, dryRun: false, runId, signal})
    )
    if (!r.ok) {
      state.running = !r.settled
      note(r.message)
      return {line: r.message, ok: false}
    }
    const text = formatSweep(r.value, env, false)
    console.log(text)
    note(text)
    return {line: `${r.value.deleted.length} deleted, ${r.value.listOnly.length} listed only, ${r.value.errors.length} errors`, ok: !r.value.errors.length}
  })
  return state.running
}

// One line per new failure, known failure and known failure that now passes (`kind` 'render' for the tour).
export const logTally = (log: (s: string) => void, t: Pick<Tally, 'fresh' | 'known' | 'nowPasses'>, o: {listFile: string; kind?: string}) => {
  const k = o.kind ? `${o.kind} ` : ''
  for (const n of t.fresh) log(`new ${k}failure: ${n}`)
  for (const n of t.known) log(`known on master: ${n}`)
  for (const n of t.nowPasses) log(`known ${k}failure now passes, remove it from ${o.listFile}: ${n}`)
}
