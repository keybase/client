import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  addEndedAttemptError,
  attemptToken,
  beginAttempt,
  creditedSurfaces,
  creditSurface,
  currentAttempt,
  endAttempt,
  endAttemptOf,
  endedRecord,
  endRunningBodies,
  failEndedAttempt,
  iosReportDir,
  keepCleanupSteps,
  leaveBody,
  NEVER_ENDED,
  openAttemptToken,
  readAttempts,
  readRunErrors,
  recordRunError,
  recordSkipped,
  requireCurrentAttempt,
  runAttempt,
  runAttemptBody,
  runLeftSteps,
  settleBody,
  takeLeftCleanup,
} from './attempt'
import {setCleanupStepKeeper, withCleanup} from '../../shared/cleanup'

beforeEach(() => {
  process.env['KB_IOS_REPORT_DIR'] = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-attempt-'))
})
afterEach(() => {
  delete process.env['KB_IOS_REPORT_DIR']
  setCleanupStepKeeper(() => () => {})
})

const file = 'flows/x.test.ts'

test('outside a test body there is no current attempt', () => {
  beginAttempt(file, ['d', 't'], 0)
  expect(() => currentAttempt()).toThrow('no test attempt is running')
  expect(() => attemptToken()).toThrow('no test attempt is running')
})

test('a body reaches its attempt until the attempt ends', () => {
  const a = beginAttempt(file, ['d', 't'], 0)
  runAttempt(a, () => {
    const handle = currentAttempt()
    handle.addAttachment('coverage.json', 'application/json', '{}')
    expect(handle.nextStepIndex()).toBe(1)
    endAttempt({durationMs: 5, status: 'passed'})
    expect(() => currentAttempt()).toThrow('has already ended')
    expect(() => handle.annotate('card-step', 'x')).toThrow('has already ended')
    expect(() => endAttempt({durationMs: 1, status: 'failed'})).toThrow('has already ended')
  })
  expect(endedRecord(a)?.status).toBe('passed')
  const [rec] = readAttempts()
  expect(rec?.attachments.map(x => path.basename(x.path))).toEqual(['coverage.json'])
})

test('a timed-out body that finishes during its retry never touches the retry', async () => {
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const first = beginAttempt(file, ['d', 't'], 0)
  const stale = runAttempt(first, async () => {
    await gate
    currentAttempt().addAttachment('screenshot', 'image/png', Buffer.from('old'))
  })
  // mocha timed the first attempt out: afterEach ends it, and the retry begins
  endAttemptOf(first, {durationMs: 100, error: 'Timeout', status: 'failed'})
  const retry = beginAttempt(file, ['d', 't'], 1)
  await runAttempt(retry, async () => {
    release()
    await expect(stale).rejects.toThrow('has already ended')
    currentAttempt().addAttachment('coverage.json', 'application/json', '{}')
    endAttempt({durationMs: 7, status: 'passed'})
  })
  expect(readAttempts().map(r => [r.attempt, r.status, r.attachments.map(x => x.name)])).toEqual([
    [0, 'failed', []],
    [1, 'passed', ['coverage.json']],
  ])
})

test('a body mocha moved on from stops at its next call, while the hook ends its attempt', async () => {
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const a = beginAttempt(file, ['d', 't'], 0)
  let handle: ReturnType<typeof currentAttempt> | undefined
  const body = runAttemptBody(a, 'd t', async () => {
    handle = currentAttempt()
    expect(() => requireCurrentAttempt()).not.toThrow()
    await gate
    requireCurrentAttempt()
  })
  await new Promise<void>(resolve => setImmediate(resolve))
  // mocha timed the body out: the root afterEach begins, bound to the attempt but to no body
  expect(endRunningBodies()).toEqual(['d t'])
  release()
  await expect(body).rejects.toThrow('attempt over: d t')
  expect(() => handle?.nextStepIndex()).toThrow('attempt over: d t')
  expect(() => handle?.addAttachment('screenshot', 'image/png', Buffer.from('late'))).toThrow('attempt over: d t')
  runAttempt(a, () => {
    currentAttempt().addAttachment('screenshot', 'image/png', Buffer.from('x'))
    endAttempt({durationMs: 9, error: 'Timeout', status: 'failed'})
  })
  expect(readAttempts().map(r => [r.status, r.error, r.attachments.map(x => x.name)])).toEqual([['failed', 'Timeout', ['screenshot']]])
})

