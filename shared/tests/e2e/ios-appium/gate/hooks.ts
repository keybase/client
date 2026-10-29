// Root mocha hooks for the gate run. gate.test.ts imports this before any flow, so every flow's
// describes go through the wrapper below and every test through the root hooks.
import * as path from 'path'
import {beginAttempt, endAttemptOf, endedRecord, recordSkipped, runAttempt, type AttemptToken} from './attempt.ts'
import {testFileFromStack, unranPendingTests} from './results-lib.ts'

// mocha names the aggregator as the file of every test it imports, so each suite is credited to the
// flow file that declared it
const flowFiles = new WeakMap<Mocha.Suite, string>()
const declare = (d: (title: string, fn: (this: Mocha.Suite) => void) => unknown) =>
  function (title: string, fn: (this: Mocha.Suite) => void) {
    const suite = d(title, fn)
    const file = testFileFromStack(new Error().stack ?? '')
    if (file && suite) flowFiles.set(suite as Mocha.Suite, file)
    return suite
  }
const plainDescribe = globalThis.describe
globalThis.describe = Object.assign(declare(plainDescribe), {
  only: declare(plainDescribe.only),
  skip: declare(plainDescribe.skip),
}) as Mocha.SuiteFunction
globalThis.xdescribe = globalThis.describe.skip

const flowFileOf = (test: Mocha.Test) => {
  for (let s: Mocha.Suite | undefined = test.parent; s; s = s.parent) {
    const file = flowFiles.get(s)
    if (file) return path.relative(process.cwd(), file)
  }
  throw new Error(`no flow file declared "${test.fullTitle()}": declare gate tests inside a describe`)
}

type Body = Mocha.AsyncFunc & {gateBody?: Mocha.AsyncFunc}

// each test object's attempt (a retry is a new test object)
const attempts = new WeakMap<Mocha.Test, AttemptToken>()

beforeEach(function () {
  const test = this.currentTest
  if (!test?.fn) throw new Error('the gate hooks ran outside a test')
  const retry = (test as unknown as {currentRetry: () => number}).currentRetry()
  const token = beginAttempt(flowFileOf(test), test.titlePath(), retry)
  attempts.set(test, token)
  // wdio's afterTest (wdio.gate.conf.ts) cannot change a result, so a body that passed is failed
  // here when the attempt's record says it failed (a passing test whose coverage was not recorded).
  // A retry clones the test with this wrapper as its body, so the original body is kept on it.
  const body = ((test.fn as Body).gateBody ?? test.fn) as Mocha.AsyncFunc
  const wrapped: Body = async function (this: Mocha.Context) {
    await runAttempt(token, async () => {
      await body.call(this)
    })
    const ended = endedRecord(token)
    if (ended?.status === 'failed') throw new Error(ended.error ?? 'the attempt failed')
  }
  wrapped.gateBody = body
  test.fn = wrapped
})

// An attempt wdio's afterTest did not end (mocha timed it out first) is recorded from mocha's view.
afterEach(function () {
  const test = this.currentTest
  const token = test && attempts.get(test)
  if (!test || !token || endedRecord(token)) return
  endAttemptOf(token, {
    durationMs: test.duration ?? 0,
    error: test.err?.message ?? 'the attempt ended without wdio afterTest recording it',
    status: test.state === 'pending' ? 'skipped' : test.state === 'passed' ? 'passed' : 'failed',
  })
})

// mocha runs no hooks for a pending test, so the run's pending tests are recorded skipped at its end
after(function () {
  let root = this.test?.parent
  while (root?.parent) root = root.parent
  if (!root) throw new Error('the gate after hook has no suite')
  for (const t of unranPendingTests(root, x => attempts.has(x))) recordSkipped(flowFileOf(t), t.titlePath())
})
