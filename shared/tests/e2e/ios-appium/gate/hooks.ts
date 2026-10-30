// Root mocha hooks for the gate run. gate.test.ts imports this before any flow, so every flow's
// describes, tests and hooks go through the wrappers below and every test through the root hooks.
//
// Every test the run selects ends with a record: its attempts, or one failed record saying why it
// never ran (a hook failed first). A hook's error is kept so that record can cite it.
import * as path from 'path'
import {settleHangRelaunch, startHangWatch, stopHangWatch} from './hang.ts'
import {
  beginAttempt,
  endAttemptOf,
  endedRecord,
  failEndedAttempt,
  recordRunError,
  recordSkipped,
  runAttempt,
  type AttemptToken,
} from './attempt.ts'
import {requireAppIsSmoke} from './accounts.ts'
import {finishAttempt} from './finish.ts'
import {hookFailure, mochaGrep, testFileFromStack, timeoutMessage, unranTests} from './results-lib.ts'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Declare = (...args: Array<unknown>) => unknown
const plain = {
  after: globalThis.after,
  afterEach: globalThis.afterEach,
  before: globalThis.before,
  beforeEach: globalThis.beforeEach,
  describe: globalThis.describe,
  it: globalThis.it,
}

// each hook's error, which mocha keeps nowhere the root hooks can read
const hookErrors = new WeakMap<Mocha.Runnable, string>()
const kept = (fn: (this: Mocha.Context) => unknown) =>
  async function (this: Mocha.Context) {
    // read before the await: a timed-out hook rejects late, when this.test names a later runnable
    const runnable = this.test
    try {
      await fn.call(this)
    } catch (e) {
      if (runnable) hookErrors.set(runnable, message(e))
      throw e
    }
  }

type HookKind = '_beforeAll' | '_beforeEach' | '_afterEach' | '_afterAll'
const hooksOf = (s: Mocha.Suite, kinds: Array<HookKind>) =>
  kinds.flatMap(k => (s as unknown as Record<HookKind, Array<Mocha.Hook>>)[k])
const failuresOf = (suites: ReadonlyArray<Mocha.Suite>, kinds: Array<HookKind>) =>
  suites.flatMap(s => hooksOf(s, kinds).flatMap(h => hookFailure(h, hookErrors.get(h)) ?? []))

// A test or hook outside every describe would belong to no flow file (and such a hook would run for
// every flow's tests), so the flow file is refused as it loads.
let describeDepth = 0
const insideDescribe = (what: string) => {
  if (describeDepth > 0) return
  const msg = `${what} outside a describe in ${testFileFromStack(new Error().stack ?? '') ?? 'a flow file'}: declare gate tests and hooks inside a describe`
  recordRunError(msg)
  throw new Error(msg)
}

// mocha names the aggregator as the file of every test it imports, so each suite is credited to the
// flow file that declared it
const flowFiles = new WeakMap<Mocha.Suite, string>()
const declare = (d: (title: string, fn: (this: Mocha.Suite) => void) => unknown) =>
  function (title: string, fn: (this: Mocha.Suite) => void) {
    const suite = d(title, function (this: Mocha.Suite) {
      describeDepth++
      try {
        fn.call(this)
      } finally {
        describeDepth--
      }
    })
    const file = testFileFromStack(new Error().stack ?? '')
    if (file && suite) flowFiles.set(suite as Mocha.Suite, file)
    return suite
  }
globalThis.describe = Object.assign(declare(plain.describe), {
  only: declare(plain.describe.only),
  skip: declare(plain.describe.skip),
}) as Mocha.SuiteFunction
globalThis.xdescribe = globalThis.describe.skip
globalThis.context = globalThis.describe
globalThis.xcontext = globalThis.describe.skip

const declareTest = (t: Declare) =>
  function (this: unknown, ...args: Array<unknown>) {
    insideDescribe('a test')
    return t.apply(this, args)
  }
globalThis.it = Object.assign(declareTest(plain.it as Declare), {
  only: declareTest(plain.it.only as Declare),
  skip: declareTest(plain.it.skip as Declare),
}) as unknown as Mocha.TestFunction
globalThis.specify = globalThis.it
globalThis.xit = globalThis.it.skip
globalThis.xspecify = globalThis.it.skip

const declareHook = (h: Mocha.HookFunction<Mocha.Hook>) =>
  function (a: string | Mocha.AsyncFunc, b?: Mocha.AsyncFunc) {
    insideDescribe('a hook')
    if (typeof a === 'function') return h(kept(a))
    if (!b) throw new Error(`the hook "${a}" has no function`)
    return h(a, kept(b))
  } as Mocha.HookFunction<Mocha.Hook>
globalThis.before = declareHook(plain.before)
globalThis.beforeEach = declareHook(plain.beforeEach)
globalThis.afterEach = declareHook(plain.afterEach)
globalThis.after = declareHook(plain.after)

const flowFileOf = (test: Mocha.Test) => {
  for (let s: Mocha.Suite | undefined = test.parent; s; s = s.parent) {
    const file = flowFiles.get(s)
    if (file) return path.relative(process.cwd(), file)
  }
  throw new Error(`no flow file declared "${test.fullTitle()}": declare gate tests inside a describe`)
}

