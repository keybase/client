/* global beforeEach, afterEach, console */

// React reports real problems through console.error and nothing else -- an
// update outside act(), a missing key, an invalid prop. Those never failed a
// test, so they accumulated unnoticed. Collect them per test and fail on them.
//
// To assert on a warning deliberately, spy on console.error in the test: the
// spy replaces this collector for that test and restores it afterwards.
const seen = []
let original = console.error

beforeEach(() => {
  seen.length = 0
  original = console.error
  console.error = (...args) => {
    seen.push(args.map(a => (a instanceof Error ? a.stack : String(a))).join(' '))
  }
})

afterEach(() => {
  const collected = seen.slice()
  console.error = original
  seen.length = 0
  if (collected.length) {
    throw new Error(
      `console.error was called ${collected.length} time(s) during this test:\n\n${collected.join('\n---\n')}`
    )
  }
})
