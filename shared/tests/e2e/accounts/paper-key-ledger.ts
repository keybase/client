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

export const recordPaperKey = (entry: PaperKeyEntry, file = paperKeyLedgerPath()) => {
  const e = {deviceID: entry.deviceID, deviceName: entry.deviceName, runId: entry.runId}
  checkEntry(e)
  const entries = readPaperKeys(file)
  if (entries.some(x => x.deviceID === e.deviceID)) throw new Error(`paper key ledger: ${e.deviceID} is already recorded`)
  writePaperKeys([...entries, e], file)
}

export const forgetPaperKey = (deviceID: string, file = paperKeyLedgerPath()) => {
  const entries = readPaperKeys(file)
  const left = entries.filter(e => e.deviceID !== deviceID)
  if (left.length !== entries.length) writePaperKeys(left, file)
}