const suitesOf = (test: Mocha.Test) => {
  const out: Array<Mocha.Suite> = []
  for (let s: Mocha.Suite | undefined = test.parent; s; s = s.parent) out.push(s)
  return out
}

type Body = Mocha.AsyncFunc & {gateBody?: Mocha.AsyncFunc}

// each test object's attempt (a retry is a new test object)
const attempts = new WeakMap<Mocha.Test, AttemptToken>()
// why an attempt's body threw, for one wdio's afterTest never reached (the account check refused it)
const bodyErrors = new WeakMap<AttemptToken, string>()
// how long a body whose app hung gets to fail its stuck command and run its cleanup
const HUNG_BODY_SETTLE_MS = 120_000
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const NOT_RECORDED = 'the test passed, but wdio afterTest did not record its attempt'

plain.beforeEach(
  kept(function (this: Mocha.Context) {
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
      // An app stuck for good is killed and relaunched (hang.ts), and the test fails of its hang at
      // once: the body gets a bounded time for its stuck command to fail and its cleanup to run, then
      // the attempt ends, so anything of the body's still going finds it over.
      let hung: Promise<string> = new Promise(() => {})
      const run = runAttempt(token, async () => {
        // inside the attempt: a relaunch moves the attempt's recording to the app's new runtime. This
        // line runs before runAttempt returns (AsyncLocalStorage.run calls the callback at once, and
        // nothing awaits before it), so the race below already has the watch's promise.
        hung = startHangWatch()
        await requireAppIsSmoke()
        await body.call(this)
      })
      let hang: string | undefined
      try {
        hang = await Promise.race([run.then(() => undefined), hung])
        if (hang) {
          await Promise.race([run.catch(() => {}), sleep(HUNG_BODY_SETTLE_MS)])
          throw new Error(hang)
        }
      } catch (e) {
        hang ??= stopHangWatch()
        const failure = hang && message(e) !== hang ? new Error(`${hang}; then: ${message(e)}`, {cause: e}) : e
        if (!bodyErrors.has(token)) bodyErrors.set(token, message(failure))
        throw failure
      } finally {
        stopHangWatch()
      }
      const ended = endedRecord(token)
      if (ended?.status === 'failed') throw new Error(ended.error ?? 'the attempt failed')
      // failed here, not in the root afterEach: mocha retries a failed test, but a root afterEach that
      // throws ends the whole run
      if (!ended) {
        bodyErrors.set(token, NOT_RECORDED)
        throw new Error(NOT_RECORDED)
      }
    }
    wrapped.gateBody = body
    test.fn = wrapped
  })
)

// An attempt wdio's afterTest did not end (mocha timed it out, the account check refused it, a flow
// beforeEach failed) is ended here with the same failure details; one that passed is failed when a
// flow afterEach failed after it.
plain.afterEach(
  kept(async function (this: Mocha.Context) {
    // a body mocha timed out is still running and never stopped its watch, and a relaunch the watch
    // started may still be running
    stopHangWatch()
    await settleHangRelaunch()
    const test = this.currentTest
    const token = test && attempts.get(test)
    if (!test || !token) return
    const hookError = failuresOf(suitesOf(test), ['_beforeEach', '_afterEach']).join('; ') || undefined
    if (endedRecord(token)) {
      if (hookError) failEndedAttempt(token, hookError)
      return
    }
    if (test.isPending()) {
      endAttemptOf(token, {durationMs: test.duration ?? 0, status: 'skipped'})
      return
    }
    const error =
      hookError ??
      bodyErrors.get(token) ??
      (test.timedOut ? timeoutMessage(test.timeout()) : 'the attempt ended without wdio afterTest recording it')
    try {
      await runAttempt(token, async () => finishAttempt({duration: test.duration ?? 0, error: new Error(error), passed: false}))
    } catch (e) {
      // what kept afterTest from ending it can stop finishAttempt too; a throw here would end the run
      if (!endedRecord(token)) endAttemptOf(token, {durationMs: test.duration ?? 0, error: `${error}; ending it: ${message(e)}`, status: 'failed'})
    }
  })
)

// Every selected test that began no attempt is recorded at the run's end: a pending one as skipped,
// any other as failed with the hook failures that kept it from running. A suite's after hook fails
// no test, so its failure is a run error.
plain.after(
  kept(function (this: Mocha.Context) {
    let root = this.test?.parent
    while (root?.parent) root = root.parent
    if (!root) throw new Error('the gate after hook has no suite')
    const {neverRan, pending} = unranTests<Mocha.Test>(root, t => attempts.has(t), mochaGrep(process.env['KB_E2E_RELEASE_ONLY']))
    for (const t of pending) recordSkipped(flowFileOf(t), t.titlePath())
    for (const {test, suites} of neverRan) {
      const why = failuresOf(suites as Array<Mocha.Suite>, ['_beforeAll', '_beforeEach', '_afterEach']).join('; ')
      endAttemptOf(beginAttempt(flowFileOf(test), test.titlePath(), 0), {
        durationMs: 0,
        error: `never ran: ${why || 'mocha did not run it (the run stopped before it)'}`,
        status: 'failed',
      })
    }
    const walk = (s: Mocha.Suite) => {
      for (const f of failuresOf([s], ['_afterAll'])) recordRunError(`${s.fullTitle() || 'the root suite'}: ${f}`)
      s.suites.forEach(walk)
    }
    walk(root)
  })
)
