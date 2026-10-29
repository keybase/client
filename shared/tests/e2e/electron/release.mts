// yarn test:e2e:desktop:release
//
// The desktop release gate, in one command. Exits 1 on any failure: a flow test failed (known
// failures from known-failures.ts included), was flaky or was skipped, a tour entry failed to
// render, the census found an unclaimed route or window or an unsent write, an artifact held a secret
// from the env file, or a phase could not run.
//   1. preflight, refusing with what to do: the env file loads, this run takes the release lock
//      (/tmp/kb-e2e-release.lock, KB_E2E_RELEASE_LOCK; no other release run holds it), the main
//      service is on KB_SMOKE_USER, ports 4000/9222/9229 are free or held by an app launch-app.mts
//      started, no visual gate run holds its lock, the macOS session is unlocked, KBFS answers,
//      both peers answer (started if not, via ensurePeer) and `accounts/setup --check` passes. Nothing is launched before it
//      passes, and the main service is never switched, stopped or restarted, nor its components
//      started
//   2. launch the dev app (launch-app.mts)
//   3. sweep what earlier runs left in the test accounts (once)
//   4. every flow, light mode only (project electron-flows)
//   5. the visual tour in render mode, on the app relaunched with the visual gate switches
//   6. census, then the report, opened unless KB_E2E_NO_OPEN=1
//   7. a scan of everything under tests/results for the env file's secrets (secret-scan.ts): a file
//      that holds one is deleted and named, and the run fails
// While flows and render drive the app, a watchdog (watchdog.ts) fails the run if its renderer goes
// blank, writing why to tests/results/watchdog.log. Then it stops the app it launched (peers stay
// up), prints one line per phase and posts a macOS notification. Each child gets this run's
// KB_E2E_RUN_ID.
//
// KB_E2E_RELEASE_TIMEOUT_MIN  overall deadline (default 150)
// KB_E2E_RELEASE_ONLY=<grep>  for trying the command itself: only flows matching <grep>, and only
//                             the settings/* tour entries (the census then reports gaps)
import {spawn, spawnSync, execFileSync, type ChildProcess} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {childEnvVars, loadE2EEnv, peerRoles, type E2EEnv} from '../accounts/env.ts'
import {newRunId} from '../accounts/run-id.ts'
import {formatSweep, sweep} from '../accounts/sweep.mts'
import {runAbortable} from '../shared/deadline.ts'
import {ensurePeer, mainWhoami, redactSecrets, runKeybase} from '../shared/peer-service.ts'
import {acquireFileLock, assertNotLocked} from '../visual/lock.mts'
import {appLogPath} from './app-log.ts'
import {groupAlive, readAppPidfile, stopAppGroup} from './app-pidfile.ts'
import {closeMainInspector, sessionLocked} from './helpers/main-process.ts'
import {scanAndPurge, watchEnvSecrets} from './secret-scan.ts'
import {createWatchdog} from './watchdog.ts'
import {
  flowProblems,
  flowsLine,
  flowsOk,
  fmtMs,
  parseLsof,
  parseTimeoutMin,
  preflightProblems,
  RELEASE_PORTS,
  releaseFailed,
  renderLine,
  summarizeFlows,
  summarizeRender,
  summaryLines,
  type Outcome,
  type Phase,
  type PortHolder,
  type PreflightState,
  type PwReport,
  type RenderResultRow,
} from './release-lib.ts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const resultsDir = path.join(sharedDir, 'tests/results')
const out = {
  census: path.join(resultsDir, 'census.md'),
  checklist: path.join(resultsDir, 'manual-checklist.md'),
  report: path.join(resultsDir, 'electron-report.html'),
  results: path.join(resultsDir, 'report/results.json'),
  watchdog: path.join(resultsDir, 'watchdog.log'),
}
const project = 'electron-flows'
const MIN = 60_000

const runStart = Date.now()
const timeout = parseTimeoutMin(process.env['KB_E2E_RELEASE_TIMEOUT_MIN'])
if ('error' in timeout) {
  console.error(`[release] refusing to run: ${timeout.error}`)
  process.exit(1)
}
const deadlineMs = timeout.minutes * MIN
const only = process.env['KB_E2E_RELEASE_ONLY'] || undefined
// The gate's own runs set this to skip the lock check; this command is not one of them.
delete process.env['KB_VISUAL_RUN']

