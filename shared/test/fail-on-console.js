/* global afterEach, afterAll, expect, console */

// React reports real problems through console.error and nothing else -- an update
// outside act(), a missing key, an invalid prop. Those never failed a test, so they
// accumulated unnoticed. Collect them and fail the test that produced them.
//
// The collector is installed once at module load rather than in beforeEach, so it
// also covers module scope, beforeAll/afterAll, and a file's own afterEach hooks
// (which run BEFORE this file's, since this one registers first). Each entry is
// stamped with the test that was running when it was emitted, so a message that
// arrives late -- from a timer or a promise continuation after the test resolved --
// is still reported against the right test rather than the next one.
//
// To assert on a warning deliberately, spy on console.error in the test: the spy
// replaces this collector for that test and restores it afterwards. Note a spy
// installed in a describe-level beforeEach opts that whole describe out.
const seen = []
const original = console.error

console.error = (...args) => {
  let name = '<outside a test>'
  try {
    name = expect.getState().currentTestName ?? name
  } catch {
    // expect's state is unavailable outside the test phase
  }
  seen.push({
    message: args.map(a => (a instanceof Error ? a.stack : String(a))).join(' '),
    test: name,
  })
}

const drain = where => {
  if (!seen.length) return
  const collected = seen.splice(0, seen.length)
  const detail = collected.map(e => `[${e.test}] ${e.message}`).join('\n---\n')
  throw new Error(`console.error was called ${collected.length} time(s) during ${where}:\n\n${detail}`)
}

// deliberately no beforeEach reset: a file's own afterEach runs AFTER this one, so
// clearing here would silently discard whatever it emitted
afterEach(() => {
  drain('this test')
})

afterAll(() => {
  // anything emitted outside a test: module scope, beforeAll/afterAll, or after the
  // last test finished
  drain('this file, outside a test')
})
