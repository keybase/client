// Scans a run's results for the env file's secrets (see secret-scan-lib.ts), deletes every file that
// holds one, and says which: a leak fails the run loudly instead of sitting in a report.
import * as fs from 'fs'
import * as path from 'path'
import {defaultEnvPath, loadE2EEnv, readEnvFile} from '../../accounts/env.ts'
import {runRecord} from '../../accounts/run-record.ts'
import {parseRunId} from '../../accounts/run-id.ts'
import {holdsSecretOrArmor, secretLedger, secretScanLine} from './secret-scan-lib.ts'

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

// What the desktop flows write under `resultsRoot` (tests/results), gate and targeted runs both:
// Playwright's test-results and report (electron/playwright.config.ts, under `targeted` for a run
// outside the gate) and the screenshot report built from them. The desktop's own scan covers them. A
// failed desktop crypto flow can leave its own test ciphertext in them, which is no secret: the iOS
// gate, which treats saltpack armor as one in its own artifacts, leaves armor here alone.
export const desktopFlowOutputs = (resultsRoot: string) => [
  ...['test-results', 'report', 'targeted'].map(d => path.join(resultsRoot, d)),
  ...['electron-report.html', 'electron-report.cards.json'].map(f => path.join(resultsRoot, f)),
]

// With `armor` (true, or true for the file), a file that holds a saltpack message's armor is a hit too.
export const scanAndPurge = (
  dirs: ReadonlyArray<string>,
  secrets: ReadonlyArray<string> = envSecrets(),
  opts: {armor?: boolean | ((file: string) => boolean)} = {}
): SecretScan => {
  const {armor = false} = opts
  const files = dirs.flatMap(filesUnder)
  const hits = files.filter(f => holdsSecretOrArmor(fs.readFileSync(f), secrets, typeof armor === 'function' ? armor(f) : armor))
  for (const f of hits) fs.rmSync(f, {force: true})
  return {hits, line: secretScanLine(hits, files.length), scanned: files.length}
}

// -- invite links ---------------------------------------------------------------------------------
// A team invite link holds its invite's key, so no artifact may hold one. Within a run that scans for
// them (SCAN_INVITE_LINKS_VAR: the iOS release sets it for the processes it starts, a direct iOS flow
// run for its own), each link a flow makes goes to the run's record (accounts/run-record.ts), which
// the run's final scan reads and then deletes. Any other run writes nothing.

export const SCAN_INVITE_LINKS_VAR = 'KB_E2E_SCAN_INVITE_LINKS'
const scansInviteLinks = () => process.env[SCAN_INVITE_LINKS_VAR] === '1'
const links = runRecord('invite-links.json', 'links')
const inviteLinksPath = links.defaultPath

// What a scan looks for of one link: the link, as the app holds it once typed or pasted (its join
// field lowercases what it is given), and its key (the part after "#"), plain and as a URL encodes it.
export const inviteLinkSecrets = (link: string) => {
  const key = link.includes('#') ? link.slice(link.indexOf('#') + 1) : ''
  return [...new Set([link, link.toLowerCase(), key, encodeURIComponent(key)])].filter(s => s.length >= 8)
}

// Adds `link` to run `runId`'s record, within a run that scans for invite links; nothing otherwise. A
// failure says what failed, never the link.
export const rememberInviteLink = (link: string, runId: string, file = inviteLinksPath(), record = scansInviteLinks()) => {
  if (!record) return
  if (!parseRunId(runId)) throw new Error("the invite link is not in the run's secret scan: no valid run id")
  try {
    links.add(runId, link, file)
  } catch (e) {
    // no cause: a JSON parse error can quote the file, links and all
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`the invite link is not in the run's secret scan: ${e instanceof Error && e.message.startsWith(file) ? e.message : 'its record could not be written'}`)
  }
}

// What run `runId`'s secret scan looks for of the invite links it made.
export const runInviteLinkSecrets = (runId: string, file = inviteLinksPath()) => links.items(runId, file).flatMap(inviteLinkSecrets)

export const forgetRunInviteLinks = links.forgetRun
export const forgetStaleInviteLinks = links.forgetStale
