// yarn test:e2e:ios:release
//
// The iOS release gate, in one command (the desktop one is ../electron/release.mts). Exits 1 on any
// failure: a flow test failed (known failures from gate/lists/known-failures.ts included), was flaky
// or was skipped, a tour entry failed to render, the census found an unclaimed route, surface or
// unsent write, an artifact held a secret from the env file, or a phase could not run.
//   1. preflight, refusing with what to do: the env file loads, this run takes the release lock
//      (/tmp/kb-e2e-release.lock, KB_E2E_RELEASE_LOCK, shared with the desktop release command, as
//      both sweep the same accounts), the host's service is on KB_SMOKE_USER (the sweep and setup run
//      through it), the simulator (KB_IOS_DEVICE, default iPhoneTest) is booted with a window open,
//      keybase.ios on it is a signed dev build, ports 8081/4723/8100 are free or hold harness residue
//      (a Metro an earlier release run left, stopped by launch; a WebDriverAgent an earlier Appium
//      session left on this simulator, stopped once every other check passes), no visual gate run
//      holds its lock, the macOS session is unlocked, KBFS answers, both peers answer (started if
//      not) and `accounts/setup --check` passes. Nothing is launched or stopped before it passes; the
//      host service is never switched, and the app is never installed
//   2. launch: Metro from this checkout (watch mode), the app relaunched on its bundle, and the app
//      checked to be on KB_SMOKE_USER
//   3. sweep what earlier runs left in the test accounts (once)
//   4. every gate flow (wdio.gate.conf.ts, project ios-flows)
//   5. the visual tour in render mode (`visual render --ios`), after the flows: render leaves the
//      simulator's Reduce Motion on until the app's next launch
//   6. census, then the report; each passes only on what its child wrote during the phase
// However it ends, once it holds the release lock: it stops the Metro and Appium it started (and the
// WebDriverAgent Appium left), leaving the simulator booted and the app running; then scans
// everything under tests/results for the env file's secrets (secrets phase; a file that holds one is
// deleted and named, and the run fails); then opens the report, when this run wrote it and the scan
// left it, unless KB_E2E_NO_OPEN=1; then prints one line per phase and posts a macOS notification.
// Children log to tests/results/ios-logs/ (setup-check, metro, flows, render, census, report, sweep;
// emptied when the run takes the lock) and get this run's KB_E2E_RUN_ID.
//
// KB_E2E_RELEASE_TIMEOUT_MIN  overall deadline (default 240)
// KB_E2E_RELEASE_ONLY=<grep>  for trying the command itself: only flows matching <grep>, and only
//                             the settings/* tour entries (the census then reports gaps)
import {spawn, spawnSync} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {childEnvVars, loadE2EEnv, peerRoles, type E2EEnv} from '../accounts/env.ts'
import {newRunId} from '../accounts/run-id.ts'
import {formatSweep, sweep} from '../accounts/sweep.mts'
import {runAbortable} from '../shared/deadline.ts'
import {ensurePeer, mainWhoami, runKeybase} from '../shared/peer-service.ts'
import {assertNotLocked} from '../visual/lock.mts'
import {sessionLocked} from '../electron/helpers/main-process.ts'
import {envSecrets, watchEnvSecrets, type SecretWatch} from '../shared/gate/secret-scan.ts'
import {createReleaseRun, errText} from '../shared/gate/release-run.mts'
import {pidAlive, stopPids} from '../electron/app-pidfile.ts'
import {
  flowProblems,
  parseTimeoutMin,
  releaseFailed,
  renderLine,
  summarizeFlows,
  summarizeRender,
  type Outcome,
  type PwReport,
  type RenderResultRow,
} from '../shared/gate/release-lib.ts'
import {portHolders, type PortHolder} from '../shared/gate/ports.ts'
import {runSync, udidForName} from './helpers/app.ts'
import {notSmokeProblem} from './gate/app-account-lib.ts'
import {IOS_KNOWN_FAILURES} from './gate/lists/known-failures.ts'
import {BUNDLE_ID, forgetMetroPidfile, METRO_PORT, processes, readMetroPidfile, recordedMetroPgid, relaunchApp, startMetro, stillMetro, stopMetro} from './launch.mts'
import {
  appSignedFromAppinfo,
  censusPhaseResult,
  flowsPhaseResult,
  iosPreflightProblems,
  isWdaResidue,
  IOS_RELEASE_PORTS,
  logFailed,
  reportPhaseResult,
  simulatorFromList,
  strayChildren,
  writtenSince,
  type IosPreflightState,
} from './release-lib.ts'
import {scanResults} from './release-secrets.mts'

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const resultsDir = path.join(sharedDir, 'tests/results')
const logsDir = path.join(resultsDir, 'ios-logs')
const out = {
  census: path.join(resultsDir, 'ios-census.md'),
  censusJson: path.join(resultsDir, 'ios-census.json'),
  checklist: path.join(resultsDir, 'ios-manual-checklist.md'),
  report: path.join(resultsDir, 'ios-report.html'),
  results: path.join(resultsDir, 'ios-report/results.json'),
}
const logFile = (name: string) => path.join(logsDir, `${name}.log`)
const project = 'ios-flows'
const APPIUM_PORT = 4723
const WDA_PORT = 8100
const MIN = 60_000

