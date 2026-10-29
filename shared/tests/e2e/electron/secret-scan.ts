// Scans a run's results for the env file's secrets (see secret-scan-lib.ts), deletes every file that
// holds one, and says which: a leak fails the run loudly instead of sitting in a report.
import * as fs from 'fs'
import * as path from 'path'
import {defaultEnvPath, loadE2EEnv, readEnvFile} from '../accounts/env.ts'
import {holdsSecret, secretLedger, secretScanLine} from './secret-scan-lib.ts'

const passwordVars = ['KB_SECOND_PASSWORD', 'KB_SECOND_PASSWORD_NEXT']

// What no artifact may hold, as the env file (and the environment) say now: the second account's
// password, a pending KB_SECOND_PASSWORD_NEXT, and the paper keys.
export const envSecrets = (file = defaultEnvPath(), environ: NodeJS.ProcessEnv = process.env) => {
  const env = loadE2EEnv(file, environ)
  const fromFile = readEnvFile(file)
  const passwords = passwordVars.flatMap(n => [fromFile[n] ?? '', environ[n] ?? ''])
  return [...passwords, env.peers.second.paperKey, env.peers.owner.paperKey].filter(Boolean)
}

export type SecretWatch = {sample: () => void; secrets: () => Array<string>; stop: () => void}

// Every value envSecrets returns from now until `secrets()`, read again every `intervalMs` and on
// each `sample()`: a rotation writes the new password as KB_SECOND_PASSWORD_NEXT for the whole
// change and check before promoting it, so the old, the pending and the new value are all caught.
// In memory only. The first read throws like envSecrets; a later one that fails (the file mid
// rewrite) is left for the next.
export const watchEnvSecrets = (read: () => ReadonlyArray<string> = envSecrets, intervalMs = 250): SecretWatch => {
  const ledger = secretLedger(read)
  ledger.sample()
  const quiet = () => {
    try {
      ledger.sample()
    } catch {
      // the next sample reads it
    }
  }
  const timer = setInterval(quiet, intervalMs)
  // the watch never keeps the process alive (the desktop tsconfig types timers as the DOM's numbers)
  ;(timer as unknown as {unref?: () => void}).unref?.()
  return {
    sample: quiet,
    secrets: () => {
      ledger.sample()
      return ledger.all()
    },
    stop: () => clearInterval(timer),
  }
}

const filesUnder = (dir: string): Array<string> => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return filesUnder(p)
    return d.isFile() ? [p] : []
  })
}

export type SecretScan = {hits: Array<string>; scanned: number; line: string}

export const scanAndPurge = (dirs: ReadonlyArray<string>, secrets: ReadonlyArray<string> = envSecrets()): SecretScan => {
  const files = dirs.flatMap(filesUnder)
  const hits = files.filter(f => holdsSecret(fs.readFileSync(f), secrets))
  for (const f of hits) fs.rmSync(f, {force: true})
  return {hits, line: secretScanLine(hits, files.length), scanned: files.length}
}
