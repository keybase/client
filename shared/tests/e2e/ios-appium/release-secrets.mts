// The iOS release run's secret scan, run from its cleanup once what it started has stopped, so every
// way out of a run that took the release lock (a refused preflight, a failed phase, the overall
// deadline, an interrupt, a crash) scans the files as they finally are.
import * as path from 'path'
import type {Phase} from '../shared/gate/release-lib.ts'
import {errText} from '../shared/gate/release-run.mts'
import {scanAndPurge} from '../shared/gate/secret-scan.ts'

// Scans everything under `dirs` for `secrets()` (the run's ledger, or the env file's values when
// the run stopped before starting one) and, outside `notOurs`, for saltpack armor (this run's crypto
// flows keep theirs out of every artifact, so one that got in is a leak; another gate's files under
// `dirs` are its own to judge), deletes each file that holds one and logs it. A hit, or a scan that
// could not run, fails the run's secrets phase, which this returns.
export const scanResults = (
  dirs: ReadonlyArray<string>,
  secrets: () => ReadonlyArray<string>,
  log: (s: string) => void,
  notOurs: ReadonlyArray<string> = []
): Phase => {
  const start = Date.now()
  let p: Omit<Phase, 'ms' | 'name'>
  try {
    const ours = (f: string) => !notOurs.some(o => f === o || f.startsWith(`${o}${path.sep}`))
    const scan = scanAndPurge(dirs, secrets(), {armor: ours})
    for (const f of scan.hits) log(`secret found, deleted: ${f}`)
    p = {line: scan.line, ok: !scan.hits.length}
  } catch (e) {
    p = {line: `could not scan ${dirs.join(', ')}: ${errText(e)}`, ok: false}
  }
  log(`secrets: ${p.ok ? 'ok' : 'FAILED'}: ${p.line}`)
  return {...p, ms: Date.now() - start, name: 'secrets'}
}

// Stops what the run started, then scans: the scan runs however the stop went, and a stop that threw
// counts as one that left something running. `scan` returns undefined when there is nothing to scan.
export const stopThenScan = async (stop: () => Promise<boolean>, scan: () => Phase | undefined, log: (s: string) => void) => {
  let stopped = false
  let secrets: Phase | undefined
  try {
    stopped = await stop()
  } catch (e) {
    log(`stopping what it started failed: ${errText(e)}`)
  } finally {
    secrets = scan()
  }
  return {secrets, stopped}
}
