// The test attempt running in this worker: what the harness attaches to it and, once it ends, its
// record on disk. Attachments are written as they arrive, so a run never holds them in memory.
import * as fs from 'fs'
import * as path from 'path'

// Relative to shared/, the yarn cwd.
export const IOS_REPORT_DIR = 'tests/results/ios-report'
const ATTEMPTS_DIR = path.join(IOS_REPORT_DIR, 'attempts')

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

type Running = {
  id: string
  file: string
  titlePath: Array<string>
  attempt: number
  annotations: AttemptRecord['annotations']
  attachments: AttemptRecord['attachments']
  steps: number
  ended?: AttemptRecord
}

let running: Running | undefined
let started = 0

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

const EXTENSIONS: Record<string, string> = {'application/json': '.json', 'image/png': '.png', 'text/plain': '.txt'}

export const beginAttempt = (file: string, titlePath: Array<string>, attempt: number) => {
  started++
  const name = slug([file.replace(/^.*\//, '').replace(/\.test\.ts$/, ''), ...titlePath].join(' '))
  running = {
    annotations: [],
    attachments: [],
    attempt,
    file,
    id: `${String(started).padStart(4, '0')}-${name}-r${attempt}`,
    steps: 0,
    titlePath,
  }
}

const runningAttempt = (): Running => {
  if (!running) throw new Error('no test attempt is running')
  return running
}

export const currentAttempt = (): CurrentAttempt => {
  const r = runningAttempt()
  return {
    addAttachment: (name, contentType, data) => {
      const dir = path.resolve(ATTEMPTS_DIR, r.id)
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
      r.annotations.push({description, type})
    },
    nextStepIndex: () => ++r.steps,
  }
}

// Ends the running attempt and writes its record. An attempt is ended once; the record ending it is
// the truth that hooks.ts makes mocha agree with.
export const endAttempt = (end: Pick<AttemptRecord, 'status' | 'durationMs' | 'error'>): AttemptRecord => {
  const r = runningAttempt()
  if (r.ended) throw new Error(`attempt ${r.id} has already ended`)
  const record: AttemptRecord = {
    annotations: r.annotations,
    attachments: r.attachments,
    attempt: r.attempt,
    durationMs: end.durationMs,
    file: r.file,
    status: end.status,
    titlePath: r.titlePath,
    ...(end.error !== undefined ? {error: end.error} : {}),
  }
  fs.mkdirSync(ATTEMPTS_DIR, {recursive: true})
  fs.writeFileSync(path.join(ATTEMPTS_DIR, `${r.id}.json`), JSON.stringify(record, null, 2))
  r.ended = record
  return record
}

export const endedAttempt = (): AttemptRecord | undefined => running?.ended

// Every attempt record of the run, in the order the attempts began.
export const readAttempts = (): Array<AttemptRecord> => {
  if (!fs.existsSync(ATTEMPTS_DIR)) return []
  return fs
    .readdirSync(ATTEMPTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(ATTEMPTS_DIR, f), 'utf8')) as AttemptRecord)
}
