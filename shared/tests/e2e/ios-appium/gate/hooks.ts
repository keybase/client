// Root mocha hooks for the gate run. gate.test.ts imports this before any flow, so every flow's
// describes, tests and hooks go through the wrappers below and every test through the root hooks.
//
// Every test the run selects ends with a record: its attempts, or one failed record saying why it
// never ran (a hook failed first). A hook's error is kept so that record can cite it.
import * as path from 'path'
import {HANG_SETTLE_MS, RELAUNCH_MS, settleHangRelaunch, startHangWatch, stopHangWatch} from './hang.ts'
import {setBeforeCleanupSteps, setCleanupStepKeeper} from '../../shared/cleanup.ts'
import {CRASH_RECOVERY_MS, crashDuringAttempt, recoverGoneApp, settleCrashRecovery} from './crash.ts'
import {
  addEndedAttemptError,
  beginAttempt,
  endAttemptOf,
  endedRecord,
  endRunningBodies,
  failEndedAttempt,
  keepCleanupSteps,
  recordRunError,
  recordSkipped,
  runAttempt,
  runAttemptBody,
  runLeftSteps,
  settleBody,
  takeLeftCleanup,
  type AttemptToken,
} from './attempt.ts'
import {RELAUNCHED_SMOKE_MS, requireAppIsSmoke, requireRelaunchedAppIsSmoke, restoreToSmoke} from './accounts.ts'
import {isAttemptOver} from './attempt-binding-lib.ts'
import {relaunchHungApp} from './device.ts'
import {finishAttempt} from './finish.ts'
import {APP_POISON, gatePoisoned, isGatePoisonedBy, poisonCheckedFirst, poisonGate, requireGateNotPoisoned} from './poison-lib.ts'
import {bailEverySuite, makeFailureStreak, maxConsecutiveFailures} from './run-stop-lib.ts'
import {timed} from '../../shared/gate/timing.ts'
import {withDeadline} from '../../shared/deadline.ts'
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
// Every hook, the root ones included, runs through this. Mocha runs a hook only once it is done with
// the test body before it, so a body still running is one it timed out: it is over from here, and its
// next app command throws. The hook runs bound to no body, whatever context it inherited.
const kept = (fn: (this: Mocha.Context) => unknown) =>
  async function (this: Mocha.Context) {
    for (const title of endRunningBodies()) {
      // eslint-disable-next-line no-console
      console.log(`mocha moved on from "${title}" while its body still ran: the body's next app command throws`)
    }
    // read before the await: a timed-out hook rejects late, when this.test names a later runnable
    const runnable = this.test
    try {
      await runAttempt(undefined, () => fn.call(this))
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

// A test body that ends (passed or not) with the app crashed fails of the crash, after the app is
// relaunched inside its attempt (crash.ts), so its afterTest and the flow's afterEach find an app.
const crashCheckedAfter = (fn: Mocha.AsyncFunc): Mocha.AsyncFunc =>
  async function (this: Mocha.Context) {
    let failure: {e: unknown} | undefined
    try {
      await fn.call(this)
    } catch (e) {
      failure = {e}
    }
    const crash = await crashDuringAttempt()
    if (crash) throw failure ? new Error(`${crash}; then: ${message(failure.e)}`, {cause: failure.e}) : new Error(crash)
    if (failure) throw failure.e
  }

// Each test function marks its body settled as it ends, so wdio's afterTest, which runs after it in
// the body's frame, tells a body that ended on its own from one its timer gave up on.
const settling = (fn: Mocha.AsyncFunc): Mocha.AsyncFunc =>
  async function (this: Mocha.Context) {
    try {
      await fn.call(this)
    } finally {
      settleBody()
    }
  }
const declareTest = (t: Declare) =>
  function (this: unknown, ...args: Array<unknown>) {
    insideDescribe('a test')
    // the crash check is part of the body, so the body settles after it; a done-callback body
    // (length > 0) gets no crash check: gate bodies are async
    return t.apply(
      this,
      args.map(a =>
        typeof a === 'function' ? settling(a.length === 0 ? crashCheckedAfter(a as Mocha.AsyncFunc) : (a as Mocha.AsyncFunc)) : a
      )
    )
  }
globalThis.it = Object.assign(declareTest(plain.it as Declare), {
  only: declareTest(plain.it.only as Declare),
  skip: declareTest(plain.it.skip as Declare),
}) as unknown as Mocha.TestFunction
globalThis.specify = globalThis.it
globalThis.xit = globalThis.it.skip
globalThis.xspecify = globalThis.it.skip

// A flow afterEach first waits for a hung app's relaunch (hang.ts) or a gone app's recovery
// (crash.ts) still running, so it never drives an app that is restarting.
const settledFirst = (fn: Mocha.AsyncFunc): Mocha.AsyncFunc =>
  async function (this: Mocha.Context) {
    // the waits' own bounds; a hook that sets its timeout restarts it from there
    this.timeout(HANG_SETTLE_MS + CRASH_RECOVERY_MS + 30_000)
    await settleHangRelaunch()
    await settleCrashRecovery()
    return fn.call(this)
  }

// A flow's before and beforeEach hooks refuse first while the gate is poisoned (poison-lib.ts): they
// run ahead of the root beforeEach's check in the test body, and set the phone up for their file.
const declareHook = (h: Mocha.HookFunction<Mocha.Hook>, first?: 'settle' | 'poison') =>
  function (a: string | Mocha.AsyncFunc, b?: Mocha.AsyncFunc) {
    insideDescribe('a hook')
    const wrap = (fn: Mocha.AsyncFunc) => kept(first === 'settle' ? settledFirst(fn) : first === 'poison' ? poisonCheckedFirst(fn) : fn)
    if (typeof a === 'function') return h(wrap(a))
    if (!b) throw new Error(`the hook "${a}" has no function`)
    return h(a, wrap(b))
  } as Mocha.HookFunction<Mocha.Hook>
// a test body's own cleanup steps wait the same way, and find a crashed app relaunched
setBeforeCleanupSteps(async () => {
  await settleHangRelaunch()
  await crashDuringAttempt()
})
// and are kept with the body, for the root afterEach to take over if the gate ends it
setCleanupStepKeeper(keepCleanupSteps)

// The largest cleanup a flow declares (account-login's, 685s), waiting out the step the body was
// running (RUNNING_STEP_WAIT_MS, 60s) and restoreToSmoke (275s) = 1020s.
const LEFT_CLEANUP_MS = 1_060_000

// A body the gate ended while it still ran (its app hung and was relaunched, or mocha or wdio timed
// it out) had every app command of its own refused from then, its cleanup's included. What that
// cleanup had left runs here instead, after the relaunch, and then the app is put back on the smoke
// account and read back (every flow ends there). Returns why it failed, if it did.
const runLeftCleanup = async (token: AttemptToken, steps: Array<() => unknown>): Promise<string | undefined> => {
  const backOnSmoke = async () => {
    try {
      await restoreToSmoke()
    } catch (e) {
      throw new Error(`putting the app back on the smoke account: ${message(e)}`, {cause: e})
    }
  }
  const errors = await runLeftSteps(token, [...steps, backOnSmoke], LEFT_CLEANUP_MS, 'the cleanup the ended body left')
  return errors.length ? `the cleanup its body left, run once the gate ended the body, failed: ${errors.join('; ')}` : undefined
}

globalThis.before = declareHook(plain.before, 'poison')
globalThis.beforeEach = declareHook(plain.beforeEach, 'poison')
globalThis.afterEach = declareHook(plain.afterEach, 'settle')
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
const NOT_RECORDED = 'the test passed, but wdio afterTest did not record its attempt'

// mocha keeps a test's retry count off its public type
const currentRetry = (test: Mocha.Test) => (test as unknown as {currentRetry: () => number}).currentRetry()

// Why the run stopped early (run-stop-lib.ts), once it has.
let stopped: string | undefined
const stopRun = (test: Mocha.Test, why: string) => {
  if (stopped) return
  stopped = why
  let root = test.parent
  while (root?.parent) root = root.parent
  if (root) bailEverySuite(root)
  console.log(`[ios gate] stopping the run at "${test.fullTitle()}": ${why}`)
  recordRunError(`stopped the run at "${test.fullTitle()}": ${why}`)
}
const noteFinalResult = makeFailureStreak(maxConsecutiveFailures())

// the relaunch and its read-back on the smoke account
const SMOKE_RELAUNCH_MS = RELAUNCH_MS + RELAUNCHED_SMOKE_MS + 10_000

// An app an earlier test left off the smoke account (its restore failed, so it sits signed out or on
// the second account) is relaunched once: the relaunch signs the smoke account back in from its
// stored secret. One a relaunch does not put back poisons the gate, which stops the run. The account
// is read as a just-started runtime is (requireRelaunchedAppIsSmoke), since an app a flow launched
// reports signed out until its service answers; a read that fails is a reason to relaunch too,
// never a throw out of the root hook, which would end the run with no reason given.
const backOnSmoke = async (title: string) => {
  if (gatePoisoned()) return
  let off: string | undefined
  try {
    await requireRelaunchedAppIsSmoke()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    off = message(e)
  }
  if (!off) return
  try {
    await withDeadline(
      (async () => {
        await relaunchHungApp()
        await requireRelaunchedAppIsSmoke()
      })(),
      SMOKE_RELAUNCH_MS,
      'relaunching the app back onto the smoke account'
    )
    recordRunError(`before "${title}": ${off}; a relaunch put it back on the smoke account`)
  } catch (e) {
    poisonGate(APP_POISON, 'sign the Keybase app on the simulator back in as KB_SMOKE_USER')
    recordRunError(`before "${title}": ${off}; a relaunch did not put it back: ${message(e)}`)
  }
}

plain.beforeEach(
  kept(async function (this: Mocha.Context) {
    this.timeout(CRASH_RECOVERY_MS + SMOKE_RELAUNCH_MS + 30_000)
    const test = this.currentTest
    if (!test?.fn) throw new Error('the gate hooks ran outside a test')
    // The app went away after the root afterEach saw it (a flow's after or before hook): it is brought
    // back before this test's hooks drive it. A recovery that fails poisons the gate (crash.ts), so this
    // test and every later one is refused with why.
    const gone = await timed('command', 'gate: before, the app gone check', async () => recoverGoneApp())
    if (gone) recordRunError(`before "${test.fullTitle()}": ${gone}`)
    await timed('command', 'gate: before, the account check', async () => backOnSmoke(test.fullTitle()))
    // A poisoned gate refuses this test (below) and every later one: the run stops after this one
    // instead of refusing each in turn.
    const poisoned = gatePoisoned()
    if (poisoned) stopRun(test, poisoned)
    const retry = currentRetry(test)
    const token = await timed('command', 'gate: before, the attempt record', () => beginAttempt(flowFileOf(test), test.titlePath(), retry))
    attempts.set(test, token)
    // wdio's afterTest (wdio.gate.conf.ts) cannot change a result, so a body that passed is failed
    // here when the attempt's record says it failed (a passing test whose coverage was not recorded).
    // A retry clones the test with this wrapper as its body, so the original body is kept on it.
    const body = ((test.fn as Body).gateBody ?? test.fn) as Mocha.AsyncFunc
    const wrapped: Body = async function (this: Mocha.Context) {
      // An app stuck for good is killed and relaunched (hang.ts), and the test fails of its hang at
      // once. The body is over from then, so its stuck command's next one throws attempt over and the
      // hooks after it drive the relaunched app.
      let hung: Promise<string> = new Promise(() => {})
      const run = runAttemptBody(token, test.fullTitle(), async () => {
        // inside the body: the watch reads the app as the body, and its relaunch moves the attempt's
        // recording to the app's new runtime. This line runs before runAttemptBody returns (it calls
        // AsyncLocalStorage.run, which calls the callback at once, and nothing awaits before either),
        // so the race below already has the watch's promise.
        hung = startHangWatch()
        // a phone an earlier flow could not put back (poison-lib.ts) is never driven again
        requireGateNotPoisoned()
        await requireAppIsSmoke()
        await body.call(this)
      })
      let hang: string | undefined
      try {
        hang = await Promise.race([run.then(() => undefined), hung])
        if (hang) {
          // the body is the only one running: mocha ended any earlier one as a hook began
          endRunningBodies()
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

// Ends an attempt wdio's afterTest did not end, or fails one that ended passed for what failed after
// its body. `gone` is why the app was gone at the test's end (crash.ts), and `cleanupError` why the
// cleanup its ended body left failed, each of which fails it either way.
const endTheAttempt = async (
  test: Mocha.Test,
  token: AttemptToken,
  gone: string | undefined,
  cleanupError: string | undefined
) => {
  const hookError = failuresOf(suitesOf(test), ['_beforeEach', '_afterEach']).join('; ') || undefined
  const ended = endedRecord(token)
  if (ended) {
    const after = [hookError, cleanupError].filter(Boolean).join('; ')
    if (after) failEndedAttempt(token, after)
    // a crash the body already failed of is in its error
    if (gone && !endedRecord(token)?.error?.includes(gone)) addEndedAttemptError(token, gone)
    return
  }
  if (test.isPending()) {
    endAttemptOf(token, {durationMs: test.duration ?? 0, status: 'skipped'})
    return
  }
  // a timed-out body's own error came after the timeout (its next app command threw attempt over)
  const cause =
    hookError ??
    (test.timedOut ? timeoutMessage(test.timeout()) : (bodyErrors.get(token) ?? 'the attempt ended without wdio afterTest recording it'))
  const crashed = gone && !cause.includes(gone) ? `${gone}; then: ${cause}` : cause
  const error = cleanupError ? `${crashed}; then ${cleanupError}` : crashed
  try {
    await runAttempt(token, async () => finishAttempt({duration: test.duration ?? 0, error: new Error(error), passed: false}))
  } catch (e) {
    // what kept afterTest from ending it can stop finishAttempt too; a throw here would end the run
    if (!endedRecord(token)) endAttemptOf(token, {durationMs: test.duration ?? 0, error: `${error}; ending it: ${message(e)}`, status: 'failed'})
  }
}

// An attempt wdio's afterTest did not end (mocha timed it out, the account check refused it, a flow
// beforeEach failed) is ended here with the same failure details; one that passed is failed when a
// flow afterEach failed after it or the app was gone at its end.
plain.afterEach(
  kept(async function (this: Mocha.Context) {
    // waiting out a relaunch (HANG_SETTLE_MS), bringing back a gone app (CRASH_RECOVERY_MS), the cleanup
    // an ended body left (LEFT_CLEANUP_MS), then ending the attempt (its screenshot and logs, 90s)
    this.timeout(HANG_SETTLE_MS + CRASH_RECOVERY_MS + LEFT_CLEANUP_MS + 90_000)
    // a body mocha timed out is still running and never stopped its watch, and a relaunch the watch
    // started may still be running
    stopHangWatch()
    await timed('command', 'gate: after, a hang relaunch settled', async () => settleHangRelaunch())
    const test = this.currentTest
    const token = test && attempts.get(test)
    // An app gone now went away during this test where its body's own check did not see it (mocha
    // timed the body out, or a flow afterEach): it is brought back, inside the attempt while that is
    // open, and the test fails of it. A recovery that fails poisons the gate (crash.ts), so every later
    // test is refused with why.
    const gone = await timed('command', 'gate: after, the app gone check', async () => recoverGoneApp(token))
    if (!test || !token) return
    // What an ended body's cleanup left runs on the app brought back, never on one the gate could not.
    const left = takeLeftCleanup(token)
    const cleanupError = left && !isGatePoisonedBy(APP_POISON) ? await timed('command', 'gate: after, left cleanup', async () => runLeftCleanup(token, left)) : undefined
    // the next test refuses on its own (requireAppIsSmoke) when the app is not back on smoke
    if (cleanupError) recordRunError(`${test.fullTitle()}: ${cleanupError}`)
    await timed('command', 'gate: after, the attempt ended', async () => endTheAttempt(test, token, gone, cleanupError))
    // an attempt mocha retries is not the test's result yet: mocha retries only what it failed, not an
    // attempt failed here after a body that passed (a gone app, a cleanup error)
    const failed = endedRecord(token)?.status === 'failed'
    if (test.state === 'failed' && currentRetry(test) < test.retries()) return
    const why = noteFinalResult(test.fullTitle(), failed)
    if (why) stopRun(test, why)
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
