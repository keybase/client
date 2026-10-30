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

// The count of Appium commands that succeeded, after one more completed: one that failed is not
// counted, since a hung app keeps failing them (WDA timeouts, polls that give up), and only a
// command that got an answer shows the app is not stuck.
export const countCommand = (done: number, error: unknown) => (error ? done : done + 1)

// Stuck reads in a row, and how many Appium commands had succeeded at the first of them.
export type HangState = {stuck: number; commandsAtFirst: number}
export const NO_HANG: HangState = {commandsAtFirst: 0, stuck: 0}

// The state after one read. A read counts as stuck only when the main thread is in the snapshot and
// no Appium command has succeeded since the first stuck read: a healthy app answering one query
// after another (a long list read page by page) is often in the snapshot, but its commands succeed.
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
