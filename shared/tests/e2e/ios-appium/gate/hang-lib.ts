// Pure part of the app-hang watch (gate/hang.ts), kept apart so jest can test it without wdio.
//
// The app's main thread can get stuck for good inside UIKit's accessibility snapshot, the call that
// answers an XCUITest query: after an account switch the app's own views can form an accessibility
// container chain that never ends, and UIKit walks it forever. Every query then times out, and so
// does every inspector eval (Metro lists no page), so a test waits out each of its helpers' bounds.

export const SNAPSHOT_FRAME = '_accessibilityUserTestingSnapshot'

// Whether a `sample` report shows the process's main thread inside the accessibility snapshot. The
// main thread's call graph is the run of "    +" lines after its header.
export const mainThreadInSnapshot = (report: string) => {
  const lines = report.split('\n')
  const start = lines.findIndex(l => l.includes('com.apple.main-thread'))
  if (start < 0) return false
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('    +')) return false
    if (line.includes(SNAPSHOT_FRAME)) return true
  }
  return false
}

// Whether one WebDriver protocol request (webdriver's 'result' event) got a successful answer. Only
// these are counted: a wrapper command (isExisting, waitUntil) can swallow a failed request and end
// fine, so it shows nothing about the app, and a hung app's requests time out or fail.
export const protocolSucceeded = (result: unknown) =>
  !(typeof result === 'object' && result !== null && 'error' in result && (result as {error?: unknown}).error)

// Stuck reads in a row, and how many WebDriver requests had succeeded at the first of them.
export type HangState = {stuck: number; commandsAtFirst: number}
export const NO_HANG: HangState = {commandsAtFirst: 0, stuck: 0}

// The state after one read. A read counts as stuck only when the main thread is in the snapshot and
// no WebDriver request has succeeded since the first stuck read: a healthy app answering one query
// after another (a long list read page by page) is often in the snapshot, but its requests succeed.
export const nextHangState = (s: HangState, read: {inSnapshot: boolean; commandsDone: number}): HangState => {
  if (!read.inSnapshot) return NO_HANG
  if (s.stuck > 0 && read.commandsDone === s.commandsAtFirst) return {...s, stuck: s.stuck + 1}
  return {commandsAtFirst: read.commandsDone, stuck: 1}
}

// The one watch running: starting one stops the one before it (a test mocha timed out never stopped
// its own), and stop() stops whichever runs. A stop returns what the watch found, if anything.
export const makeWatchSlot = () => {
  let current: (() => string | undefined) | undefined
  return {
    start: (stop: () => string | undefined) => {
      current?.()
      current = stop
    },
    stop: () => {
      const s = current
      current = undefined
      return s?.()
    },
  }
}

// four reads in a row, 45s or more apart from the first, with no request succeeding between them
export const STUCK_READS = 4
// the hang spins the main thread, a whole core
export const BUSY_CPU_PERCENT = 90

export type HangDeps = {
  appPid: () => number | undefined
  cpuPercent: (pid: number) => number
  // one second of the app's threads, as `sample` reports them
  sample: (pid: number) => Promise<string>
  // WebDriver requests that succeeded so far
  succeeded: () => number
  // keeps the hung app's sample; returns the reason the test fails of
  keep: (report: string) => string
  // kills the hung app and launches it again
  relaunch: () => Promise<void>
}

// One watch: read() is one look at the app (the caller runs it every READ_EVERY_MS, never two at
// once); `hung` resolves with the reason once it has relaunched a hung app; stop() ends it and says
// what it found. A read still in flight when the watch stops does nothing more after its await.
export const makeHangWatch = (deps: HangDeps) => {
  let state = NO_HANG
  let stopped = false
  // a call, so the check after an await reads what stop() set meanwhile
  const isStopped = () => stopped
  let hang: string | undefined
  let found: (why: string) => void = () => {}
  const hung = new Promise<string>(resolve => {
    found = resolve
  })
  const read = async () => {
    if (isStopped() || hang) return
    const pid = deps.appPid()
    // sampling slows the app for its second, so only an app busy on a whole core is sampled
    if (pid === undefined || deps.cpuPercent(pid) < BUSY_CPU_PERCENT) {
      state = NO_HANG
      return
    }
    const report = await deps.sample(pid)
    if (isStopped()) return
    state = nextHangState(state, {commandsDone: deps.succeeded(), inSnapshot: mainThreadInSnapshot(report)})
    if (state.stuck < STUCK_READS) return
    const why = deps.keep(report)
    hang = why
    try {
      await deps.relaunch()
    } finally {
      found(why)
    }
  }
  return {
    hung,
    read,
    stop: () => {
      stopped = true
      return hang
    },
  }
}
