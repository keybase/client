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

// Counts reads in a row that found the main thread in the snapshot; a read that did not resets it.
export const nextStuckReads = (stuck: number, inSnapshot: boolean) => (inSnapshot ? stuck + 1 : 0)