const log = (s: string) => console.log(`[release] ${s}`)
const errText = (e: unknown) => redactSecrets(e instanceof Error ? e.message : String(e))
const remainingMs = () => Math.max(0, runStart + deadlineMs - Date.now())

const phases: Array<Phase> = []
let currentPhase: string | undefined
let currentChild: ChildProcess | undefined
let launchedPgid: number | undefined
let renderDir: string | undefined
// renderDir, when this run's render wrote its render.json there
const renderedDir = () => (renderDir && fs.existsSync(path.join(renderDir, 'render.json')) ? renderDir : undefined)
let finishing = false
// set once an interrupt or the overall deadline stops the run: no further phase starts
let aborted = false
const isAborted = () => aborted

const watchdog = createWatchdog({appLog: appLogPath(), log, logFile: out.watchdog})
// Runs `f` with the watchdog on, for the phases that drive the app.
const watched = async <T,>(name: string, f: () => Promise<T>) => {
  watchdog.start(name)
  try {
    return await f()
  } finally {
    await watchdog.stop()
  }
}

// Runs a child in shared/ with its output passed through, under a deadline (SIGTERM, then SIGKILL
// 10s later). Resolves with its exit code (null when killed) and its stdout.
const runChild = async (name: string, cmd: string, args: ReadonlyArray<string>, timeoutMs: number) =>
  new Promise<{code: number | null; stdout: string; timedOut: boolean}>(resolve => {
    const child = spawn(cmd, [...args], {cwd: sharedDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe']})
    currentChild = child
    let stdout = ''
    let timedOut = false
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
      process.stdout.write(d)
    })
    child.stderr.on('data', (d: Buffer) => process.stderr.write(d))
    const timer = setTimeout(() => {
      timedOut = true
      log(`${name}: not done in ${Math.round(timeoutMs / 1000)}s; stopping it`)
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 10_000)
    }, timeoutMs)
    child.on('close', code => {
      clearTimeout(timer)
      if (currentChild === child) currentChild = undefined
      resolve({code, stdout, timedOut})
    })
    child.on('error', e => {
      clearTimeout(timer)
      resolve({code: null, stdout: `${stdout}\n${e.message}`, timedOut})
    })
  })

const node = (script: string, ...args: Array<string>) =>
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(sharedDir, script), ...args]

const phase = async (name: string, f: () => Promise<Omit<Phase, 'name' | 'ms'>>) => {
  if (isAborted()) return false
  log(`--- ${name} ---`)
  const start = Date.now()
  currentPhase = name
  let p: Omit<Phase, 'name' | 'ms'>
  try {
    p = await f()
  } catch (e) {
    p = {line: errText(e), ok: false}
  }
  currentPhase = undefined
  // the abort already recorded this phase as stopped
  if (isAborted()) return false
  phases.push({...p, ms: Date.now() - start, name})
  log(`${name}: ${p.ok ? 'ok' : 'FAILED'}: ${p.line}`)
  return p.ok
}

// ---------------------------------------------------------------- preflight

const outcome = async (p: Promise<unknown>): Promise<Outcome> =>
  p.then(
    () => ({ok: true}) as const,
    (e: unknown) => ({error: errText(e), ok: false}) as const
  )

const portState = (port: number): PreflightState['ports'][number] => {
  const r = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8', timeout: 10_000})
  const parsed = parseLsof({status: r.status, stderr: r.stderr, stdout: r.stdout, ...(r.error ? {error: r.error.message} : {})})
  return 'error' in parsed ? {error: parsed.error, holders: [], port} : {holders: parsed.pids.map(holder), port}
}

const screenState = (): PreflightState['screen'] => {
  try {
    return {locked: sessionLocked()}
  } catch (e) {
    return {error: errText(e)}
  }
}

const holder = (pid: number): PortHolder => {
  try {
    const line = execFileSync('ps', ['-o', 'pgid=,command=', '-p', String(pid)], {encoding: 'utf8', timeout: 5_000}).trim()
    const m = /^(\d+)\s+(.*)$/.exec(line)
    return {command: (m?.[2] ?? '').slice(0, 120), pgid: Number(m?.[1] ?? -1), pid}
  } catch {
    return {command: '(exited)', pgid: -1, pid}
  }
}

// One release run at a time: a second one would sweep, relaunch and stop the app under the first.
const releaseLockPath = () => process.env['KB_E2E_RELEASE_LOCK'] ?? '/tmp/kb-e2e-release.lock'
// set once this run holds the release lock (released on exit); until then the run touches nothing
let holdsReleaseLock = false

