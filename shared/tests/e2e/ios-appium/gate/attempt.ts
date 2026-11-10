// The test attempts of this worker: what the harness attaches to each and, once it ends, its record on
// disk. Attachments are written as they arrive, so a run never holds them in memory.
//
// An attempt is bound to the test body that runs it (runAttemptBody), not to whichever attempt began
// last: a body mocha timed out keeps running after its retry has begun, and must never touch the
// retry's attempt. Once mocha has moved on from a body, the body is over: everything here, and every
// app command (requireCurrentAttempt), refuses to run in it.
import * as fs from 'fs'
import * as path from 'path'
import {slug as fullSlug} from '../../shared/step-name.ts'
import {createBinding, refusal, type Frame} from './attempt-binding-lib.ts'
import type {IosSurface} from './lists/surfaces.ts'
import type {TakeSteps} from '../../shared/cleanup.ts'

// shared/tests/results/ios-report whatever the cwd; KB_IOS_REPORT_DIR moves it (the unit tests do).
export const iosReportDir = () => process.env['KB_IOS_REPORT_DIR'] ?? path.resolve(__dirname, '../../../results/ios-report')
const attemptsDir = () => path.join(iosReportDir(), 'attempts')
const runErrorsDir = () => path.join(iosReportDir(), 'run-errors')

export type AttemptRecord = {
  file: string
  titlePath: Array<string>
  attempt: number
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  error?: string
  annotations: Array<{type: string; description: string}>
  attachments: Array<{name: string; contentType: string; path: string}>
}

export type CurrentAttempt = {
  addAttachment: (name: string, contentType: string, data: Buffer | string) => void
  annotate: (type: string, description: string) => void
  nextStepIndex: () => number
}

export type AttemptToken = {readonly id: string}

type Running = AttemptToken & {
  file: string
  titlePath: Array<string>
  attempt: number
  annotations: AttemptRecord['annotations']
  attachments: AttemptRecord['attachments']
  steps: number
  surfaces: Set<IosSurface>
  ended?: AttemptRecord
  // the withCleanups running in its body, outermost first
  cleanups: Array<TakeSteps>
  // set once the gate ended its body while it still ran: the cleanup steps it had left
  left?: Array<() => unknown>
}

type End = Pick<AttemptRecord, 'status' | 'durationMs' | 'error'>

// A body ended while it still ran hands over the steps its withCleanups had left, the innermost
// first, as each would have run them.
const binding = createBinding<Running>(r => {
  r.left = [...(r.left ?? []), ...r.cleanups.reverse().flatMap(take => take())]
  r.cleanups = []
})
let started = 0

const slug = (s: string) => fullSlug(s).slice(0, 80)

const EXTENSIONS: Record<string, string> = {'application/json': '.json', 'image/png': '.png', 'text/plain': '.txt'}

const recordOf = (r: Running, end: End): AttemptRecord => ({
  annotations: r.annotations,
  attachments: r.attachments,
  attempt: r.attempt,
  durationMs: end.durationMs,
  file: r.file,
  status: end.status,
  titlePath: r.titlePath,
  ...(end.error !== undefined ? {error: end.error} : {}),
})

const write = (r: Running, record: AttemptRecord) => {
  fs.mkdirSync(attemptsDir(), {recursive: true})
  fs.writeFileSync(path.join(attemptsDir(), `${r.id}.json`), JSON.stringify(record, null, 2))
}

// skill/running-e2e-release-gates/attempt-line.py matches this text to tell a running attempt from a failed one
export const NEVER_ENDED = 'the attempt never ended (the test worker stopped during it)'