const timeout = parseTimeoutMin(process.env['KB_E2E_RELEASE_TIMEOUT_MIN'], 240)
if ('error' in timeout) {
  console.error(`[ios-release] refusing to run: ${timeout.error}`)
  process.exit(1)
}
const deadlineMs = timeout.minutes * MIN
const only = process.env['KB_E2E_RELEASE_ONLY'] || undefined
const device = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
// The gate's own runs set this to skip the lock check; this command is not one of them.
delete process.env['KB_VISUAL_RUN']

// started once preflight passed: every value the env file's secrets held from then on
let secretWatch: SecretWatch | undefined
// set when the report phase passed
let reportWritten = false

// Stops what the run started, then (so the files are final) scans what it wrote, then opens the report
// if it survived the scan. A run that never took the release lock wrote nothing, so it scans nothing.
const cleanup = async (code: number) => {
  if (!(await stopWhatItStarted()) && code === 0) code = 1
  if (!run.holdsLock()) return code
  const watch = secretWatch
  // a render dir KB_VISUAL_RESULTS put outside tests/results is scanned too
  const outside = renderDir !== undefined && path.relative(resultsDir, renderDir).startsWith('..')
  const secrets = scanResults([resultsDir, ...(outside && renderDir ? [renderDir] : [])], watch ? () => watch.secrets() : envSecrets, log)
  watch?.stop()
  phases.push(secrets)
  if (!secrets.ok && code === 0) code = 1
  // a report that held a secret is gone by now
  if (reportWritten && fs.existsSync(out.report) && !process.env['KB_E2E_NO_OPEN']) {
    spawn('open', [out.report], {detached: true, stdio: 'ignore'}).unref()
  }
  return code
}

const run = createReleaseRun({
  cleanup,
  cwd: sharedDir,
  deadlineMs,
  lockPath: process.env['KB_E2E_RELEASE_LOCK'] ?? '/tmp/kb-e2e-release.lock',
  notifyTitle: 'Keybase iOS release',
  printResults: () => printResults(),
  tag: '[ios-release]',
})
const {endRun, log, phase, phases, remainingMs, runChild, runStart} = run

let udid: string | undefined
let metroPgid: number | undefined
// set once preflight passed (4723 free, 8100 free or its residue stopped): only then does cleanup
// stop anything, and anything on those ports after that is this run's
let preflightPassed = false
let renderDir: string | undefined
// renderDir, when this run's render wrote an iOS render.json there
const renderedDir = () => {
  const file = renderDir && path.join(renderDir, 'render.json')
  if (!file || !fs.existsSync(file)) return undefined
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf8')) as {platform?: string}).platform === 'ios' ? renderDir : undefined
  } catch {
    return undefined
  }
}