const preflight = async (): Promise<{env: E2EEnv; problems: Array<string>}> => {
  const env = loadE2EEnv()
  try {
    acquireFileLock(releaseLockPath(), `yarn test:e2e:desktop:release (run ${process.env['KB_E2E_RUN_ID'] ?? '?'})`, 'release lock')
    holdsReleaseLock = true
  } catch (e) {
    const releaseLockHeld = errText(e)
    return {env, problems: preflightProblems({appPgid: undefined, lockHeld: undefined, ports: [], releaseLockHeld, smokeUser: env.smokeUser, whoami: {ok: false, error: 'not checked'}})}
  }
  const whoami = await mainWhoami().then(
    user => ({ok: true, user}) as const,
    (e: unknown) => ({error: errText(e), ok: false}) as const
  )
  const recorded = readAppPidfile()
  let lockHeld: string | undefined
  try {
    assertNotLocked('the release run')
  } catch (e) {
    lockHeld = errText(e)
  }
  const onSmoke = whoami.ok && whoami.user === env.smokeUser
  const kbfsPath = `/keybase/private/${env.smokeUser}`
  const state: PreflightState = {
    appPgid: recorded && groupAlive(recorded.pgid) ? recorded.pgid : undefined,
    ...(onSmoke ? {kbfs: {path: kbfsPath, ...(await outcome(runKeybase(['fs', 'ls', kbfsPath], {timeoutMs: 15_000})))}} : {}),
    lockHeld,
    ports: RELEASE_PORTS.map(portState),
    screen: screenState(),
    smokeUser: env.smokeUser,
    whoami,
  }
  // Peers are started only once nothing else stands in the way.
  if (!preflightProblems(state).length) {
    const peers: Array<{role: string} & Outcome> = []
    for (const role of peerRoles) peers.push({role, ...(await outcome(ensurePeer(role, env)))})
    state.peers = peers
    const check = await runChild('setup --check', 'node', node('tests/e2e/accounts/setup.mts', '--check'), 2 * MIN)
    state.setupCheck = check.code === 0 ? {ok: true} : {error: check.stdout || `exit ${check.code}`, ok: false}
  }
  return {env, problems: preflightProblems(state)}
}

// ---------------------------------------------------------------- the end

// The app this run launched: the group it recorded, and the one in the pidfile when a launch wrote
// it during this run (a launch interrupted before launch-app.mts exited has spawned the app already).
const stopApp = async () => {
  // a run refused for the lock never launched anything, and the pidfile is the other run's
  if (!holdsReleaseLock) return
  // the main process's inspector runs any code sent to it: closed even if the app stays up
  try {
    await closeMainInspector()
  } catch (e) {
    log(`could not close the app's main process inspector: ${errText(e)}`)
  }
  const pgids = new Set<number>()
  if (launchedPgid !== undefined) pgids.add(launchedPgid)
  const recorded = readAppPidfile()
  if (recorded && recorded.start >= runStart) pgids.add(recorded.pgid)
  launchedPgid = undefined
  for (const pgid of pgids) {
    log(`stopping the app it launched (process group ${pgid}); peers stay up`)
    try {
      await stopAppGroup(pgid)
    } catch (e) {
      log(`could not stop the app: ${errText(e)}`)
    }
  }
}

// SIGTERM, then SIGKILL after 10s; resolves once the child has closed (or 2s after the SIGKILL).
const stopChild = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()))
  child.kill('SIGTERM')
  const settled = await Promise.race([closed.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 10_000))])
  if (settled) return
  child.kill('SIGKILL')
  await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 2_000))])
}

const notify = (text: string) => {
  try {
    execFileSync(
      'osascript',
      ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title (item 2 of argv)', '-e', 'end run', text, 'Keybase desktop release'],
      {stdio: 'ignore', timeout: 10_000}
    )
  } catch (e) {
    log(`notification failed: ${errText(e)}`)
  }
}

const printResults = () => {
  for (const line of summaryLines(phases)) console.log(line)
  console.log(`total ${fmtMs(Date.now() - runStart)}, run id ${process.env['KB_E2E_RUN_ID'] ?? '(none)'}`)
  const fresh = (p: string) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= runStart
  const show = (what: string, p: string) => console.log(`${what.padEnd(17)}${p}${fresh(p) ? '' : ' (not written by this run)'}`)
  show('report', out.report)
  show('census', out.census)
  show('manual checklist', out.checklist)
  show('flow results', out.results)
  if (renderDir) show('render', renderDir)
}

