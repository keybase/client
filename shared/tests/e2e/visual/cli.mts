// The visual gate's commands (yarn visual:<cmd>):
//   base [ids…] [--ios] [--themes light,dark] [--base <ref>] [--coverage]
//        captures the base: the app served from a pinned checkout of the base commit
//   check <id|glob>… [--ios] [--theme t]   captures the current tree and compares with the base
//   gate [--ios]                           check over every entry, bracketed by a full seal
//   aa [--ios]                             captures every entry twice from the current tree, twice
//   coverage <ref|range> [--base <ref>]    changed Box2/ClickableBox call sites no base run mounted
// `base` captures `git merge-base HEAD origin/master` unless --base names a commit; check, gate and
// coverage use the commit the last `base` for the platform captured, or --base. Every command
// that drives the app takes the gate lock, sets KB_VISUAL_RUN=1 for what it spawns, and exits its
// process under a hard deadline (the drivers' Playwright connection would otherwise keep it alive).
import {execFile, execFileSync, spawn, spawnSync} from 'child_process'
import {createHash} from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
import {parseArgs, promisify} from 'util'
import {udidForName} from '../ios-appium/helpers/app.ts'
import {e2eAccounts} from '../shared/chat-data.ts'
import {evalInPage, inspectorPageFor} from '../shared/metro-eval.ts'
import {comparePng, type Rect} from './compare.mts'
import {
  changedRanges,
  callSiteRanges,
  outOfScopeFile,
  parseDiffHunks,
  unmarkedFile,
  unmountedChanged,
  type Hunk,
  type Range,
} from './coverage/changed-sites.mts'
import {openDesktop, sleep, waitFor, withDeadline, type Capture, type DesktopSession} from './driver-desktop.mts'
import {openIos, type IosSession} from './driver-ios.mts'
import {acquireLock} from './lock.mts'
import {isRef} from './resolve.mts'
import {writeReport, verdict, type ReportRow, type RowStatus} from './report.mts'
import {diffSeals, readSeal, type Seal, type SealField} from './seal.mts'
import {assertServedFrom, listenerCwd} from './served-tree.mts'
import * as Store from './store.mts'
import {tour} from './tour.ts'
import {matchEntries, nextDesktopEntry, type ParamRef, type ParamValue, type Platform, type Theme, type TourEntry} from './tour-types.ts'

type RunPlatform = Store.RunPlatform

const SHARED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const REPO_DIR = path.dirname(SHARED_DIR)
const DESKTOP_PORT = 4000
const METRO_PORT = 8081
const IOS_BUNDLE_ID = 'keybase.ios'
const FROZEN_AFTER_NEWEST_MS = 60_000
const GIT_MS = 60_000
const INSTALL_MS = 20 * 60_000
const LAUNCH_MS = 5 * 60_000
const RESTORE_MS = 10 * 60_000
const METRO_STOP_MS = 15_000
const METRO_START_MS = 3 * 60_000
const IOS_BOOT_MS = 5 * 60_000
const MIN = 60_000
const DEADLINES: Record<string, number> = {aa: 90 * MIN, base: 90 * MIN, check: 45 * MIN, coverage: 5 * MIN, gate: 90 * MIN}
const THEMES: ReadonlyArray<Theme> = ['light', 'dark']
const METRO_LOG = '/tmp/kb-visual-metro.log'

const iosDevice = () => process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'

// ---------------------------------------------------------------- arguments and selection

export type Command = {base: string | undefined; coverage: boolean; ios: boolean; patterns: Array<string>; themes: Array<Theme>}

export const parseCommand = (argv: ReadonlyArray<string>): Command => {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    args: [...argv],
    options: {
      base: {type: 'string'},
      coverage: {type: 'boolean'},
      ios: {type: 'boolean'},
      theme: {type: 'string'},
      themes: {type: 'string'},
    },
    strict: true,
  })
  const ios = !!values.ios
  const asked = (values.themes ?? values.theme)?.split(',').map(s => s.trim()).filter(Boolean)
  for (const t of asked ?? []) {
    if (!THEMES.includes(t as Theme)) throw new Error(`unknown theme ${t} (light or dark)`)
  }
  const themes = (asked as Array<Theme> | undefined) ?? ['light']
  if (ios && themes.some(t => t !== 'light')) throw new Error('iOS captures are light only')
  return {base: values.base, coverage: !!values.coverage, ios, patterns: positionals, themes}
}

const tourPlatform = (p: RunPlatform): Platform => (p === 'ios' ? 'phone' : 'desktop')

// The entries the patterns name on the platform, in tour order. A pattern naming nothing refuses.
export const selectEntries = (entries: ReadonlyArray<TourEntry>, patterns: ReadonlyArray<string>, platform: RunPlatform) => {
  const on = entries.filter(e => e.platforms.includes(tourPlatform(platform)))
  const hit = new Set<TourEntry>()
  for (const p of patterns.length ? patterns : ['*']) {
    const m = matchEntries(on, p)
    if (!m.length) throw new Error(`no tour entry matches ${p} on ${platform}`)
    for (const e of m) hit.add(e)
  }
  // a desktop entry that leaves a popup open brings the entry that closes it
  if (platform === 'desktop') {
    for (const e of [...hit]) {
      const next = e.leavesPopup ? nextDesktopEntry(entries, e) : undefined
      if (next) hit.add(next)
    }
  }
  return on.filter(e => hit.has(e))
}