const node = (script: string, ...args: Array<string>) =>
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.join(sharedDir, script), ...args]

const mtime = (p: string) => (fs.existsSync(p) ? {mtimeMs: fs.statSync(p).mtimeMs} : {})

// ---------------------------------------------------------------- processes

// Every process of the WebDriverAgent an Appium session left on this simulator (release-lib.ts isWdaResidue).
const wdaResiduePids = (id: string) =>
  processes()
    .filter(p => isWdaResidue(p.command, id))
    .map(p => p.pid)

// '' when ps fails or the process is gone
const fullCommand = (pid: number) => {
  const r = spawnSync('ps', ['-ww', '-o', 'command=', '-p', String(pid)], {encoding: 'utf8', timeout: 5_000})
  return r.error ? '' : r.stdout.trim()
}

const stopWda = async (id: string, why: string) => {
  const pids = wdaResiduePids(id)
  if (!pids.length) return true
  log(`stopping the WebDriverAgent ${why} on ${device} (pids ${pids.join(', ')})`)
  const ok = await stopPids(pids)
  if (!ok) log(`the WebDriverAgent did not stop (pids ${pids.filter(pidAlive).join(', ')})`)
  return ok
}

// What cleanup stops: what a stopped child left in the run's process group, the Metro this run
// started (or recorded), the Appium its children left on 4723, and the WebDriverAgent Appium left on
// this simulator. The simulator and the app stay up. False when something would not stop.
const stopWhatItStarted = async () => {
  // a refused run started nothing: what is on the ports, and in a pidfile, is someone else's
  if (!run.holdsLock() || !preflightPassed) return true
  let ok = true
  const strays = strayChildren(processes(), process.pid, runStart)
  if (strays.length) {
    log(`stopping what its stopped children left running (pids ${strays.join(', ')})`)
    if (!(await stopPids(strays))) {
      ok = false
      log('they did not stop')
    }
  }
  const recorded = readMetroPidfile()
  const pgids = new Set<number>()
  if (metroPgid !== undefined) pgids.add(metroPgid)
  if (recorded && recorded.start >= runStart) pgids.add(recorded.pgid)
  metroPgid = undefined
  for (const pgid of pgids) {
    if (!stillMetro(pgid)) {
      log(`process group ${pgid} it recorded for Metro is no longer a Metro; left alone`)
      forgetMetroPidfile(pgid)
      continue
    }
    log(`stopping the Metro it started (process group ${pgid}); the simulator and the app stay up`)
    try {
      await stopMetro(pgid)
    } catch (e) {
      ok = false
      log(`could not stop Metro: ${errText(e)}`)
    }
  }
  // 4723 was free when preflight passed, so an Appium on it now was started by this run's children;
  // the command check only keeps a server someone started since then out of it
  const appium = portHolders(APPIUM_PORT)
  if ('error' in appium) {
    ok = false
    log(`could not tell who holds port ${APPIUM_PORT}: ${appium.error}`)
  } else if (appium.holders.length) {
    const ours = appium.holders.filter(h => /appium/i.test(fullCommand(h.pid)))
    for (const h of appium.holders.filter(x => !ours.includes(x))) log(`port ${APPIUM_PORT} is held by pid ${h.pid} (${h.command}), not an Appium; left alone`)
    if (ours.length) {
      log(`stopping the Appium its children left on port ${APPIUM_PORT} (pids ${ours.map(h => h.pid).join(', ')})`)
      if (!(await stopPids(ours.map(h => h.pid)))) {
        ok = false
        log('Appium did not stop')
      }
    }
  }
  if (udid && !(await stopWda(udid, 'Appium left'))) ok = false
  if (!ok) phases.push({line: 'something it started would not stop (see above)', name: 'cleanup', ok: false})
  return ok
}