const finish = async (code: number, why?: string) => {
  if (finishing) return
  finishing = true
  // set before anything below can throw, and an error while finishing fails the run: no path out
  // of here exits 0 by accident
  process.exitCode = code
  try {
    await watchdog.stop()
    const incidents = watchdog.incidents()
    if (incidents.length) {
      phases.push({line: `${incidents.join('; ')} (see ${out.watchdog})`, name: 'watchdog', ok: false})
      if (code === 0) code = 1
    } else if (watchdog.polls()) {
      phases.push({line: `renderer never went blank (${watchdog.polls()} polls)`, name: 'watchdog', ok: true})
    }
    process.exitCode = code
    await stopApp()
    console.log('\n=== release summary ===')
    if (why) console.log(why)
    printResults()
    const failed = code !== 0
    notify(why ?? `${failed ? 'FAILED' : 'passed'} in ${fmtMs(Date.now() - runStart)}: ${phases.filter(p => !p.ok).map(p => p.name).join(', ') || 'all phases ok'}`)
  } catch (e) {
    if (code === 0) code = 1
    console.error(`[release] finishing the run failed: ${errText(e)}`)
  } finally {
    process.exit(code)
  }
}

const abort = async (why: string, code: number) => {
  if (aborted) return
  aborted = true
  const name = currentPhase
  const child = currentChild
  if (name) phases.push({line: `stopped: ${why}`, name, ok: false})
  if (child) await stopChild(child)
  await finish(code, `${why}${name ? ` during ${name}` : ''}; partial results below`)
}

// The run's own ending; an abort in progress ends it instead, with its reason and exit code.
const endRun = async (code: number, why?: string) => (isAborted() ? undefined : finish(code, why))

process.on('SIGINT', () => void abort('interrupted', 130))
process.on('SIGTERM', () => void abort('terminated', 143))
// the terminal or the shell that started the run went away
process.on('SIGHUP', () => void abort('hung up', 129))
setTimeout(() => void abort(`overall deadline of ${deadlineMs / MIN} minutes (KB_E2E_RELEASE_TIMEOUT_MIN) reached`, 1), deadlineMs)

// ---------------------------------------------------------------- the run

