// The test attempts of this worker: what the harness attaches to each and, once it ends, its record on
// disk. Attachments are written as they arrive, so a run never holds them in memory.
//
// An attempt is bound to the test body that runs it (runAttempt), not to whichever attempt began
// last: a body mocha timed out keeps running after its retry has begun, and must never touch the
// retry's attempt.
import {AsyncLocalStorage} from 'async_hooks'
import * as fs from 'fs'
import * as path from 'path'

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
  ended?: AttemptRecord
}

type End = Pick<AttemptRecord, 'status' | 'durationMs' | 'error'>

const bodies = new AsyncLocalStorage<Running>()
let started = 0

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

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
    file,
    id: `${String(started).padStart(4, '0')}-${name}-r${attempt}`,
    steps: 0,
    titlePath,
  }
  write(r, recordOf(r, {durationMs: 0, error: NEVER_ENDED, status: 'failed'}))
  return r
}

// Runs a test body as the attempt: currentAttempt and endAttempt inside it reach that attempt only.
export const runAttempt = <T>(token: AttemptToken, body: () => T): T => bodies.run(token as Running, body)

const open = (r: Running | undefined): Running => {
  if (!r) throw new Error('no test attempt is running')
  if (r.ended) throw new Error(`attempt ${r.id} has already ended`)
  return r
}

// The attempt of the running test body; throws outside one or once it has ended.
export const attemptToken = (): AttemptToken => open(bodies.getStore())

export const currentAttempt = (): CurrentAttempt => {
  const r = open(bodies.getStore())
  return {
    addAttachment: (name, contentType, data) => {
      open(r)
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
      open(r).annotations.push({description, type})
    },
    nextStepIndex: () => ++open(r).steps,
  }
}

// Ends an attempt and writes its record. An attempt is ended once; the record ending it is the truth
// that hooks.ts makes mocha agree with.
export const endAttemptOf = (token: AttemptToken, end: End): AttemptRecord => {
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
