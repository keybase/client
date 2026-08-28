/* global afterEach, afterAll, expect, console */

// React reports real problems through console.error and nothing else -- an update
// outside act(), a missing key, an invalid prop. Those never failed a test, so they
// accumulated unnoticed. Collect them and fail the test that produced them.
//
// The collector installs at module load, not in beforeEach, so module scope and
// beforeAll are covered too. It still forwards to the real console.error.
//
// What is and is not caught, precisely:
//  - emitted by a test body: fails that test.
//  - emitted by module scope or beforeAll: fails at afterAll, unattributed.
//  - emitted by a file's own afterEach: this file registers first, so its afterEach
//    runs BEFORE the file's. The message is seen at the next test's drain, where it
//    is reported to the console but does NOT fail that test -- blaming an innocent
//    test hides the real failure and turns one timeout into a cascade.
//  - emitted by a file's own root-level afterAll: runs after this one, so it is
//    only printed. Not caught.
//  - emitted late by a timer or promise continuation: stamped with whichever test
//    was running at emission, which is not necessarily the one that scheduled it.
//
// To assert on a warning deliberately, spy on console.error in the test: the spy
// replaces this collector for that test and restores it afterwards. A spy installed
// in a describe-level beforeEach opts that whole describe out.
const seen = []
const original = console.error

console.error = (...args) => {
  let name = ''
  try {
    name = expect.getState().currentTestName ?? ''
  } catch {
    // expect's state is unavailable outside the test phase
  }
  seen.push({
    message: args.map(a => (a instanceof Error ? a.stack : String(a))).join(' '),
    test: name,
  })
  // keep it visible: a test failing for an unrelated reason should still show it
  original(...args)
}

const describeEntry = e => (e.test ? `[${e.test}] ${e.message}` : e.message)

afterEach(() => {
  if (!seen.length) return
  const collected = seen.splice(0, seen.length)
  let current = ''
  try {
    current = expect.getState().currentTestName ?? ''
  } catch {
    // as above
  }
  // Only fail on what THIS test emitted. A message stamped with another test
  // arrived late -- from a timer or a promise continuation that outlived it --
  // and failing here would blame an innocent test and hide the real failure,
  // which is how one timeout turns into a cascade.
  const mine = collected.filter(e => e.test === current)
  const theirs = collected.filter(e => e.test !== current)
  if (theirs.length) {
    original(
      `[fail-on-console] ${theirs.length} console.error(s) arrived during "${current}" but were emitted elsewhere:\n${theirs
        .map(describeEntry)
        .join('\n---\n')}`
    )
  }
  if (mine.length) {
    throw new Error(
      `console.error was called ${mine.length} time(s) during this test:\n\n${mine.map(describeEntry).join('\n---\n')}`
    )
  }
})

afterAll(() => {
  // whatever is left was emitted outside a test: module scope, beforeAll, or
  // after the last test finished. A file's own root-level afterAll runs after
  // this one, so anything it emits is reported by the console line above only.
  if (!seen.length) return
  const collected = seen.splice(0, seen.length)
  throw new Error(
    `console.error was called ${collected.length} time(s) in this file outside a test:\n\n${collected
      .map(describeEntry)
      .join('\n---\n')}`
  )
})
