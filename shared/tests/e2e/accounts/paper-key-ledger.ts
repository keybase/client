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

// Within a run that scans for its paper key names (scansPaperKeyNames), the key's name goes to the
// run's names file next to the ledger too; any other run writes no name.
// The ledger is written first: a names file that cannot be written never keeps the key out of it.
// Both files are written whole and renamed into place, and nothing locks them: the gate has one
// writer, as the release lock (/tmp/kb-e2e-release.lock) serializes runs and wdio runs one worker.
// Writers running at once outside the gate are not supported.
export const recordPaperKey = (entry: PaperKeyEntry, file = paperKeyLedgerPath(), recordName = scansPaperKeyNames()) => {
  const e = {deviceID: entry.deviceID, deviceName: entry.deviceName, runId: entry.runId}
  checkEntry(e)
  const entries = readPaperKeys(file)
  if (entries.some(x => x.deviceID === e.deviceID)) throw new Error(`paper key ledger: ${e.deviceID} is already recorded`)
  writePaperKeys([...entries, e], file)
  rememberRunPaperKeyName(e, file, recordName)
}

// Puts a ledgered key's name in its run's names file, within a run that scans for them; it does
// nothing when the name is there already, so a caller that saw the key again can try once more.
export const rememberRunPaperKeyName = (entry: PaperKeyEntry, file = paperKeyLedgerPath(), recordName = scansPaperKeyNames()) => {
  if (!recordName) return
  try {
    recordRunPaperKeyName(entry.runId, entry.deviceName, path.join(path.dirname(file), NAMES_FILE))
  } catch (e) {
    throw new Error(`the paper key is ledgered, but its name is not in the run's names file for the secret scan: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
}

// The names of the paper keys each run made, for that run's secret scan: a paper key's device name is
// the first two words of its phrase, and the ledger drops a key once it is revoked.
// ~/.config/keybase-e2e/paper-key-names.json, mode 600; a run's entry outlives it by a week at most.
const NAMES_FILE = 'paper-key-names.json'

// Set by the iOS release for the processes it starts: its secret scan reads the names and forgets them.
export const SCAN_PAPER_KEY_NAMES_VAR = 'KB_E2E_SCAN_PAPER_KEY_NAMES'
const scansPaperKeyNames = () => process.env[SCAN_PAPER_KEY_NAMES_VAR] === '1'
export const paperKeyNamesPath = () => path.join(e2eConfigDir(), NAMES_FILE)

type RunNames = {runId: string; names: Array<string>}
const NAMES_KEPT_MS = 7 * 24 * 60 * 60_000

// The words of a paper key's device name, as deviceList ("Paper Key (two words...)") or
// deviceHistoryList ("two words") gives it.
export const paperKeyWords = (deviceName: string) => /^Paper Key \((.+?)(?:\.\.\.)?\)$/.exec(deviceName)?.[1] ?? deviceName

const recent = (e: RunNames, nowMs: number) => (parseRunId(e.runId, nowMs)?.startMs ?? 0) > nowMs - NAMES_KEPT_MS

// The device names of the paper keys among `secrets` (the env file's): each key's first two words,
// which is what Keybase names its device.
export const paperKeyNamesIn = (secrets: ReadonlyArray<string>) =>
  secrets.flatMap(v => {
    const words = v.trim().split(/\s+/)
    return keyWordsRe.test(v) && words.length >= 10 ? [words.slice(0, 2).join(' ')] : []
  })

// The entries of runs from the last week; older ones are left out on every read and write.
const readRunNames = (file: string, nowMs: number): Array<RunNames> => {
  if (!fs.existsSync(file)) return []
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a list of paper key names`)
  return parsed
    .map((raw: unknown) => {
      const r = (raw ?? {}) as Partial<RunNames>
      return {names: Array.isArray(r.names) ? r.names.filter(n => typeof n === 'string') : [], runId: typeof r.runId === 'string' ? r.runId : ''}
    })
    .filter(e => recent(e, nowMs))
}

const writeRunNames = (entries: ReadonlyArray<RunNames>, file: string, nowMs: number) => {
  const kept = entries.filter(e => recent(e, nowMs))
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(kept, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

export const recordRunPaperKeyName = (runId: string, deviceName: string, file = paperKeyNamesPath(), nowMs = Date.now()) => {
  const words = paperKeyWords(deviceName)
  const entries = readRunNames(file, nowMs)
  const mine = entries.find(e => e.runId === runId)
  if (mine?.names.includes(words)) return
  const others = entries.filter(e => e.runId !== runId)
  writeRunNames([...others, {names: [...(mine?.names ?? []), words], runId}], file, nowMs)
}

// The names of the paper keys run `runId` made: what its secret scan looks for besides the env file's.
export const runPaperKeyNames = (runId: string, file = paperKeyNamesPath(), nowMs = Date.now()) =>
  readRunNames(file, nowMs).find(e => e.runId === runId)?.names ?? []

// Drops run `runId`'s names, and any older than a week, from the file.
export const forgetRunPaperKeyNames = (runId: string, file = paperKeyNamesPath(), nowMs = Date.now()) => {
  if (!fs.existsSync(file)) return
  writeRunNames(
    readRunNames(file, nowMs).filter(e => e.runId !== runId),
    file,
    nowMs
  )
}

export const forgetPaperKey = (deviceID: string, file = paperKeyLedgerPath()) => {
  const entries = readPaperKeys(file)
  const left = entries.filter(e => e.deviceID !== deviceID)
  if (left.length !== entries.length) writePaperKeys(left, file)
}