// Writes a failed record at once, which ending the attempt replaces, so a worker that dies during a
// test still leaves its failure.
export const beginAttempt = (file: string, titlePath: Array<string>, attempt: number): AttemptToken => {
  started++
  const name = slug([file.replace(/^.*\//, '').replace(/\.test\.ts$/, ''), ...titlePath].join(' '))
  const r: Running = {
    annotations: [],
    attachments: [],
    attempt,
    cleanups: [],
    file,
    id: `${String(started).padStart(4, '0')}-${name}-r${attempt}`,
    steps: 0,
    surfaces: new Set(),
    titlePath,
  }
  write(r, recordOf(r, {durationMs: 0, error: NEVER_ENDED, status: 'failed'}))
  return r
}

// Runs a test body as the attempt: currentAttempt and endAttempt inside it reach that attempt only,
// until the body settles or mocha moves on from it.
export const runAttemptBody = async <T>(token: AttemptToken, title: string, body: () => Promise<T>): Promise<T> =>
  binding.runBody(token as Running, title, body)

// Runs a hook's work as the attempt (the root afterEach ending one), or as no attempt.
export const runAttempt = <T>(token: AttemptToken | undefined, fn: () => T): T => binding.run(token as Running | undefined, fn)

// For a hook beginning: every body still running is one mocha timed out, and is over from here.
export const endRunningBodies = () => binding.endRunningBodies()

// For the test's own function, as it settles (gate/hooks.ts wraps every flow test with it): wdio's
// afterTest runs after it inside the body's frame, and must hand over nothing from a body that ended
// on its own.
export const settleBody = () => binding.settleCurrentBody()

// For wdio's afterTest, which runs in the body's frame: wdio races the test function against its own
// timer, set just before mocha's, and runs afterTest once the function settles, or when the timer
// fires while it keeps going. The body is over from here (a function still running hands its cleanup
// over); the attempt's token is returned for the capture to run as a hook (runAttempt).
export const leaveBody = (): AttemptToken => {
  const token = attemptToken()
  binding.endCurrentBody()
  return token
}

// For withCleanup (setCleanupStepKeeper): keeps its steps with the running body, so the gate can take
// those left if it ends the body; nothing outside a running body (a hook's withCleanup runs to its end).
export const keepCleanupSteps = (take: TakeSteps) => {
  const f = binding.frame()
  const r = f?.body && !f.body.over ? f.value : undefined
  if (!r) return () => {}
  r.cleanups.push(take)
  return () => {
    r.cleanups = r.cleanups.filter(t => t !== take)
  }
}

// For the root afterEach: undefined when the attempt's body settled on its own; once the gate ended
// it while it still ran, the cleanup steps it left (maybe none), handed over once.
export const takeLeftCleanup = (token: AttemptToken): Array<() => unknown> | undefined => {
  const r = token as Running
  const left = r.left
  r.left = undefined
  return left
}

// For the root afterEach: runs the steps a body left as the attempt, each whether an earlier one
// threw, within `ms`. At the deadline the work is refused from then (its next app command throws
// attempt over, and no later step starts), so nothing it still runs drives the app into the next
// test. Returns each failure.
export const runLeftSteps = async (token: AttemptToken, steps: ReadonlyArray<() => unknown>, ms: number, what: string): Promise<Array<string>> => {
  const errors: Array<string> = []
  const {done, end} = binding.runGuarded(token as Running, what, async () => {
    for (const s of steps) {
      if (refusal(binding.frame())) return
      try {
        await s()
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  try {
    if ((await Promise.race([done, timedOut])) === 'timeout') {
      end()
      return [...errors, `${what}: not done in ${ms / 1000}s; stopped it`]
    }
  } finally {
    clearTimeout(timer)
  }
  return errors
}

// Throws `attempt over: <test title>` in a test body that is over; nothing in a hook or outside an
// attempt. Every command that reaches the app calls this first.
export const requireCurrentAttempt = () => binding.requireCurrent()

const openIn = (f: Frame<Running> | undefined): Running => {
  const why = refusal(f)
  if (why) throw new Error(why)
  return open(f?.value)
}

const open = (r: Running | undefined): Running => {
  if (!r) throw new Error('no test attempt is running')
  if (r.ended) throw new Error(`attempt ${r.id} has already ended`)
  return r
}

// The attempt of the running test body; throws outside one or once it has ended.
export const attemptToken = (): AttemptToken => openIn(binding.frame())

// The attempt the running work is bound to (a test body, or a root hook running as it), or undefined
// outside one or once it has ended. Unlike attemptToken it is returned in a body that is over.
export const openAttemptToken = (): AttemptToken | undefined => {
  const r = binding.frame()?.value
  return r && !r.ended ? r : undefined
}

// Credits the attempt with a native surface it drove and checked; the census counts it for the flow once the attempt passes.
export const creditSurface = (name: IosSurface) => {
  openIn(binding.frame()).surfaces.add(name)
}

// The surfaces credited so far, in the order first credited.
export const creditedSurfaces = (): Array<IosSurface> => [...openIn(binding.frame()).surfaces]

// The handle checks its binding on every call: one a timed-out body kept refuses once it is over.
export const currentAttempt = (): CurrentAttempt => {
  const f = binding.frame()
  const r = openIn(f)
  return {
    addAttachment: (name, contentType, data) => {
      openIn(f)
      const dir = path.join(attemptsDir(), r.id)
      fs.mkdirSync(dir, {recursive: true})
      const ext = EXTENSIONS[contentType] ?? ''
      const base = slug(ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name) || 'attachment'
      const taken = new Set(r.attachments.map(a => path.basename(a.path)))
      let fileName = `${base}${ext}`
      for (let n = 2; taken.has(fileName); n++) fileName = `${base}-${n}${ext}`
      const p = path.join(dir, fileName)
      fs.writeFileSync(p, data)
      r.attachments.push({contentType, name, path: p})
    },
    annotate: (type, description) => {
      openIn(f).annotations.push({description, type})
    },
    nextStepIndex: () => ++openIn(f).steps,
  }
}

// Ends an attempt and writes its record. An attempt is ended once; the record ending it is the truth
// that hooks.ts makes mocha agree with.
export const endAttemptOf = (token: AttemptToken, end: End): AttemptRecord => {
  requireCurrentAttempt()
  const r = open(token as Running)
  const record = recordOf(r, end)
  write(r, record)
  r.ended = record
  return record
}

// Fails an attempt that ended passed, for what failed after its body (its suite's afterEach hook).
export const failEndedAttempt = (token: AttemptToken, error: string): AttemptRecord => {
  const r = token as Running
  if (!r.ended) throw new Error(`attempt ${r.id} has not ended`)
  if (r.ended.status !== 'passed') return r.ended
  const record: AttemptRecord = {...r.ended, error, status: 'failed'}
  write(r, record)
  r.ended = record
  return record
}

// Fails an ended attempt for what went wrong after its body (the app crashed in a flow afterEach),
// adding `error` to a failure it already has.
export const addEndedAttemptError = (token: AttemptToken, error: string): AttemptRecord => {
  const r = token as Running
  if (!r.ended) throw new Error(`attempt ${r.id} has not ended`)
  const was = r.ended.status === 'failed' ? r.ended.error : undefined
  const record: AttemptRecord = {...r.ended, error: was ? `${was}; ${error}` : error, status: 'failed'}
  write(r, record)
  r.ended = record
  return record
}

// Ends the attempt of the running test body.
export const endAttempt = (end: End): AttemptRecord => endAttemptOf(attemptToken(), end)

export const endedRecord = (token: AttemptToken): AttemptRecord | undefined => (token as Running).ended

// A test mocha never ran because it is pending (it.skip, describe.skip, xit): one skipped attempt.
export const recordSkipped = (file: string, titlePath: Array<string>): AttemptRecord =>
  endAttemptOf(beginAttempt(file, titlePath, 0), {durationMs: 0, status: 'skipped'})

// Every attempt record of the run, in the order the attempts began.
export const readAttempts = (): Array<AttemptRecord> => {
  const dir = attemptsDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as AttemptRecord)
}

let runErrors = 0

// A failure of the run that belongs to no test (a suite's after hook, a test declared outside a
// describe); the report lists it.
export const recordRunError = (message: string) => {
  runErrors++
  fs.mkdirSync(runErrorsDir(), {recursive: true})
  fs.writeFileSync(path.join(runErrorsDir(), `${process.pid}-${String(runErrors).padStart(4, '0')}.txt`), message)
}

// Each once: wdio loads the spec files twice, so a refusal at load is recorded twice.
export const readRunErrors = (): Array<string> => {
  const dir = runErrorsDir()
  if (!fs.existsSync(dir)) return []
  const all = fs
    .readdirSync(dir)
    .sort()
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  return [...new Set(all)]
}
