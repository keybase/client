// The paper keys e2e runs made, so the sweeper can revoke the ones an earlier run left behind:
// nothing about a paper key device shows which run made it. Each entry holds the run id, the
// device id and the device name the service gave it, never the key's words.
// ~/.config/keybase-e2e/paper-keys.json, mode 600 in the mode 700 env dir.
import * as fs from 'fs'
import * as path from 'path'
import {e2eConfigDir} from './env.ts'
import {parseRunId} from './run-id.ts'

export type PaperKeyEntry = {runId: string; deviceID: string; deviceName: string}

export const paperKeyLedgerPath = () => path.join(e2eConfigDir(), 'paper-keys.json')

const deviceIDRe = /^[0-9a-f]{32}$/
// the same shape redactSecrets hides: a run of ten or more lowercase words
const keyWordsRe = /[a-z]+(?: [a-z]+){9,}/

const checkEntry = (e: PaperKeyEntry) => {
  if (!parseRunId(e.runId)) throw new Error('paper key ledger: the entry has no valid run id')
  if (!deviceIDRe.test(e.deviceID)) throw new Error('paper key ledger: the entry has no valid device id')
  if (!e.deviceName || e.deviceName.length > 64) throw new Error('paper key ledger: the entry has no valid device name')
  if (keyWordsRe.test(e.deviceName)) throw new Error('paper key ledger: the device name holds what looks like a paper key')
}

const checkMode = (p: string, want: number) => {
  const mode = fs.statSync(p).mode & 0o777
  if (mode !== want) throw new Error(`${p} is mode ${mode.toString(8)}, not ${want.toString(8)} (chmod ${want.toString(8)} ${p})`)
}

export const readPaperKeys = (file = paperKeyLedgerPath()): Array<PaperKeyEntry> => {
  if (!fs.existsSync(file)) return []
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a list of paper key entries`)
  return parsed.map((raw: unknown) => {
    const r = (raw ?? {}) as Partial<Record<keyof PaperKeyEntry, unknown>>
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    const e = {deviceID: str(r.deviceID), deviceName: str(r.deviceName), runId: str(r.runId)}
    checkEntry(e)
    return e
  })
}

const writePaperKeys = (entries: ReadonlyArray<PaperKeyEntry>, file: string) => {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(entries, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

// Records a paper key the moment the service lists it: in the ledger, unless its device id is there
// already, and, within a run that scans for its paper key names (scansPaperKeyNames), its name in
// the run's names file, unless it is there already. So a caller that saw the key again (a names
// file write that failed the first time) just calls it again. The ledger is written first: a names
// file that cannot be written never keeps the key out of it.
// Both files are written whole and renamed into place, and nothing locks them: the gate has one
// writer, as the release lock (/tmp/kb-e2e-release.lock) serializes runs and wdio runs one worker.
// Writers running at once outside the gate are not supported.
export const recordPaperKey = (entry: PaperKeyEntry, file = paperKeyLedgerPath(), recordName = scansPaperKeyNames()) => {
  const e = {deviceID: entry.deviceID, deviceName: entry.deviceName, runId: entry.runId}
  checkEntry(e)
  const entries = readPaperKeys(file)
  if (!entries.some(x => x.deviceID === e.deviceID)) writePaperKeys([...entries, e], file)
  if (!recordName) return
  try {
    recordRunPaperKeyName(e.runId, e.deviceName, path.join(path.dirname(file), NAMES_FILE))
  } catch (err) {
    throw new Error(`the paper key is ledgered, but its name is not in the run's names file for the secret scan: ${err instanceof Error ? err.message : String(err)}`, {cause: err})
  }
}

// The names of the paper keys the current run made, for its secret scan: a paper key's device name
// is the first two words of its phrase. The ledger drops a key once it is revoked, but its name may
// still be in a screenshot or log of the run, so the names stay until the run's final scan has read
// them and deletes the file (forgetRunPaperKeyNames). A run that dies first leaves the file to the
// next run, whose first write replaces it and whose sweep deletes it (forgetStalePaperKeyNames).
// ~/.config/keybase-e2e/paper-key-names.json, mode 600: {runId, names} of one run.
const NAMES_FILE = 'paper-key-names.json'