// ---------------------------------------------------------------- preflight

const outcome = async (p: Promise<unknown>): Promise<Outcome> =>
  p.then(
    () => ({ok: true}) as const,
    (e: unknown) => ({error: errText(e), ok: false}) as const
  )

const stderrOf = (e: unknown) => {
  const s = (e as {stderr?: string}).stderr?.trim()
  return s ? s.split('\n').slice(0, 3).join(' ') : errText(e)
}

const simulatorState = (): IosPreflightState['simulator'] => {
  try {
    udid = udidForName(device)
    const listed = simulatorFromList(runSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], 60_000), device)
    if ('error' in listed) return listed
    const windows = spawnSync('pgrep', ['-f', 'DeviceHub.app/Contents/MacOS/DeviceHub|Simulator.app/Contents/MacOS/Simulator'], {timeout: 10_000})
    return {booted: listed.booted, visible: windows.status === 0}
  } catch (e) {
    return {error: errText(e)}
  }
}

const appSignedState = (id: string): NonNullable<IosPreflightState['appSigned']> => {
  try {
    return appSignedFromAppinfo(runSync('xcrun', ['simctl', 'appinfo', id, BUNDLE_ID], 60_000))
  } catch (e) {
    return {error: stderrOf(e)}
  }
}

// A port's holders are ours when every one is harness residue: the Metro an earlier release run
// recorded (8081), or the WebDriverAgent an earlier Appium session left on this simulator (8100).
const portState = (port: number, recordedMetro: number | undefined, id: string | undefined): IosPreflightState['ports'][number] => {
  const r = portHolders(port)
  if ('error' in r) return {error: r.error, holders: [], ours: false, port}
  const residue = (h: PortHolder) =>
    (port === METRO_PORT && recordedMetro !== undefined && h.pgid === recordedMetro) ||
    (port === WDA_PORT && id !== undefined && isWdaResidue(fullCommand(h.pid), id))
  return {holders: r.holders, ours: r.holders.length > 0 && r.holders.every(residue), port}
}

const screenState = (): IosPreflightState['screen'] => {
  try {
    return {locked: sessionLocked()}
  } catch (e) {
    return {error: errText(e)}
  }
}

const preflight = async (): Promise<{env: E2EEnv; problems: Array<string>}> => {
  const env = loadE2EEnv()
  const notChecked = {booted: false, visible: false}
  try {
    run.acquireLock(`yarn test:e2e:ios:release (run ${process.env['KB_E2E_RUN_ID'] ?? '?'})`)
  } catch (e) {
    const releaseLockHeld = errText(e)
    return {env, problems: iosPreflightProblems({device, hostWhoami: {error: 'not checked', ok: false}, ports: [], releaseLockHeld, simulator: notChecked, smokeUser: env.smokeUser})}
  }
  // the logs hold this run's alone, preflight's children included
  fs.rmSync(logsDir, {force: true, recursive: true})
  fs.mkdirSync(logsDir, {recursive: true})
  const hostWhoami = await mainWhoami().then(
    user => ({ok: true, user}) as const,
    (e: unknown) => ({error: errText(e), ok: false}) as const
  )
  const simulator = simulatorState()
  const booted = !('error' in simulator) && simulator.booted
  let lockHeld: string | undefined
  try {
    assertNotLocked('the iOS release run')
  } catch (e) {
    lockHeld = errText(e)
  }
  const recordedMetro = recordedMetroPgid()
  const onSmoke = hostWhoami.ok && hostWhoami.user === env.smokeUser
  const kbfsPath = `/keybase/private/${env.smokeUser}`
  const state: IosPreflightState = {
    ...(booted && udid ? {appSigned: appSignedState(udid)} : {}),
    device,
    hostWhoami,
    ...(onSmoke ? {kbfs: {path: kbfsPath, ...(await outcome(runKeybase(['fs', 'ls', kbfsPath], {timeoutMs: 15_000})))}} : {}),
    ...(lockHeld ? {lockHeld} : {}),
    ports: IOS_RELEASE_PORTS.map(p => portState(p, recordedMetro, udid)),
    screen: screenState(),
    simulator,
    smokeUser: env.smokeUser,
  }
  // Peers are started only once nothing else stands in the way.
  if (!iosPreflightProblems(state).length) {
    const peers: Array<{role: string} & Outcome> = []
    for (const role of peerRoles) peers.push({role, ...(await outcome(ensurePeer(role, env)))})
    state.peers = peers
    const check = await runChild('setup --check', 'node', node('tests/e2e/accounts/setup.mts', '--check'), 2 * MIN, {logFile: logFile('setup-check')})
    state.setupCheck = check.code === 0 ? {ok: true} : {error: `${check.stdout || `exit ${check.code}`}${logFailed(check)}`, ok: false}
  }
  const problems = iosPreflightProblems(state)
  if (problems.length) return {env, problems}
  // Only now, with nobody else's Appium on 4723 and no visual run holding its lock, is a
  // WebDriverAgent on 8100 an earlier session's leftover rather than a live run's.
  const wdaPort = state.ports.find(p => p.port === WDA_PORT)
  if (udid && wdaPort?.ours && !(await stopWda(udid, 'an earlier Appium session left'))) {
    return {env, problems: [`the WebDriverAgent an earlier Appium session left on ${device} would not stop; stop it to free port ${WDA_PORT}`]}
  }
  preflightPassed = true
  return {env, problems}
}

