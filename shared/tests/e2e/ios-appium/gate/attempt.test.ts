import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  attemptToken,
  beginAttempt,
  currentAttempt,
  endAttempt,
  endAttemptOf,
  endedRecord,
  readAttempts,
  recordSkipped,
  runAttempt,
} from './attempt'

const cwd = process.cwd()
beforeEach(() => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-attempt-')))
})
afterEach(() => {
  process.chdir(cwd)
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

test('a pending test is recorded as one skipped attempt', () => {
  recordSkipped(file, ['d', 'skipped one'])
  expect(readAttempts()).toEqual([
    {annotations: [], attachments: [], attempt: 0, durationMs: 0, file, status: 'skipped', titlePath: ['d', 'skipped one']},
  ])
})
