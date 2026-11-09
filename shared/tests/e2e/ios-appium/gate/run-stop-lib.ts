// When the gate stops the rest of its run instead of failing test after test: a phone it cannot put
// back (poison-lib.ts) refuses every later test, and a run of consecutive failures says something
// every flow needs (the service, Metro, the simulator) is broken. Either way the remaining tests could
// only fail, at several seconds each for their screenshots and logs, so the run ends and says why.
// Free of wdio and mocha, so jest tests it.

// Consecutive failed tests (after their retries) that stop the run; KB_E2E_MAX_CONSECUTIVE_FAILURES
// overrides it, and 0 turns the stop off.
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 8

export const maxConsecutiveFailures = (env: NodeJS.ProcessEnv = process.env) => {
  const raw = env['KB_E2E_MAX_CONSECUTIVE_FAILURES']
  if (raw === undefined || raw === '') return DEFAULT_MAX_CONSECUTIVE_FAILURES
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`KB_E2E_MAX_CONSECUTIVE_FAILURES is not a whole number: ${raw}`)
  return n
}

// Counts each test's final result; returns why the run stops once `max` tests in a row have failed.
export const makeFailureStreak = (max: number) => {
  let streak: Array<string> = []
  return (title: string, failed: boolean): string | undefined => {
    streak = failed ? [...streak, title] : []
    if (!max || streak.length < max) return undefined
    return `${streak.length} tests in a row failed (${streak.slice(0, 3).join('; ')}${streak.length > 3 ? '; ...' : ''}), so something every flow needs is broken`
  }
}

type BailSuite = {bail: (b: boolean) => unknown; suites: ReadonlyArray<BailSuite>}

// Sets mocha's bail on every suite under `root`: once a test has failed, mocha runs no further test
// or suite (the gate's after hook records each as never ran).
export const bailEverySuite = (root: BailSuite) => {
  root.bail(true)
  root.suites.forEach(bailEverySuite)
}