const sealFieldsOf = (entries: ReadonlyArray<TourEntry>): Array<SealField> => [...new Set(entries.flatMap(e => e.seal))].sort()

const pickSeal = (s: Seal, fields: ReadonlyArray<SealField>): Seal => ({
  ...s,
  fields: Object.fromEntries(fields.map(f => [f, s.fields[f]])),
})

const refsIn = (v: ParamValue | undefined): Array<ParamRef> =>
  isRef(v)
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(x => refsIn(x as ParamValue))
      : v && typeof v === 'object'
        ? Object.values(v as {[k: string]: ParamValue}).flatMap(refsIn)
        : []

const conversationChannels = (e: TourEntry): Array<string> =>
  [e.nav.thread, ...Object.values(e.nav.append?.params ?? {})]
    .flatMap(refsIn)
    .flatMap(r => (r.ref === 'conversationIDKey' ? [r.channel ?? 'general'] : []))

// Opening an unread conversation marks it read, which is a write to the account and changes the
// inbox seal mid-run. Refuses before any capture; a person reads it by hand first.
export const assertTouredConversationsRead = (entries: ReadonlyArray<TourEntry>, seal: Seal, team: string) => {
  const names = new Set(entries.flatMap(conversationChannels).map(c => `${team}#${c}`))
  if (!names.size) return
  const inbox = seal.fields.inbox as Array<{id: string; name: string; unread: boolean}> | undefined
  if (!inbox) throw new Error(`the seal has no inbox, so it cannot show whether ${[...names].join(', ')} are read`)
  const unread = inbox.filter(r => r.unread && names.has(r.name))
  if (unread.length) {
    throw new Error(
      `unread: ${unread.map(r => `${r.name} (conversation ${r.id})`).join(', ')}. The tour opens it, which marks it read ` +
        '(a write to the account). Read it by hand first, then rerun'
    )
  }
}

const isUnder = (p: string, dir: string) => p === dir || p.startsWith(dir + path.sep)

const portOf = (p: RunPlatform) => (p === 'ios' ? METRO_PORT : DESKTOP_PORT)

// ---------------------------------------------------------------- check / gate / aa

export type CaptureOpts = {platform: RunPlatform; theme: Theme; frozenAt: number}
export type CheckDeps = {
  baseSha: () => Promise<string>
  readBaseMeta: (sha: string, platform: RunPlatform) => Store.BaseMeta | undefined
  readSeal: (fields?: ReadonlyArray<SealField>) => Promise<Seal>
  // the realpath'd cwd of whatever listens on the port
  servedFrom: (port: number) => string | undefined
  // the e2e team, whose channels the tour opens
  team: () => string
  currentShared: string
  hasBasePng: (sha: string, platform: RunPlatform, theme: Theme, id: string) => boolean
  // prepares (with a reload) whenever the theme or frozen instant changes, then captures
  capture: (entry: TourEntry, opts: CaptureOpts) => Promise<Capture>
  closeCapture: () => Promise<void>
  entries: ReadonlyArray<TourEntry>
  openReport: (reportPath: string) => void
  log: (line: string) => void
}

const assertServed = (deps: Pick<CheckDeps, 'servedFrom' | 'currentShared'>, platform: RunPlatform) => {
  const port = portOf(platform)
  const served = deps.servedFrom(port)
  if (!served) throw new Error(`nothing is listening on port ${port}; start the ${platform === 'ios' ? 'Metro server' : 'app'} from ${deps.currentShared}`)
  if (!isUnder(served, deps.currentShared)) {
    throw new Error(`port ${port} is served from ${served}, expected ${deps.currentShared}; restart it from this tree`)
  }
}

const line = (ok: boolean, r: Pick<ReportRow, 'id' | 'platform' | 'theme' | 'status' | 'result' | 'error' | 'diffPng'>, extra = '') =>
  `${ok ? '✓' : '✗'} ${r.id} ${r.platform} ${r.theme}${extra} ${verdict(r)}${!ok && r.diffPng ? ` → ${r.diffPng}` : ''}`