test("wdio's afterTest stops a body its timer gave up on, and its own capture is never refused", async () => {
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const a = beginAttempt(file, ['d', 'slow'], 0)
  const seen: Array<string> = []
  const check = (what: string) => {
    try {
      requireCurrentAttempt()
      seen.push(`${what}: ran`)
    } catch (e) {
      seen.push(`${what}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // wdio's test wrapper, inside the body's frame: it races the spec fn against its own timer, and runs
  // afterTest when the timer wins while the fn keeps going
  await runAttemptBody(a, 'd slow', async () => {
    const spec = (async () => {
      check('spec before')
      await gate
      check('spec after')
    })()
    await Promise.race([spec, new Promise<void>(resolve => setTimeout(resolve, 5))])
    const token = leaveBody()
    await runAttempt(token, async () => {
      check('capture')
      release()
      await spec
      check('capture after the spec')
      currentAttempt().addAttachment('screenshot', 'image/png', Buffer.from('x'))
      endAttempt({durationMs: 5, error: 'Timeout', status: 'failed'})
    })
  })
  expect(seen).toEqual(['spec before: ran', 'capture: ran', 'spec after: attempt over: d slow', 'capture after the spec: ran'])
  expect(readAttempts().map(r => [r.status, r.attachments.map(x => x.name)])).toEqual([['failed', ['screenshot']]])
})

test('a pending test is recorded as one skipped attempt', () => {
  recordSkipped(file, ['d', 'skipped one'])
  expect(readAttempts()).toEqual([
    {annotations: [], attachments: [], attempt: 0, durationMs: 0, file, status: 'skipped', titlePath: ['d', 'skipped one']},
  ])
})

test('an attempt is a failure from the moment it begins until it ends', () => {
  const a = beginAttempt(file, ['d', 't'], 0)
  expect(readAttempts().map(r => [r.status, r.error])).toEqual([['failed', NEVER_ENDED]])
  endAttemptOf(a, {durationMs: 3, status: 'passed'})
  expect(readAttempts().map(r => [r.status, r.error])).toEqual([['passed', undefined]])
})

test('a passed attempt can be failed after it ended, a failed one keeps its reason', () => {
  const passed = beginAttempt(file, ['d', 'p'], 0)
  expect(() => failEndedAttempt(passed, 'x')).toThrow('has not ended')
  endAttemptOf(passed, {durationMs: 3, status: 'passed'})
  expect(failEndedAttempt(passed, '"after each" hook failed: boom')).toMatchObject({error: '"after each" hook failed: boom', status: 'failed'})
  const failed = beginAttempt(file, ['d', 'f'], 0)
  endAttemptOf(failed, {durationMs: 3, error: 'first', status: 'failed'})
  failEndedAttempt(failed, 'second')
  expect(readAttempts().map(r => [r.titlePath.at(-1), r.status, r.error])).toEqual([
    ['p', 'failed', '"after each" hook failed: boom'],
    ['f', 'failed', 'first'],
  ])
})

test('an ended attempt can be failed for a crash after its body, keeping a reason it had', () => {
  const passed = beginAttempt(file, ['d', 'p'], 0)
  expect(() => addEndedAttemptError(passed, 'x')).toThrow('has not ended')
  endAttemptOf(passed, {durationMs: 3, status: 'passed'})
  addEndedAttemptError(passed, 'the app crashed')
  const failed = beginAttempt(file, ['d', 'f'], 0)
  endAttemptOf(failed, {durationMs: 3, error: 'first', status: 'failed'})
  addEndedAttemptError(failed, 'the app crashed')
  expect(readAttempts().map(r => [r.titlePath.at(-1), r.status, r.error])).toEqual([
    ['p', 'failed', 'the app crashed'],
    ['f', 'failed', 'first; the app crashed'],
  ])
})

test('the open attempt is the running body\'s until it ends, and none outside one', () => {
  const token = beginAttempt(file, ['d', 'o'], 0)
  expect(openAttemptToken()).toBeUndefined()
  runAttempt(token, () => {
    expect(openAttemptToken()).toBe(token)
    endAttemptOf(token, {durationMs: 1, status: 'passed'})
    expect(openAttemptToken()).toBeUndefined()
  })
})

test('run errors are kept once each, in the order they were recorded', () => {
  expect(readRunErrors()).toEqual([])
  recordRunError('one')
  recordRunError('two')
  recordRunError('one')
  expect(readRunErrors()).toEqual(['one', 'two'])
})

test('the report dir defaults to shared/tests/results/ios-report', () => {
  delete process.env['KB_IOS_REPORT_DIR']
  expect(iosReportDir()).toBe(path.resolve(__dirname, '../../../results/ios-report'))
  expect(iosReportDir().endsWith(path.join('shared', 'tests', 'results', 'ios-report'))).toBe(true)
})

test('surfaces are credited to the running attempt once each, and only inside one', () => {
  expect(() => creditSurface('relaunch')).toThrow('no test attempt is running')
  const a = beginAttempt(file, ['d', 't'], 0)
  runAttempt(a, () => {
    creditSurface('deep-link')
    creditSurface('relaunch')
    creditSurface('deep-link')
    expect(creditedSurfaces()).toEqual(['deep-link', 'relaunch'])
  })
  const b = beginAttempt(file, ['d', 't'], 1)
  runAttempt(b, () => expect(creditedSurfaces()).toEqual([]))
})

const tick = async () => new Promise<void>(resolve => setImmediate(resolve))

test('a body the gate ends before its cleanup hands the restores it had left to the root afterEach', async () => {
  setCleanupStepKeeper(keepCleanupSteps)
  const a = beginAttempt(file, ['d', 'hung'], 0)
  const ran: Array<string> = []
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  const body = runAttemptBody(a, 'd hung', async () =>
    withCleanup(
      async () =>
        withCleanup(
          async () => {
            await stuck
            requireCurrentAttempt()
          },
          [() => ran.push('inner restore')]
        ),
      [() => ran.push('outer restore'), () => ran.push('back to smoke')]
    )
  )
  await tick()
  // the hang watch relaunched the app: the gate ends the body while its command is stuck
  expect(endRunningBodies()).toEqual(['d hung'])
  release()
  await expect(body).rejects.toThrow('attempt over: d hung')
  // the over body ran none of them itself
  expect(ran).toEqual([])
  const left = takeLeftCleanup(a) ?? []
  for (const s of left) s()
  expect(ran).toEqual(['inner restore', 'outer restore', 'back to smoke'])
  // handed over once
  expect(takeLeftCleanup(a)).toBeUndefined()
})

test('a body ended while a restore ran hands over that restore too, and runs nothing after it', async () => {
  setCleanupStepKeeper(keepCleanupSteps)
  const a = beginAttempt(file, ['d', 'hung in cleanup'], 0)
  const ran: Array<string> = []
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  const first = async () => {
    ran.push('first started')
    await stuck
    requireCurrentAttempt()
  }
  const second = () => ran.push('second')
  const body = runAttemptBody(a, 'd hung in cleanup', async () => withCleanup(async () => {}, [first, second]))
  await tick()
  endRunningBodies()
  release()
  await expect(body).rejects.toThrow('attempt over')
  expect(ran).toEqual(['first started'])
  const left = takeLeftCleanup(a) ?? []
  expect(left).toHaveLength(2)
  expect(left[1]).toBe(second)
  // the body's run of the restore was cut off, so the root afterEach runs it again
  for (const s of left) await s()
  expect(ran).toEqual(['first started', 'first started', 'second'])
})

test("wdio's afterTest on a body whose test function settled hands nothing over", async () => {
  setCleanupStepKeeper(keepCleanupSteps)
  const a = beginAttempt(file, ['d', 'passed'], 0)
  const ran: Array<string> = []
  await runAttemptBody(a, 'd passed', async () => {
    // the test function, as gate/hooks.ts wraps it
    try {
      await withCleanup(async () => {}, [() => ran.push('restore')])
    } finally {
      settleBody()
    }
    // wdio's afterTest, still inside the body's frame
    const token = leaveBody()
    runAttempt(token, () => {
      requireCurrentAttempt()
      endAttempt({durationMs: 1, status: 'passed'})
    })
  })
  expect(ran).toEqual(['restore'])
  expect(takeLeftCleanup(a)).toBeUndefined()
  expect(readAttempts().map(r => r.status)).toEqual(['passed'])
})

test('the steps a body left are stopped at their deadline: their next app command throws', async () => {
  const a = beginAttempt(file, ['d', 'slow cleanup'], 0)
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  const seen: Array<string> = []
  let after: Promise<void> = Promise.resolve()
  const slow = async () => {
    requireCurrentAttempt()
    seen.push('slow started')
    after = (async () => {
      await stuck
      try {
        requireCurrentAttempt()
        seen.push('slow drove the app')
      } catch (e) {
        seen.push(e instanceof Error ? e.message : String(e))
      }
    })()
    await after
  }
  const errors = await runLeftSteps(a, [() => seen.push('first'), slow, () => seen.push('never')], 20, 'left steps')
  expect(errors).toEqual(['left steps: not done in 0.02s; stopped it'])
  release()
  await after
  await tick()
  expect(seen).toEqual(['first', 'slow started', 'attempt over: left steps'])
})

test('the steps a body left run as the attempt, each whether an earlier one threw', async () => {
  const a = beginAttempt(file, ['d', 'left'], 0)
  const seen: Array<string> = []
  const errors = await runLeftSteps(
    a,
    [
      () => {
        throw new Error('first failed')
      },
      () => {
        requireCurrentAttempt()
        seen.push('second')
      },
    ],
    5_000,
    'left steps'
  )
  expect(errors).toEqual(['first failed'])
  expect(seen).toEqual(['second'])
})

test("a body that settles keeps nothing for the root afterEach, and a hook's cleanup is never kept", async () => {
  setCleanupStepKeeper(keepCleanupSteps)
  const a = beginAttempt(file, ['d', 'ok'], 0)
  const ran: Array<string> = []
  await runAttemptBody(a, 'd ok', async () => withCleanup(async () => {}, [() => ran.push('restore')]))
  expect(endRunningBodies()).toEqual([])
  expect(takeLeftCleanup(a)).toBeUndefined()
  await runAttempt(a, async () => withCleanup(async () => {}, [() => ran.push('hook restore')]))
  expect(ran).toEqual(['restore', 'hook restore'])
  expect(takeLeftCleanup(a)).toBeUndefined()
})

test("wdio's afterTest ending a running body hands its cleanup over too", async () => {
  setCleanupStepKeeper(keepCleanupSteps)
  const a = beginAttempt(file, ['d', 'wdio'], 0)
  let release = () => {}
  const stuck = new Promise<void>(resolve => (release = resolve))
  const restore = () => {}
  const body = runAttemptBody(a, 'd wdio', async () =>
    withCleanup(async () => {
      const done = stuck.then(() => requireCurrentAttempt())
      leaveBody()
      await done
    }, [restore])
  )
  await tick()
  release()
  await expect(body).rejects.toThrow('attempt over')
  expect(takeLeftCleanup(a)).toEqual([restore])
})
