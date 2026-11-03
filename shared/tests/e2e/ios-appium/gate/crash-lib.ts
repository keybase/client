// Pure part of the gate's crashed-app recovery (gate/crash.ts), kept apart so jest can test it
// without wdio.
//
// A crashed app stays down: nothing in a flow launches it again, so every later test fails on it.
// The root hooks (hooks.ts) call recover() at a test's end and before the next test. An app that is
// gone is relaunched (the hang watch's relaunch) and read back on the smoke account, and the newest
// crash report the app wrote since it was last seen running names the crash. A relaunch or read-back
// that fails stops the gate (deps.stop poisons it, so every later test is refused), and no recover()
// tries again while it is stopped.

export type CrashReport = {path: string; mtimeMs: number}

export type CrashDeps = {
  appPid: () => number | undefined
  // the app's crash reports written at or after `since` (ms since the epoch)
  reportsSince: (since: number) => Array<CrashReport>
  // kills what is left of the app and launches it, bounded by the caller
  relaunch: () => Promise<void>
  // waits for the relaunched app to settle and throws unless it is on the smoke account, bounded
  smoke: () => Promise<void>
  // the gate could not bring the app back: every later test is refused until it is back
  stop: () => void
  // whether the gate is stopped for the app (an earlier stop that nothing has cleared)
  stopped: () => boolean
  log: (line: string) => void
  now: () => number
  sleep: (ms: number) => Promise<void>
}

// a crash report is written a moment after the process dies
export const REPORT_WAIT_MS = 10_000
const REPORT_POLL_MS = 1_000

export const crashMessage = (report: string) =>
  `the app crashed (its crash report: ${report}); the gate relaunched it on the smoke account`
export const GONE_MESSAGE = 'the app was not running and left no crash report; the gate relaunched it on the smoke account'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// `runStart` bounds the reports looked at: one from before the run is never this run's crash.
export const makeCrashRecovery = (deps: CrashDeps, runStart: number) => {
  // when the app was last seen running: a crash after it writes its report after it
  let upAt = runStart
  const claimed = new Set<string>()
  let inFlight: Promise<string | undefined> | undefined

  const newestReport = () =>
    deps
      .reportsSince(upAt)
      .filter(r => !claimed.has(r.path))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.path

  const waitForReport = async () => {
    for (const end = deps.now() + REPORT_WAIT_MS; ; ) {
      const report = newestReport()
      if (report || deps.now() >= end) return report
      await deps.sleep(REPORT_POLL_MS)
    }
  }

  const run = async (crashOnly: boolean, relaunch: (f: () => Promise<void>) => Promise<void>) => {
    if (deps.appPid() !== undefined) {
      upAt = deps.now()
      return undefined
    }
    const report = await waitForReport()
    // at a body's end, an app gone with no report may be one the flow terminated on purpose
    if (!report && crashOnly) return undefined
    if (report) {
      claimed.add(report)
      deps.log(`the app crashed; its crash report: ${report}`)
    } else {
      deps.log('the app was not running and left no crash report')
    }
    try {
      await relaunch(deps.relaunch)
      await deps.smoke()
    } catch (e) {
      const why = `stopping the gate: the app was gone${report ? ` (its crash report: ${report})` : ''} and bringing it back failed: ${message(e)}`
      deps.log(why)
      deps.stop()
      return why
    }
    upAt = deps.now()
    return report ? crashMessage(report) : GONE_MESSAGE
  }

  return {
    // Brings a gone app back, and says why it was gone, or that bringing it back failed and stopped
    // the gate; undefined when it was running (or, with `crashOnly`, gone without a crash report), and
    // while the gate is stopped. A call while one runs waits for it and gets its answer, unless that
    // one left a gone app for a call without `crashOnly`. `relaunch` runs the relaunch (inside the
    // attempt, when one is open, so its recording moves to the new runtime).
    recover: async (opts: {crashOnly: boolean; relaunch?: (f: () => Promise<void>) => Promise<void>}) => {
      while (inFlight) {
        const why = await inFlight
        if (why !== undefined || opts.crashOnly) return why
      }
      if (deps.stopped()) return undefined
      // cleared before any caller resumes, so a waiter that loops finds it gone
      const mine = run(opts.crashOnly, opts.relaunch ?? (async f => f())).finally(() => {
        if (inFlight === mine) inFlight = undefined
      })
      inFlight = mine
      return mine
    },
    // the recovery running, if any, for a hook that must not drive an app being relaunched
    recovering: (): Promise<unknown> | undefined => inFlight,
  }
}