// the summary's lines after the phases
const printResults = () => {
  const fresh = (p: string) => writtenSince({path: p, ...mtime(p)}, runStart)
  const show = (what: string, p: string) => console.log(`${what.padEnd(17)}${p}${fresh(p) ? '' : ' (not written by this run)'}`)
  show('report', out.report)
  show('census', out.census)
  show('manual checklist', out.checklist)
  show('flow results', out.results)
  show('logs', logsDir)
  if (renderDir) show('render', renderDir)
}

// ---------------------------------------------------------------- the run

const main = async () => {
  const runId = newRunId(runStart)
  process.env['KB_E2E_RUN_ID'] = runId
  log(`run ${runId} on ${device}${only ? `, only flows matching ${JSON.stringify(only)} and settings/* tour entries` : ''}`)

  let env: E2EEnv | undefined
  const ready = await phase('preflight', async () => {
    const r = await preflight()
    env = r.env
    if (r.problems.length) {
      console.error(`[ios-release] refusing to run:\n  - ${r.problems.join('\n  - ')}`)
      return {line: `refused: ${r.problems.length} problem(s)`, ok: false}
    }
    return {line: 'ready', ok: true}
  })
  if (!ready || !env || !udid) return endRun(1)
  const e2eEnv = env
  const id = udid
  // the scan at the end looks for every second-account password the env file held during the run
  secretWatch = watchEnvSecrets()
  // children that read the accounts from the environment alone see the ones preflight checked
  Object.assign(process.env, childEnvVars(e2eEnv), {KB_IOS_DEVICE: device})

  const launched = await phase('launch', async () => {
    const left = recordedMetroPgid()
    if (left !== undefined) {
      log(`stopping the Metro an earlier release run left (process group ${left})`)
      await stopMetro(left)
    }
    const pgid = await startMetro({
      log,
      logFile: logFile('metro'),
      onStarted: started => {
        metroPgid = started
      },
      sharedDir,
    })
    const account = await relaunchApp({device, log, udid: id})
    const problem = notSmokeProblem(account, e2eEnv.smokeUser)
    if (problem) {
      console.error(`[ios-release] ${problem}`)
      return {line: problem, ok: false}
    }
    return {line: `Metro up (process group ${pgid}), the app on KB_SMOKE_USER`, ok: true}
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
      fs.appendFileSync(logFile('sweep'), `${r.message}\n`)
      return {line: r.message, ok: false}
    }
    const text = formatSweep(r.value, e2eEnv, false)
    console.log(text)
    fs.appendFileSync(logFile('sweep'), `${text}\n`)
    return {line: `${r.value.deleted.length} deleted, ${r.value.listOnly.length} listed only, ${r.value.errors.length} errors`, ok: !r.value.errors.length}
  })
  if (sweepState.running) return endRun(1, 'the sweep did not stop after its deadline; no flow runs beside it')

  await phase('flows', async () => {
    const start = Date.now()
    const r = await runChild('flows', path.join(sharedDir, 'node_modules/.bin/wdio'), ['run', 'tests/e2e/ios-appium/wdio.gate.conf.ts'], remainingMs(), {
      env: {...process.env, KB_IOS_DEVICE: device, ...(only ? {KB_E2E_RELEASE_ONLY: only} : {})},
      logFile: logFile('flows'),
    })
    const {line, ok, summary: s} = flowsPhaseResult(r, {path: out.results, ...mtime(out.results)}, start, () =>
      summarizeFlows(JSON.parse(fs.readFileSync(out.results, 'utf8')) as PwReport, project, IOS_KNOWN_FAILURES.flows)
    )
    if (s) {
      for (const n of s.fresh) log(`new failure: ${n}`)
      for (const n of s.known) log(`known on master: ${n}`)
      for (const n of s.nowPasses) log(`known failure now passes, remove it from gate/lists/known-failures.ts: ${n}`)
      for (const n of flowProblems(s)) log(n)
    }
    return {line, ok}
  })

  await phase('render', async () => {
    const r = await runChild('render', 'node', node('tests/e2e/visual/cli.mts', 'render', '--ios', ...(only ? ['settings/*'] : [])), remainingMs(), {
      logFile: logFile('render'),
    })
    renderDir = /^render: (.+)$/m.exec(r.stdout)?.[1]?.trim()
    const file = renderDir && path.join(renderDir, 'render.json')
    if (!file || !fs.existsSync(file)) return {line: `visual render exited ${r.code} and wrote no render.json${logFailed(r)}`, ok: false}
    const t = summarizeRender((JSON.parse(fs.readFileSync(file, 'utf8')) as {entries: Array<RenderResultRow>}).entries, IOS_KNOWN_FAILURES.render)
    for (const n of t.fresh) log(`new render failure: ${n}`)
    for (const n of t.known) log(`known on master: ${n}`)
    for (const n of t.nowPasses) log(`known render failure now passes, remove it from gate/lists/known-failures.ts: ${n}`)
    const platformOk = renderedDir() !== undefined
    return {
      line: `${renderLine(t)}${r.code === 0 ? '' : ` (exited ${r.code})`}${platformOk ? '' : ' (render.json is not an iOS render)'}${logFailed(r)}`,
      ok: r.code === 0 && t.failed === 0 && platformOk && !r.logError,
    }
  })

  await phase('census', async () => {
    const start = Date.now()
    const dir = renderedDir()
    const r = await runChild('census', 'node', node('tests/e2e/ios-appium/census.mts', ...(dir ? ['--render', dir] : ['--no-render'])), Math.min(5 * MIN, remainingMs()), {
      logFile: logFile('census'),
    })
    return censusPhaseResult(r, {path: out.censusJson, ...mtime(out.censusJson)}, start)
  })

  await phase('report', async () => {
    const start = Date.now()
    const dir = renderedDir()
    const r = await runChild('report', 'node', node('tests/e2e/ios-appium/report.mts', ...(dir ? ['--render', dir] : [])), Math.min(5 * MIN, remainingMs()), {
      logFile: logFile('report'),
    })
    const p = reportPhaseResult(r, {path: out.report, ...mtime(out.report)}, start)
    reportWritten = p.ok
    return p
  })

  return endRun(releaseFailed(phases) ? 1 : 0)
}

main().catch(async (e: unknown) => endRun(1, `release crashed: ${errText(e)}`))
