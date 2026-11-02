// A file of what one run handled that its final secret scan must look for and that only the run
// knows (the names of the paper keys it made, the team invite links it made): {runId, <key>: [...]}
// of one run, ~/.config/keybase-e2e/<name>, mode 600 in the mode 700 env dir. A write for another
// run replaces the file. The run's final scan reads it and then deletes it (forgetRun); a run that
// dies first leaves it to the next run, whose first write replaces it and whose sweep deletes it
// (forgetStale). The file is written whole and renamed into place, with no lock: the gate has one
// writer, as the release lock serializes runs and wdio runs one worker.
import * as fs from 'fs'
import * as path from 'path'
import {e2eConfigDir} from './env.ts'
import {parseRunId} from './run-id.ts'

export const checkMode = (p: string, want: number) => {
  const mode = fs.statSync(p).mode & 0o777
  if (mode !== want) throw new Error(`${p} is mode ${mode.toString(8)}, not ${want.toString(8)} (chmod ${want.toString(8)} ${p})`)
}

export const runRecord = (name: string, key: string) => {
  const defaultPath = () => path.join(e2eConfigDir(), name)

  const read = (file: string): {items: Array<string>; runId: string} | undefined => {
    if (!fs.existsSync(file)) return undefined
    checkMode(file, 0o600)
    const r = (JSON.parse(fs.readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>
    const items = r[key]
    if (typeof r['runId'] !== 'string' || !Array.isArray(items)) throw new Error(`${file} is not one run's record`)
    return {items: items.filter((i): i is string => typeof i === 'string'), runId: r['runId']}
  }

  // the run a file belongs to: undefined for one that cannot be read, which is no run's
  const runOf = (file: string) => {
    try {
      return read(file)?.runId
    } catch {
      return undefined
    }
  }

  // run `runId`'s items
  const items = (runId: string, file = defaultPath()) => {
    const r = read(file)
    return r?.runId === runId ? r.items : []
  }

  // adds `item` to run `runId`'s record, unless it is there already
  const add = (runId: string, item: string, file = defaultPath()) => {
    const mine = items(runId, file)
    if (mine.includes(item)) return
    const dir = path.dirname(file)
    fs.mkdirSync(dir, {mode: 0o700, recursive: true})
    checkMode(dir, 0o700)
    const tmp = `${file}.tmp-${process.pid}`
    fs.writeFileSync(tmp, `${JSON.stringify({[key]: [...mine, item], runId}, null, 2)}\n`, {mode: 0o600})
    fs.chmodSync(tmp, 0o600)
    fs.renameSync(tmp, file)
  }

  // deletes run `runId`'s file, for its final scan once it has read it; another run's is left, as
  // that run may still be going
  const forgetRun = (runId: string, file = defaultPath()) => {
    if (fs.existsSync(file) && runOf(file) === runId) fs.rmSync(file, {force: true})
  }

  // deletes a file a run that started a minute or more before `before` left (it died before its
  // scan), for the sweep, as the sweep's own rule for a run's objects is; the current run's is kept
  const forgetStale = (currentRunId: string, before: number, file = defaultPath()) => {
    if (!fs.existsSync(file)) return
    const runId = runOf(file)
    const startMs = runId === undefined ? undefined : parseRunId(runId, before)?.startMs
    if (runId === currentRunId || (startMs !== undefined && startMs + 60_000 > before)) return
    fs.rmSync(file, {force: true})
  }

  return {add, defaultPath, forgetRun, forgetStale, items}
}