// Set for a run whose secret scan reads the names: by the iOS release for the processes it starts,
// and by a direct iOS flow run for its own.
export const SCAN_PAPER_KEY_NAMES_VAR = 'KB_E2E_SCAN_PAPER_KEY_NAMES'
const scansPaperKeyNames = () => process.env[SCAN_PAPER_KEY_NAMES_VAR] === '1'
export const paperKeyNamesPath = () => path.join(e2eConfigDir(), NAMES_FILE)

type RunNames = {runId: string; names: Array<string>}

// The words of a paper key's device name, as deviceList ("Paper Key (two words...)") or
// deviceHistoryList ("two words") gives it.
export const paperKeyWords = (deviceName: string) => /^Paper Key \((.+?)(?:\.\.\.)?\)$/.exec(deviceName)?.[1] ?? deviceName

// The device names of the paper keys among `secrets` (the env file's): each key's first two words,
// which is what Keybase names its device.
export const paperKeyNamesIn = (secrets: ReadonlyArray<string>) =>
  secrets.flatMap(v => {
    const words = v.trim().split(/\s+/)
    return keyWordsRe.test(v) && words.length >= 10 ? [words.slice(0, 2).join(' ')] : []
  })

const readRunNames = (file: string): RunNames | undefined => {
  if (!fs.existsSync(file)) return undefined
  checkMode(file, 0o600)
  const r = (JSON.parse(fs.readFileSync(file, 'utf8')) ?? {}) as Partial<RunNames>
  if (typeof r.runId !== 'string' || !Array.isArray(r.names)) throw new Error(`${file} is not a run's paper key names`)
  return {names: r.names.filter(n => typeof n === 'string'), runId: r.runId}
}

const recordRunPaperKeyName = (runId: string, deviceName: string, file: string) => {
  const words = paperKeyWords(deviceName)
  const mine = readRunNames(file)
  const names = mine?.runId === runId ? mine.names : []
  if (names.includes(words)) return
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify({names: [...names, words], runId}, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

// The names of the paper keys run `runId` made: what its secret scan looks for besides the env file's.
export const runPaperKeyNames = (runId: string, file = paperKeyNamesPath()) => {
  const r = readRunNames(file)
  return r?.runId === runId ? r.names : []
}

// What a run's secret scan looks for: `secrets` (the env file's), the device names of the env file's
// paper keys and of the paper keys run `runId` made.
export const withPaperKeyNames = (secrets: ReadonlyArray<string>, runId: string, file = paperKeyNamesPath()) => [
  ...secrets,
  ...paperKeyNamesIn(secrets),
  ...runPaperKeyNames(runId, file),
]

// The run a names file belongs to: undefined for one that cannot be read, which is no run's.
const namesRunOf = (file: string) => {
  try {
    return readRunNames(file)?.runId
  } catch {
    return undefined
  }
}

// Deletes run `runId`'s names file, for its final scan once it has read them. A file of another run
// is left: that run may still be going.
export const forgetRunPaperKeyNames = (runId: string, file = paperKeyNamesPath()) => {
  if (fs.existsSync(file) && namesRunOf(file) === runId) fs.rmSync(file, {force: true})
}

// Deletes a names file a run that started a minute or more before `before` left (it died before its
// scan), for the sweep, as the sweep's own rule for a run's objects is; the current run's is kept.
export const forgetStalePaperKeyNames = (currentRunId: string, before: number, file = paperKeyNamesPath()) => {
  if (!fs.existsSync(file)) return
  const runId = namesRunOf(file)
  const startMs = runId === undefined ? undefined : parseRunId(runId, before)?.startMs
  if (runId === currentRunId || (startMs !== undefined && startMs + 60_000 > before)) return
  fs.rmSync(file, {force: true})
}

export const forgetPaperKey = (deviceID: string, file = paperKeyLedgerPath()) => {
  const entries = readPaperKeys(file)
  const left = entries.filter(e => e.deviceID !== deviceID)
  if (left.length !== entries.length) writePaperKeys(left, file)
}