const main = async () => {
  const runId = newRunId(runStart)
  process.env['KB_E2E_RUN_ID'] = runId
  log(`run ${runId}${only ? `, only flows matching ${JSON.stringify(only)} and settings/* tour entries` : ''}`)

  let env: E2EEnv | undefined
  const ready = await phase('preflight', async () => {
    const r = await preflight()
    env = r.env
    if (r.problems.length) {
      console.error(`[release] refusing to run:\n  - ${r.problems.join('\n  - ')}`)
      return {line: `refused: ${r.problems.length} problem(s)`, ok: false}
    }
    return {line: 'ready', ok: true}
  })
  if (!ready || !env) return endRun(1)
  const e2eEnv = env
  // the scan at the end looks for every second-account password the env file held during the run
  const secrets = watchEnvSecrets()
  // children that read the accounts from the environment alone see the ones preflight checked
  Object.assign(process.env, childEnvVars(e2eEnv))

  const launched = await phase('launch', async () => {
    const r = await runChild('launch', 'node', node('tests/e2e/electron/launch-app.mts'), 5 * MIN)
    launchedPgid = readAppPidfile()?.pgid
    if (r.code !== 0) return {line: `launch-app.mts exited ${r.code}`, ok: false}
    if (launchedPgid === undefined) return {line: 'launch-app.mts wrote no pidfile', ok: false}
    return {line: `app up (process group ${launchedPgid})`, ok: true}
  })
  if (!launched) return endRun(1)

  // A sweep past its deadline is told to stop and waited for (each of its calls has its own deadline,
  // the longest 90s), so no delete is still going when the flows start; one that does not stop
  // stops the run.
  const sweepState = {running: false}
  await phase('sweep', async () => {
    const r = await runAbortable('the sweep', Math.min(20 * MIN, remainingMs()), 2 * MIN, async signal =>
      sweep(e2eEnv, {before: runStart, dryRun: false, runId, signal})
    )
    if (!r.ok) {
      sweepState.running = !r.settled
      return {line: r.message, ok: false}
    }
    console.log(formatSweep(r.value, e2eEnv, false))
    return {line: `${r.value.deleted.length} deleted, ${r.value.listOnly.length} listed only, ${r.value.errors.length} errors`, ok: !r.value.errors.length}
  })
  if (sweepState.running) return endRun(1, 'the sweep did not stop after its deadline; no flow runs beside it')

  await phase('flows', async () => {
    const start = Date.now()
    const args = ['test', '--config', 'tests/e2e/electron/playwright.config.ts', `--project=${project}`, ...(only ? ['--grep', only] : [])]
    const r = await watched('flows', async () => runChild('flows', path.join(sharedDir, 'node_modules/.bin/playwright'), args, remainingMs()))
    if (!fs.existsSync(out.results) || fs.statSync(out.results).mtimeMs < start) {
      return {line: `playwright exited ${r.code} and wrote no ${out.results}`, ok: false}
    }
    const s = summarizeFlows(JSON.parse(fs.readFileSync(out.results, 'utf8')) as PwReport, project)
    for (const n of s.fresh) log(`new failure: ${n}`)
    for (const n of s.known) log(`known on master: ${n}`)
    for (const n of s.nowPasses) log(`known failure now passes, remove it from known-failures.ts: ${n}`)
    for (const n of flowProblems(s)) log(n)
    return {line: `${flowsLine(s)}${r.code === 0 ? '' : ` (playwright exited ${r.code})`}`, ok: flowsOk(s, r.code)}
  })

  await phase('render', async () => {
    // render captures need the app on the visual gate's Chromium switches; the flows run without them
    const relaunch = await runChild('relaunch --visual', 'node', node('tests/e2e/electron/launch-app.mts', '--visual'), 5 * MIN)
    launchedPgid = readAppPidfile()?.pgid
    if (relaunch.code !== 0 || launchedPgid === undefined) return {line: `launch-app.mts --visual exited ${relaunch.code}`, ok: false}
    const r = await watched('render', async () =>
      runChild('render', 'node', node('tests/e2e/visual/cli.mts', 'render', ...(only ? ['settings/*'] : [])), remainingMs())
    )
    renderDir = /^render: (.+)$/m.exec(r.stdout)?.[1]?.trim()
    const file = renderDir && path.join(renderDir, 'render.json')
    if (!file || !fs.existsSync(file)) return {line: `visual render exited ${r.code} and wrote no render.json`, ok: false}
    const t = summarizeRender((JSON.parse(fs.readFileSync(file, 'utf8')) as {entries: Array<RenderResultRow>}).entries)
    for (const n of t.fresh) log(`new render failure: ${n}`)
    for (const n of t.known) log(`known on master: ${n}`)
    for (const n of t.nowPasses) log(`known render failure now passes, remove it from known-failures.ts: ${n}`)
    return {line: `${renderLine(t)}${r.code === 0 ? '' : ` (exited ${r.code})`}`, ok: r.code === 0 && t.failed === 0}
  })

  await phase('census', async () => {
    const r = await runChild('census', 'node', node('tests/e2e/electron/census.mts', ...(renderedDir() ? ['--render', renderedDir() ?? ''] : ['--no-render'])), Math.min(5 * MIN, remainingMs()))
    const line = /^census: (routes .+)$/m.exec(r.stdout)?.[1] ?? `exited ${r.code}`
    return {line, ok: r.code === 0}
  })

  await phase('report', async () => {
    const r = await runChild('report', 'node', node('tests/e2e/generate-electron-report.mts', ...(renderedDir() ? ['--render', renderedDir() ?? ''] : [])), Math.min(5 * MIN, remainingMs()))
    if (r.code !== 0 || !fs.existsSync(out.report)) return {line: `report generator exited ${r.code}`, ok: false}
    if (!process.env['KB_E2E_NO_OPEN']) spawn('open', [out.report], {detached: true, stdio: 'ignore'}).unref()
    return {line: out.report, ok: true}
  })

  // last, over everything the run wrote: no artifact may hold a secret from the env file
  await phase('secrets', async () => {
    const scan = scanAndPurge([resultsDir], secrets.secrets())
    secrets.stop()
    for (const f of scan.hits) log(`secret found, deleted: ${f}`)
    return Promise.resolve({line: scan.line, ok: !scan.hits.length})
  })

  return endRun(releaseFailed(phases) ? 1 : 0)
}

main().catch(async (e: unknown) => endRun(1, `release crashed: ${errText(e)}`))
