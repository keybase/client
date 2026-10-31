// Scans a run's results for the env file's secrets (see secret-scan-lib.ts), deletes every file that
// holds one, and says which: a leak fails the run loudly instead of sitting in a report.
import * as fs from 'fs'
import * as path from 'path'
import {defaultEnvPath, e2eConfigDir, loadE2EEnv, readEnvFile} from '../../accounts/env.ts'
import {checkMode} from '../../accounts/paper-key-ledger.ts'
import {parseRunId} from '../../accounts/run-id.ts'
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

// `dir` may also name a single file
const filesUnder = (dir: string): Array<string> => {
  if (!fs.existsSync(dir)) return []
  if (fs.statSync(dir).isFile()) return [dir]
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(d => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return filesUnder(p)
    return d.isFile() ? [p] : []
  })
}

export type SecretScan = {hits: Array<string>; scanned: number; line: string}

// A flow run's scan result ({line, ok}), written beside the results it scanned: a report is built
// only from results with a clean scan.
export const SECRET_SCAN_FILE = 'secret-scan.json'

// Why the results in `dir` must not go into a report, or undefined: the run's scan must have passed,
// and come after the results were written.
export const unscannedProblem = (dir: string, results = 'results.json'): string | undefined => {
  const file = path.join(dir, SECRET_SCAN_FILE)
  let scan: {ok?: unknown; line?: unknown}
  try {
    scan = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof scan
  } catch {
    return `${file} is missing, so the flow run's artifacts were never scanned for secrets`
  }
  if (scan.ok !== true) return `the flow run's secret scan failed (${String(scan.line)})`
  const r = path.join(dir, results)
  if (fs.existsSync(r) && fs.statSync(r).mtimeMs > fs.statSync(file).mtimeMs) return `${r} was written after the flow run's secret scan`
  return undefined
}

export const scanAndPurge = (dirs: ReadonlyArray<string>, secrets: ReadonlyArray<string> = envSecrets()): SecretScan => {
  const files = dirs.flatMap(filesUnder)
  const hits = files.filter(f => holdsSecret(fs.readFileSync(f), secrets))
  for (const f of hits) fs.rmSync(f, {force: true})
  return {hits, line: secretScanLine(hits, files.length), scanned: files.length}
}

// -- invite links ----------------------------------------------------------------------------------
// A team invite link holds its invite's key, so no artifact may hold one. Within a run that scans for
// them (the iOS release sets SCAN_INVITE_LINKS_VAR for the processes it starts), each link a flow makes
// goes to the run's entry in ~/.config/keybase-e2e/invite-links.json (mode 600 in the mode 700 env
// dir), which that run's scan reads and then forgets; a run's entry outlives it by a week at most. Any
// other run writes nothing. The file is written whole and renamed into place, with no lock: the gate
// has one writer (the release lock serializes runs, and wdio runs one worker).

export const SCAN_INVITE_LINKS_VAR = 'KB_E2E_SCAN_INVITE_LINKS'
export const inviteLinksPath = () => path.join(e2eConfigDir(), 'invite-links.json')
const scansInviteLinks = () => process.env[SCAN_INVITE_LINKS_VAR] === '1'

type RunLinks = {runId: string; links: Array<string>}
const LINKS_KEPT_MS = 7 * 24 * 60 * 60_000

// What a scan looks for of one link: the link, as the app holds it once typed or pasted (its join
// field lowercases what it is given), and its key (the part after "#"), plain and as a URL encodes it.
export const inviteLinkSecrets = (link: string) => {
  const key = link.includes('#') ? link.slice(link.indexOf('#') + 1) : ''
  return [...new Set([link, link.toLowerCase(), key, encodeURIComponent(key)])].filter(s => s.length >= 8)
}

const recentLinks = (e: RunLinks, nowMs: number) => (parseRunId(e.runId, nowMs)?.startMs ?? 0) > nowMs - LINKS_KEPT_MS

// The entries of runs from the last week; older ones are left out on every read and write.
const readRunLinks = (file: string, nowMs: number): Array<RunLinks> => {
  if (!fs.existsSync(file)) return []
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${file} is not a list of invite link entries`)
  return parsed
    .map((raw: unknown) => {
      const r = (raw ?? {}) as Partial<RunLinks>
      return {links: Array.isArray(r.links) ? r.links.filter(l => typeof l === 'string') : [], runId: typeof r.runId === 'string' ? r.runId : ''}
    })
    .filter(e => recentLinks(e, nowMs))
}

const writeRunLinks = (entries: ReadonlyArray<RunLinks>, file: string, nowMs: number) => {
  const kept = entries.filter(e => recentLinks(e, nowMs))
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(kept, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

// Adds `link` to run `runId`'s entry, within a run that scans for invite links; nothing otherwise. A
// failure says what failed, never the link.
export const rememberInviteLink = (link: string, runId: string, file = inviteLinksPath(), record = scansInviteLinks(), nowMs = Date.now()) => {
  if (!record) return
  if (!parseRunId(runId, nowMs)) throw new Error("the invite link is not in the run's secret scan: no valid run id")
  try {
    const entries = readRunLinks(file, nowMs)
    const mine = entries.find(e => e.runId === runId)
    if (mine?.links.includes(link)) return
    const others = entries.filter(e => e.runId !== runId)
    writeRunLinks([...others, {links: [...(mine?.links ?? []), link], runId}], file, nowMs)
  } catch (e) {
    // no cause: a JSON parse error can quote the file, links and all
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`the invite link is not in the run's secret scan: ${e instanceof Error && e.message.startsWith(file) ? e.message : 'its record could not be written'}`)
  }
}

// What run `runId`'s secret scan looks for of the invite links it made.
export const runInviteLinkSecrets = (runId: string, file = inviteLinksPath(), nowMs = Date.now()) =>
  (readRunLinks(file, nowMs).find(e => e.runId === runId)?.links ?? []).flatMap(inviteLinkSecrets)

// Drops run `runId`'s links, and any older than a week, from the file.
export const forgetRunInviteLinks = (runId: string, file = inviteLinksPath(), nowMs = Date.now()) => {
  if (!fs.existsSync(file)) return
  writeRunLinks(
    readRunLinks(file, nowMs).filter(e => e.runId !== runId),
    file,
    nowMs
  )
}