const unionMasks = (a: ReadonlyArray<Rect>, b: ReadonlyArray<Rect>) => {
  const seen = new Set<string>()
  return [...a, ...b].filter(r => {
    const k = `${r.x},${r.y},${r.width},${r.height}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Compares a capture against a reference PNG and writes the change and diff PNGs under `dir`.
const compareCapture = (opts: {
  cap: Capture
  refPng: string
  refMasks: ReadonlyArray<Rect>
  dir: string
  name: string
}): Pick<ReportRow, 'changePng' | 'diffPng' | 'result' | 'status' | 'masks' | 'error'> => {
  const {cap, dir, name} = opts
  fs.mkdirSync(dir, {recursive: true})
  const changePng = cap.png.length ? path.join(dir, `${name}.png`) : null
  if (changePng) fs.writeFileSync(changePng, cap.png)
  if (cap.status === 'failed' || !changePng) {
    return {changePng, diffPng: null, error: cap.error, masks: cap.masks, result: null, status: 'failed'}
  }
  const masks = unionMasks(opts.refMasks, cap.masks)
  const diffPng = path.join(dir, `${name}.diff.png`)
  const result = comparePng(opts.refPng, changePng, {diffOut: diffPng, masks})
  const kept = fs.existsSync(diffPng) && !result.equal ? diffPng : null
  if (!kept) fs.rmSync(diffPng, {force: true})
  const status: RowStatus = cap.status === 'unstable' ? 'unstable' : result.equal ? 'same' : 'differs'
  return {changePng, diffPng: kept, masks, result, status}
}

type CheckRun = {rows: Array<ReportRow>; reportPath: string; ok: boolean; sha: string}

// Shared by check and gate. `sealNow` is a seal the caller already read (gate reads a full one).
const checkEntries = async (
  deps: CheckDeps,
  cmd: Command,
  opts: {title: string; sealNow?: Seal}
): Promise<CheckRun> => {
  const platform: RunPlatform = cmd.ios ? 'ios' : 'desktop'
  const entries = selectEntries(deps.entries, cmd.patterns, platform)
  const sha = await deps.baseSha()
  const meta = deps.readBaseMeta(sha, platform)
  const named = cmd.patterns.join(' ') || '*'
  const iosFlag = cmd.ios ? ' --ios' : ''
  if (!meta) throw new Error(`no base for ${named} at ${sha}; run yarn visual:base ${named}${iosFlag}`)
  for (const e of entries) {
    for (const theme of cmd.themes) {
      if (!deps.hasBasePng(sha, platform, theme, e.id)) {
        throw new Error(`no base for ${e.id} at ${sha}; run yarn visual:base ${e.id}${iosFlag} (no ${platform} ${theme} capture)`)
      }
    }
  }
  const fields = sealFieldsOf(entries)
  if (fields.length) {
    const now = opts.sealNow ?? (await deps.readSeal(fields))
    const diffs = diffSeals(pickSeal(meta.seal, fields), pickSeal(now, fields))
    if (diffs.length) throw new Error(`seal changed: ${diffs.join('; ')}`)
    assertTouredConversationsRead(entries, now, deps.team())
  }
  assertServed(deps, platform)

  const dir = Store.runDir(Store.runStamp())
  const rows: Array<ReportRow> = []
  try {
    for (const theme of cmd.themes) {
      for (const e of entries) {
        const cap = await deps.capture(e, {frozenAt: meta.frozenAt, platform, theme})
        const refPng = Store.basePng(sha, platform, theme, e.id)
        const row: ReportRow = {
          basePng: refPng,
          id: e.id,
          platform,
          theme,
          ...compareCapture({
            cap,
            dir: path.join(dir, platform, theme),
            name: Store.idFile(e.id),
            refMasks: Store.readBaseMasks(sha, platform, theme, e.id),
            refPng,
          }),
        }
        rows.push(row)
        deps.log(line(row.status === 'same', row))
      }
    }
  } finally {
    await deps.closeCapture()
  }
  const reportPath = writeReport(dir, rows, `${opts.title} (${platform}, base ${sha.slice(0, 10)})`)
  const ok = rows.every(r => r.status === 'same')
  return {ok, reportPath, rows, sha}
}

export async function runCheck(deps: CheckDeps, argv: ReadonlyArray<string>): Promise<number> {
  const cmd = parseCommand(argv)
  if (!cmd.patterns.length) throw new Error('check needs an id or glob, e.g. yarn visual:check "tab/*"')
  const run = await checkEntries(deps, cmd, {title: 'Visual check'})
  deps.log(`report (base ${run.sha.slice(0, 10)}): ${run.reportPath}`)
  if (!run.ok) deps.openReport(run.reportPath)
  return run.ok ? 0 : 1
}

export async function runGate(deps: CheckDeps, argv: ReadonlyArray<string>): Promise<number> {
  const cmd = parseCommand(argv)
  if (cmd.patterns.length) throw new Error('gate runs every entry; use check for a subset')
  const before = await deps.readSeal()
  const run = await checkEntries(deps, cmd, {sealNow: before, title: 'Visual gate'})
  const after = await deps.readSeal()
  const diffs = diffSeals(before, after)
  deps.log(`report (base ${run.sha.slice(0, 10)}): ${run.reportPath}`)
  if (diffs.length) {
    deps.log(`✗ gate void: the account changed during the run: ${diffs.join('; ')}`)
    deps.openReport(run.reportPath)
    return 1
  }
  if (!run.ok) deps.openReport(run.reportPath)
  deps.log(run.ok ? '✓ gate passed' : `✗ gate failed: ${run.rows.filter(r => r.status !== 'same').length} of ${run.rows.length} not the same`)
  return run.ok ? 0 : 1
}

const AA_ROUNDS = 2

// Two captures of every entry in one sitting, compared with each other; then all of it again
// after a fresh prepare. Any difference is an entry that needs a mask or a settle fix.
export async function runAa(deps: CheckDeps, argv: ReadonlyArray<string>): Promise<number> {
  const cmd = parseCommand(argv)
  const platform: RunPlatform = cmd.ios ? 'ios' : 'desktop'
  const entries = selectEntries(deps.entries, cmd.patterns, platform)
  assertServed(deps, platform)
  const before = await deps.readSeal()
  assertTouredConversationsRead(entries, before, deps.team())
  const frozenAt = before.newestMessageMs + FROZEN_AFTER_NEWEST_MS
  const dir = Store.runDir(`${Store.runStamp()}-aa`)
  const rows: Array<ReportRow> = []
  try {
    for (let round = 1; round <= AA_ROUNDS; round++) {
      for (const theme of cmd.themes) {
        const first = new Map<string, Capture>()
        for (const e of entries) first.set(e.id, await deps.capture(e, {frozenAt, platform, theme}))
        for (const e of entries) {
          const a = first.get(e.id)!
          const b = await deps.capture(e, {frozenAt, platform, theme})
          const sub = path.join(dir, `round${round}`, platform, theme)
          fs.mkdirSync(sub, {recursive: true})
          const name = Store.idFile(e.id)
          const refPng = a.png.length ? path.join(sub, `${name}.1.png`) : null
          if (refPng) fs.writeFileSync(refPng, a.png)
          const compared =
            a.status === 'failed' || !refPng
              ? {changePng: null, diffPng: null, error: a.error, masks: [], result: null, status: 'failed' as const}
              : compareCapture({cap: b, dir: sub, name: `${name}.2`, refMasks: a.masks, refPng})
          const row: ReportRow = {
            basePng: refPng,
            id: e.id,
            platform,
            theme: `${theme} round ${round}`,
            ...compared,
            status: a.status === 'unstable' && compared.status === 'same' ? 'unstable' : compared.status,
          }
          rows.push(row)
          if (row.status !== 'same') deps.log(line(false, row))
        }
      }
      // a fresh session for the next round: close restores the app, the next capture prepares again
      await deps.closeCapture()
    }
  } finally {
    await deps.closeCapture()
  }
  const after = await deps.readSeal()
  const diffs = diffSeals(before, after)
  const reportPath = writeReport(dir, rows, `Visual A/A (${platform})`)
  deps.log(`report: ${reportPath}`)
  const bad = rows.filter(r => r.status !== 'same')
  if (diffs.length) {
    deps.log(`✗ aa void: the account changed during the run: ${diffs.join('; ')}`)
    return 1
  }
  deps.log(bad.length ? `✗ ${bad.length} of ${rows.length} pairs differ` : `✓ all ${rows.length} pairs equal`)
  if (bad.length) deps.openReport(reportPath)
  return bad.length ? 1 : 0
}

// ---------------------------------------------------------------- trees, servers and the app

const run = (cmd: string, args: ReadonlyArray<string>, opts: {cwd?: string; timeout?: number} = {}) =>
  execFileSync(cmd, [...args], {cwd: opts.cwd ?? REPO_DIR, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: opts.timeout ?? GIT_MS})

const execFileAsync = promisify(execFile)
const git = (args: ReadonlyArray<string>, cwd = REPO_DIR) => run('git', args, {cwd})

const gitShow = (rev: string, file: string): string | undefined => {
  try {
    return git(['show', `${rev}:${file}`])
  } catch {
    return undefined
  }
}

export const resolveBaseSha = async (ref?: string): Promise<string> => {
  const args = ref ? ['rev-parse', '--verify', `${ref}^{commit}`] : ['merge-base', 'HEAD', 'origin/master']
  try {
    return (await execFileAsync('git', args, {cwd: REPO_DIR, encoding: 'utf8', timeout: GIT_MS})).stdout.trim()
  } catch (e) {
    throw new Error(`cannot resolve the base ${ref ?? 'merge-base HEAD origin/master'}: ${(e as {stderr?: string}).stderr ?? (e as Error).message}`, {cause: e})
  }
}

// The base check, gate and coverage compare against.
const usedBaseSha = async (platform: RunPlatform, ref?: string) =>
  ref ? resolveBaseSha(ref) : (Store.readLastBase(platform) ?? resolveBaseSha())

const LAUNCH_APP = 'shared/tests/e2e/electron/launch-app.mts'
const DESKTOP_DRIVER = 'shared/tests/e2e/visual/driver-desktop.mts'
const IOS_DRIVER = 'shared/tests/e2e/visual/driver-ios.mts'
const BABEL_CONFIG = 'shared/babel.config.js'
const PASS_BASE = 'pass --base <ref> naming a commit that has it, e.g. the commit before your layout change'

// The base is captured from the app served by the base tree (desktop: launched with the visual
// switches; iOS: its Metro), so the base commit must already carry the visual gate. Never patched
// in: a refusal names --base instead.
export const checkBaseInfra = (
  sha: string,
  readFile: (repoPath: string) => string | undefined,
  opts: {coverage: boolean; ios: boolean}
) => {
  if (opts.ios) {
    if (!readFile(IOS_DRIVER)) throw new Error(`base ${sha} has no visual gate infra (${IOS_DRIVER}); ${PASS_BASE}`)
    if (opts.coverage && !readFile(BABEL_CONFIG)?.includes('KB_VISUAL_COVERAGE')) {
      throw new Error(`base ${sha} has no visual coverage hook in ${BABEL_CONFIG}; ${PASS_BASE}, or drop --coverage`)
    }
    return
  }
  const launch = readFile(LAUNCH_APP)
  if (!readFile(DESKTOP_DRIVER) || !launch?.includes("'--visual'")) {
    throw new Error(`base ${sha} has no visual gate infra (${DESKTOP_DRIVER} and ${LAUNCH_APP} --visual); ${PASS_BASE}`)
  }
  if (opts.coverage && !launch.includes("'--coverage'")) {
    throw new Error(`base ${sha} has no ${LAUNCH_APP} --coverage; ${PASS_BASE}, or drop --coverage`)
  }
}

// A detached, disposable checkout of the base commit next to this worktree.
const baseTreeDir = () => {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
  return path.join(path.dirname(common), '.claude', 'worktrees', 'visual-base')
}

const ensureBaseTree = (sha: string, log: (l: string) => void): string => {
  const tree = baseTreeDir()
  if (fs.existsSync(path.join(tree, '.git'))) {
    const dirty = git(['status', '--porcelain', '--untracked-files=no'], tree).trim()
    if (dirty) throw new Error(`${tree} has local changes; it is the gate's disposable base checkout, so remove it (git worktree remove --force ${tree}) and rerun`)
    if (git(['rev-parse', 'HEAD'], tree).trim() !== sha) {
      log(`base tree: checking out ${sha.slice(0, 10)} in ${tree}`)
      git(['checkout', '--detach', sha], tree)
    }
  } else if (fs.existsSync(tree)) {
    throw new Error(`${tree} exists but is not a git worktree; remove it and rerun`)
  } else {
    log(`base tree: adding ${tree} at ${sha.slice(0, 10)}`)
    git(['worktree', 'add', '--detach', tree, sha])
  }
  const head = git(['rev-parse', 'HEAD'], tree).trim()
  if (head !== sha) throw new Error(`${tree} is at ${head}, wanted ${sha}`)
  return path.join(tree, 'shared')
}

const INSTALL_STAMP = path.join('node_modules', '.kb-visual-yarn-lock.sha256')

const ensureInstalled = (shared: string, log: (l: string) => void) => {
  const lockHash = createHash('sha256').update(fs.readFileSync(path.join(shared, 'yarn.lock'))).digest('hex')
  const stamp = path.join(shared, INSTALL_STAMP)
  const installed = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : undefined
  if (fs.existsSync(path.join(shared, 'node_modules')) && installed === lockHash) return
  log(`base tree: yarn install --frozen-lockfile in ${shared}`)
  const r = spawnSync('yarn', ['install', '--frozen-lockfile'], {cwd: shared, env: process.env, stdio: 'inherit', timeout: INSTALL_MS})
  if (r.status !== 0) throw new Error(`yarn install in ${shared} failed (${r.error?.message ?? `exit ${r.status}`})`)
  fs.writeFileSync(stamp, lockHash)
}

const launchDesktop = (shared: string, coverage: boolean, log: (l: string) => void) => {
  log(`desktop: launching the app from ${shared} (--visual${coverage ? ' --coverage' : ''})`)
  const r = spawnSync('node', [path.join(path.dirname(shared), LAUNCH_APP), '--visual', ...(coverage ? ['--coverage'] : [])], {
    cwd: shared,
    env: process.env,
    stdio: 'inherit',
    timeout: LAUNCH_MS,
  })
  if (r.status !== 0) throw new Error(`launch-app.mts from ${shared} failed (${r.error?.message ?? `exit ${r.status}`})`)
  assertServedFrom(DESKTOP_PORT, shared, 'desktop dev server')
}

const listeners = (port: number) => {
  try {
    return run('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {timeout: 10_000})
      .split('\n')
      .map(s => Number(s.trim()))
      .filter(n => n > 0)
  } catch {
    return []
  }
}

// node's http rather than fetch: this file is also type-checked against react-native's fetch
const metroRunning = async () =>
  new Promise<boolean>(resolve => {
    const req = http.get({host: '127.0.0.1', path: '/status', port: METRO_PORT, timeout: 2_000}, res => {
      let body = ''
      res.on('data', (d: Buffer) => {
        body += d.toString()
      })
      res.on('end', () => resolve(body.includes('packager-status:running')))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
  })

const signal = (pids: ReadonlyArray<number>, sig: NodeJS.Signals) => {
  for (const pid of pids) {
    try {
      process.kill(pid, sig)
    } catch {}
  }
}

// Metro from `shared`, started the way yarn rn:start does (always with --clear).
const serveMetro = async (shared: string, coverage: boolean, log: (l: string) => void) => {
  const portFree = async (ms: number) => {
    const end = Date.now() + ms
    while (listeners(METRO_PORT).length) {
      if (Date.now() > end) return false
      await sleep(250)
    }
    return true
  }
  signal(listeners(METRO_PORT), 'SIGTERM')
  if (!(await portFree(METRO_STOP_MS))) {
    signal(listeners(METRO_PORT), 'SIGKILL')
    if (!(await portFree(METRO_STOP_MS))) throw new Error(`port ${METRO_PORT} is still in use after SIGKILL`)
  }
  const out = fs.openSync(METRO_LOG, 'a')
  fs.writeSync(out, `\n=== visual gate Metro ${new Date().toISOString()} from ${shared} ===\n`)
  const child = spawn('yarn', ['rn:start'], {
    cwd: shared,
    detached: true,
    env: {...process.env, KB_VISUAL_COVERAGE: coverage ? '1' : ''},
    stdio: ['ignore', out, out],
  })
  child.unref()
  fs.closeSync(out)
  log(
    `Metro: restarted from ${shared} with --clear, KB_VISUAL_COVERAGE ${coverage ? 'on' : 'off'} ` +
      `(Metro caches transforms per file, not per env var, so toggling coverage needs --clear); log at ${METRO_LOG}`
  )
  await waitFor(`Metro on port ${METRO_PORT}`, METRO_START_MS, metroRunning)
  assertServedFrom(METRO_PORT, shared, 'Metro')
}

// Terminates and relaunches the app so it loads the bundle the current Metro serves, and waits for
// a logged in JS runtime.
const relaunchIosApp = async (log: (l: string) => void) => {
  const device = iosDevice()
  const udid = udidForName(device)
  try {
    run('xcrun', ['simctl', 'terminate', udid, IOS_BUNDLE_ID], {timeout: 30_000})
  } catch {}
  run('xcrun', ['simctl', 'launch', udid, IOS_BUNDLE_ID], {timeout: 30_000})
  log(`iOS: relaunched the app on ${device}; waiting for the bundle`)
  let last = ''
  try {
    await waitFor('a logged in JS runtime after the relaunch', IOS_BOOT_MS, async () => {
      try {
        const page = await inspectorPageFor(device, IOS_BUNDLE_ID)
        last = await evalInPage<string>(page, `return kbModule('constants/router.tsx').getRootState()?.routes?.[0]?.name ?? ''`)
        return last === 'loggedIn'
      } catch (e) {
        last = (e as Error).message
        return false
      }
    })
  } catch (e) {
    throw new Error(`${(e as Error).message} (last: ${last})`, {cause: e})
  }
}

// ---------------------------------------------------------------- base

// Puts the user back on their own tree after `base` served the app from the base tree: the
// desktop app with the plain visual switches, or this tree's Metro without coverage.
type Restore = {commands: Array<string>; run: () => Promise<void> | void}

const restoreFor = (ios: boolean, current: string, log: (l: string) => void): Restore =>
  ios
    ? {
        commands: [
          `kill $(lsof -t -iTCP:${METRO_PORT} -sTCP:LISTEN)`,
          `cd ${current} && yarn rn:start`,
          `xcrun simctl terminate ${iosDevice()} ${IOS_BUNDLE_ID}; xcrun simctl launch ${iosDevice()} ${IOS_BUNDLE_ID}`,
        ],
        run: async () => {
          await serveMetro(current, false, log)
          await relaunchIosApp(log)
        },
      }
    : {
        commands: [`cd ${current} && node ${path.join(path.dirname(current), LAUNCH_APP)} --visual`],
        run: () => launchDesktop(current, false, log),
      }

// Set while the app is served from the base tree, so the deadline and signal paths can restore.
let pendingRestore: Restore | undefined

const printRestoreCommands = (r: Restore) =>
  console.error(`the app may still be served from the base tree; to restore it by hand:\n  ${r.commands.join('\n  ')}`)

// Set while a capture session is open (prepare patches Date, the theme and, on iOS, simulator
// settings), so the deadline and signal paths can close it or say how to undo it by hand.
let openSession: DesktopSession | IosSession | undefined
const CLOSE_ON_ABORT_MS = 60_000

const printCleanupCommands = (s: DesktopSession | IosSession) => {
  const cmds = s.cleanupCommands()
  if (cmds.length) console.error(`the capture session was not closed; to undo what it changed by hand:\n  ${cmds.join('\n  ')}`)
}

const closeSession = async (s: DesktopSession | IosSession) => {
  try {
    await s.close()
  } catch (e) {
    printCleanupCommands(s)
    throw e
  } finally {
    if (openSession === s) openSession = undefined
  }
}

export async function runBase(argv: ReadonlyArray<string>, log: (l: string) => void): Promise<number> {
  const cmd = parseCommand(argv)
  const platform: RunPlatform = cmd.ios ? 'ios' : 'desktop'
  const entries = selectEntries(tour, cmd.patterns, platform)
  const sha = await resolveBaseSha(cmd.base)
  checkBaseInfra(sha, p => gitShow(sha, p), {coverage: cmd.coverage, ios: cmd.ios})
  const baseShared = ensureBaseTree(sha, log)
  ensureInstalled(baseShared, log)
  const current = fs.realpathSync(SHARED_DIR)

  const before = await readSeal()
  assertTouredConversationsRead(entries, before, e2eAccounts().team)
  const frozenAt = before.newestMessageMs + FROZEN_AFTER_NEWEST_MS
  log(`base ${sha.slice(0, 10)}: frozen at ${new Date(frozenAt).toISOString()}`)

  const platformDir = Store.basePlatformDir(sha, platform)
  const stage = path.join(Store.resultsDir(), 'base', `.stage-${process.pid}`)
  const staged = (p: string) => path.join(stage, path.relative(platformDir, p))
  const writeStaged = (p: string, data: string | Buffer) => {
    fs.mkdirSync(path.dirname(staged(p)), {recursive: true})
    fs.writeFileSync(staged(p), data)
  }
  fs.rmSync(stage, {force: true, recursive: true})
  const restore = restoreFor(cmd.ios, current, log)
  try {
    let failure: Error | undefined
    pendingRestore = restore
    try {
      if (cmd.ios) {
        await serveMetro(baseShared, cmd.coverage, log)
        await relaunchIosApp(log)
      } else {
        launchDesktop(baseShared, cmd.coverage, log)
      }
      const session: DesktopSession | IosSession = cmd.ios ? await openIos({device: iosDevice()}) : await openDesktop()
      openSession = session
      const problems: Array<string> = []
      try {
        for (const theme of cmd.themes) {
          const {chrome} = await session.prepare({frozenAt, reload: true, theme})
          if (cmd.coverage) {
            if (!chrome) throw new Error('the app has no coverage marks after a --coverage launch')
            writeStaged(Store.baseCoveragePath(sha, platform, theme, '__chrome__'), Store.writeCoverageJson(chrome, false))
          }
          for (const e of entries) {
            const cap = await session.capture(e)
            if (cap.status !== 'ok') {
              problems.push(`${e.id} ${platform} ${theme}: ${cap.status}${cap.error ? ` (${cap.error})` : ''}`)
              continue
            }
            writeStaged(Store.basePng(sha, platform, theme, e.id), cap.png)
            writeStaged(Store.baseMasksPath(sha, platform, theme, e.id), JSON.stringify(cap.masks))
            if (cmd.coverage) {
              if (!cap.coverage) throw new Error(`${e.id}: no coverage from a --coverage launch`)
              writeStaged(Store.baseCoveragePath(sha, platform, theme, e.id), Store.writeCoverageJson(cap.coverage, !!e.masks?.length))
            }
            log(`✓ base ${e.id} ${platform} ${theme}`)
          }
        }
      } finally {
        await closeSession(session)
      }
      if (problems.length) throw new Error(`base not written; captures that were not ok:\n  ${problems.join('\n  ')}`)
    } catch (e) {
      // logged before the restore, so a restore that hangs or throws can't hide it
      failure = e as Error
      log(`✗ ${failure.message}`)
    }
    log(`restoring ${platform === 'ios' ? 'Metro and the app' : 'the app'} from ${current}`)
    try {
      await restore.run()
      pendingRestore = undefined
    } catch (e) {
      printRestoreCommands(restore)
      pendingRestore = undefined
      const msg = `restoring the app from ${current} failed: ${(e as Error).message}`
      throw new Error(failure ? `${failure.message}\nand then ${msg}` : msg, {cause: e})
    }
    if (failure) throw failure
    const after = await readSeal()
    const diffs = diffSeals(before, after)
    if (diffs.length) throw new Error(`base not written; the account changed during the run: ${diffs.join('; ')}`)

    const old = Store.readBaseMeta(sha, platform)
    if (old && (old.frozenAt !== frozenAt || old.seal.hash !== before.hash)) {
      log(`replacing the earlier ${platform} base set at ${sha.slice(0, 10)}: its seal or frozen instant differs`)
      fs.rmSync(platformDir, {force: true, recursive: true})
    }
    fs.mkdirSync(platformDir, {recursive: true})
    fs.cpSync(stage, platformDir, {force: true, recursive: true})
    Store.writeBaseMeta(sha, platform, {createdAt: Date.now(), frozenAt, seal: before})
    Store.writeLastBase(platform, sha)
    log(`base written to ${platformDir}`)
    return 0
  } finally {
    fs.rmSync(stage, {force: true, recursive: true})
  }
}

// ---------------------------------------------------------------- coverage

// `A..B` and `A...B` diff two commits (`A...B` from their merge base); a bare ref diffs the
// working tree against it, and the changed sources are read from disk.
export const parseCoverageRange = (range: string): {left: string; right: string | undefined; symmetric: boolean} => {
  const m = /^(.*?)(\.\.\.?)(.*)$/.exec(range)
  if (!m) return {left: range, right: undefined, symmetric: false}
  return {left: m[1] || 'HEAD', right: m[3] || 'HEAD', symmetric: m[2] === '...'}
}

// A range that compares a commit with itself, or touches no .tsx file, checks nothing; exiting 0
// on it would read as a pass.
export const coverageRangeRefusal = (opts: {
  range: string
  leftSha: string
  rightSha: string | undefined
  changedFiles: number
}): string | undefined => {
  if (opts.rightSha !== undefined && opts.leftSha === opts.rightSha) {
    return (
      `coverage range ${opts.range} is empty: both sides are ${opts.leftSha.slice(0, 10)}. ` +
      'To check the working tree against a commit, pass the commit alone, e.g. yarn visual:coverage HEAD'
    )
  }
  if (!opts.changedFiles) {
    return (
      `no .tsx file changed in ${opts.range}, so there is nothing to check. ` +
      'Untracked new files are not in git diff: git add -N them (or commit) first'
    )
  }
  return undefined
}

const sharedRel = (repoPath: string) => path.posix.relative('shared', repoPath)

export async function runCoverage(argv: ReadonlyArray<string>, log: (l: string) => void): Promise<number> {
  const cmd = parseCommand(argv)
  const range = cmd.patterns[0]
  if (!range || cmd.patterns.length > 1) {
    throw new Error('coverage needs one git range or ref, e.g. yarn visual:coverage HEAD (working tree) or origin/master..HEAD')
  }
  const sha = await usedBaseSha(cmd.ios ? 'ios' : 'desktop', cmd.base)
  const {mounted, masked} = Store.readBaseCoverage(sha)
  if (!mounted.length) throw new Error(`no coverage stored for base ${sha}; run yarn visual:base --coverage (and --ios) first`)
  if (masked.length) log(`skipped ${masked.length} masked capture${masked.length === 1 ? '' : 's'}: ${masked.join(', ')}`)
  const {left, right, symmetric} = parseCoverageRange(range)
  const revParse = (ref: string) => git(['rev-parse', '--verify', `${ref}^{commit}`]).trim()
  const rightSha = right === undefined ? undefined : revParse(right)
  const leftSha = symmetric && rightSha ? git(['merge-base', revParse(left), rightSha]).trim() : revParse(left)
  const diff = git(['diff', '--no-ext-diff', '-U0', range, '--', '*.tsx'])
  const files = parseDiffHunks(diff)
  const refusal = coverageRangeRefusal({changedFiles: files.size, leftSha, range, rightSha})
  if (refusal) throw new Error(refusal)
  const changed = new Map<string, ReadonlyArray<Range>>()
  const baseHunks = new Map<string, ReadonlyArray<Hunk>>()
  for (const [file, hunks] of files) {
    const rel = sharedRel(file)
    if (unmarkedFile(rel) || outOfScopeFile(rel)) continue
    const src = right ? gitShow(right, file) : fs.readFileSync(path.join(REPO_DIR, file), 'utf8')
    if (src === undefined) continue
    const sites = changedRanges(callSiteRanges(src), hunks)
    if (!sites.length) continue
    changed.set(rel, sites)
    const toBase = git(['diff', '--no-ext-diff', '-U0', sha, ...(right ? [right] : []), '--', file])
    baseHunks.set(rel, parseDiffHunks(toBase).get(file) ?? [])
  }
  const total = [...changed.values()].reduce((n, r) => n + r.length, 0)
  const missing = unmountedChanged({baseHunks, changed, mounted})
  for (const id of missing) log(`✗ never mounted: ${id}`)
  log(`${total} changed call site${total === 1 ? '' : 's'}, ${missing.length} never mounted by base ${sha.slice(0, 10)}`)
  return missing.length ? 1 : 0
}

// ---------------------------------------------------------------- main

const sessionCapturer = () => {
  let session: DesktopSession | IosSession | undefined
  let preparedFor = ''
  const capture = async (entry: TourEntry, o: CaptureOpts) => {
    if (!session) {
      session = o.platform === 'ios' ? await openIos({device: iosDevice()}) : await openDesktop()
      openSession = session
    }
    const key = `${o.theme}:${o.frozenAt}`
    if (preparedFor !== key) {
      await session.prepare({frozenAt: o.frozenAt, reload: true, theme: o.theme})
      preparedFor = key
    }
    return session.capture(entry)
  }
  const close = async () => {
    const s = session
    session = undefined
    preparedFor = ''
    if (s) await closeSession(s)
  }
  return {capture, close}
}

export const realDeps = (cmd: Command): CheckDeps => {
  const capturer = sessionCapturer()
  return {
    baseSha: async () => usedBaseSha(cmd.ios ? 'ios' : 'desktop', cmd.base),
    capture: capturer.capture,
    closeCapture: capturer.close,
    currentShared: fs.realpathSync(SHARED_DIR),
    entries: tour,
    hasBasePng: Store.hasBasePng,
    log: l => console.log(l),
    openReport: p => {
      if (process.env['KB_VISUAL_NO_OPEN']) return
      spawn('open', [p], {detached: true, stdio: 'ignore'}).unref()
    },
    readBaseMeta: Store.readBaseMeta,
    readSeal,
    servedFrom: port => {
      const cwd = listenerCwd(port)
      return cwd ? fs.realpathSync(cwd) : undefined
    },
    team: () => e2eAccounts().team,
  }
}

const main = async () => {
  process.env['KB_VISUAL_RUN'] = '1'
  const [name = '', ...argv] = process.argv.slice(2)
  const deadline = DEADLINES[name]
  if (!deadline) {
    console.error('usage: cli.mts base|check|gate|aa|coverage …')
    process.exit(2)
  }
  setTimeout(() => {
    void (async () => {
      console.error(`visual:${name} did not finish in ${deadline / MIN} minutes; exiting`)
      const session = openSession
      if (session) {
        console.error('closing the capture session')
        try {
          await withDeadline(session.close(), CLOSE_ON_ABORT_MS, 'closing the capture session')
          console.error('closed')
        } catch (e) {
          console.error(`close failed: ${(e as Error).message}`)
          printCleanupCommands(session)
        }
      }
      const restore = pendingRestore
      if (restore) {
        printRestoreCommands(restore)
        console.error('trying the restore now')
        try {
          await withDeadline(Promise.resolve().then(restore.run), RESTORE_MS, 'restoring the app')
          console.error('restored')
        } catch (e) {
          console.error(`restore failed: ${(e as Error).message}`)
        }
      }
      process.exit(1)
    })()
  }, deadline)
  // Registered before the lock's own handler, which exits at once, so there is no time to close
  // or restore; the driver's exit hook still stops its Appium.
  const onSignal = () => {
    if (openSession) printCleanupCommands(openSession)
    if (pendingRestore) printRestoreCommands(pendingRestore)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  const log = (l: string) => console.log(l)
  let code = 1
  try {
    if (name !== 'coverage') acquireLock(`visual:${name} ${argv.join(' ')}`)
    switch (name) {
      case 'base':
        code = await runBase(argv, log)
        break
      case 'check':
        code = await runCheck(realDeps(parseCommand(argv)), argv)
        break
      case 'gate':
        code = await runGate(realDeps(parseCommand(argv)), argv)
        break
      case 'aa':
        code = await runAa(realDeps(parseCommand(argv)), argv)
        break
      case 'coverage':
        code = await runCoverage(argv, log)
        break
    }
  } catch (e) {
    console.error(`✗ visual:${name}: ${(e as Error).message}`)
    code = 1
  }
  process.exit(code)
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) await main()
