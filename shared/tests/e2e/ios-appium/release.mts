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
// WebDriverAgent Appium left), leaving the simulator booted and the app running; then, even when
// stopping failed, scans everything under tests/results (and the visual render root when
// KB_VISUAL_RESULTS puts it elsewhere; only ios-logs/ when preflight refused the run) for the env
// file's secrets and the ones its flows record (paper key names, team invite links) (secrets phase;
// a file that holds one is deleted and named, and the run fails); then
// opens the report, when this run wrote it and the scan left it, unless KB_E2E_NO_OPEN=1; then prints
// one line per phase and posts a macOS notification.
// Children log to tests/results/ios-logs/ (setup-check, metro, flows, render, census, report, sweep;
// emptied when the run takes the lock) and get this run's KB_E2E_RUN_ID.
//
// KB_E2E_RELEASE_TIMEOUT_MIN  overall deadline (default 275)
// KB_E2E_RELEASE_ONLY=<grep>  for trying the command itself: only flows matching <grep>, and only
//                             the settings/* tour entries (the census then reports gaps)
// KB_E2E_THEME=dark           the flows with the simulator in dark appearance (theme.ts), as the
//                             report's "dark" cards. The render and census are light only, so they
//                             are skipped
import {spawn, spawnSync} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {childEnvVars, loadE2EEnv, peerRoles, type E2EEnv} from '../accounts/env.ts'
import {forgetRunPaperKeyNames, SCAN_PAPER_KEY_NAMES_VAR, withPaperKeyNames} from '../accounts/paper-key-ledger.ts'
import {newRunId} from '../accounts/run-id.ts'
import {ensurePeer, mainWhoami, runKeybase} from '../shared/peer-service.ts'
import {assertNotLocked} from '../visual/lock.mts'
import {resultsDir as visualResultsDir} from '../visual/store.mts'
import {
  desktopFlowOutputs,
  envSecrets,
  forgetRunInviteLinks,
  runInviteLinkSecrets,
  SCAN_INVITE_LINKS_VAR,
  watchEnvSecrets,
  type SecretWatch,
} from '../shared/gate/secret-scan.ts'
import {createReleaseRun, errText} from '../shared/gate/release-run.mts'
import {pidAlive, stopPids} from '../shared/gate/processes.ts'
import {logTally, nodeArgs, outcome, preflightPhase, releaseSettings, screenState, sweepPhase} from '../shared/gate/release-phases.mts'
import {
  censusPhaseResult,
  flowProblems,
  flowsPhaseResult,
  logFailed,
  reportPhaseResult,
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
import {
  appHasPushPermission,
  appLocationPermission,
  appDrawsDark,
  appPendingOutbox,
  BUNDLE_ID,
  forgetMetroPidfile,
  goLogMarkFor,
  METRO_PORT,
  metroGroups,
  processes,
  readMetroPidfile,
  recordedMetroPgid,
  relaunchApp,
  startMetro,
  stopMetro,
} from './launch.mts'
import {
  appSignedFromAppinfo,
  iosPreflightProblems,
  isWdaResidue,
  IOS_RELEASE_PORTS,
  locationStartProblem,
  pushPermissionProblem,
  themeProblem,
  secretScanDirs,
  simulatorFromList,
  strayChildren,
  type IosPreflightState,
} from './release-lib.ts'
import {pendingOutboxProblem} from './gate/outbox-lib.ts'
import {scanResults, stopThenScan} from './release-secrets.mts'
import {iosFlowProject, iosTheme, type IosTheme} from './theme.ts'

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
// where the render writes its runs (KB_VISUAL_RESULTS may put it outside tests/results)
const renderRoot = path.join(visualResultsDir(), 'render')
const logFile = (name: string) => path.join(logsDir, `${name}.log`)
const project = iosFlowProject()
const theme = iosTheme()
const dark = theme === 'dark'
const APPIUM_PORT = 4723
const WDA_PORT = 8100
const MIN = 60_000

const {deadlineMs, lockPath} = releaseSettings('[ios-release]', 275)
const only = process.env['KB_E2E_RELEASE_ONLY'] || undefined
const device = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'

// started once preflight passed: every value the env file's secrets held from then on
let secretWatch: SecretWatch | undefined
// set when the report phase passed
let reportWritten = false

// Stops what the run started, then (so the files are final, and even when stopping threw) scans what
// it wrote, then opens the report if it survived the scan. A run that never took the release lock wrote
// nothing, so it scans nothing; one refused at preflight scans only its logs (release-lib.ts
// secretScanDirs).
const cleanup = async (code: number) => {
  const watch = secretWatch
  const {secrets, stopped} = await stopThenScan(
    stopWhatItStarted,
    () =>
      run.holdsLock()
        ? scanResults(
            secretScanDirs({logsDir, preflightPassed, renderRoot, resultsDir}),
            // and the device names of the paper keys this run made and of the env file's own (each is
            // the first two words of its phrase), and the team invite links this run made
            () => {
              const runId = process.env['KB_E2E_RUN_ID'] ?? ''
              return [...withPaperKeyNames(watch ? watch.secrets() : envSecrets(), runId), ...runInviteLinkSecrets(runId)]
            },
            log,
            // the desktop gate's files: its own scan covers them, and their saltpack is its crypto flows' test text
            desktopFlowOutputs(resultsDir)
          )
        : undefined,
    log
  )
  watch?.stop()
  try {
    forgetRunPaperKeyNames(process.env['KB_E2E_RUN_ID'] ?? '')
  } catch (e) {
    log(`could not forget this run's paper key names: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    forgetRunInviteLinks(process.env['KB_E2E_RUN_ID'] ?? '')
  } catch (e) {
    log(`could not forget this run's invite links: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!stopped) {
    phases.push({line: 'something it started would not stop (see above)', name: 'cleanup', ok: false})
    if (code === 0) code = 1
  }
  if (secrets) {
    phases.push(secrets)
    if (!secrets.ok && code === 0) code = 1
  }
  // a report that held a secret is gone by now
  if (reportWritten && fs.existsSync(out.report) && !process.env['KB_E2E_NO_OPEN']) {
    spawn('open', [out.report], {detached: true, stdio: 'ignore'}).unref()
  }
  return code
}

const run = createReleaseRun({
  artifacts: () => [
    ['report', out.report],
    ['census', out.census],
    ['manual checklist', out.checklist],
    ['flow results', out.results],
    ['logs', logsDir],
    ...(renderDir ? [['render', renderDir] as const] : []),
  ],
  cleanup,
  cwd: sharedDir,
  deadlineMs,
  lockPath,
  notifyTitle: 'Keybase iOS release',
  tag: '[ios-release]',
})
const {endRun, log, phase, phases, remainingMs, runChild, runStart} = run

let udid: string | undefined
let metroPgid: number | undefined
// set once preflight passed (4723 free, 8100 free or its residue stopped): only then does cleanup
// stop anything, and anything on those ports after that is this run's
let preflightPassed = false
let renderDir: string | undefined
// the simulator's appearance before the launch set the run's, put back by cleanup (light or dark
// only: simctl answers "unsupported" for a runtime without the setting, and cannot set that back)
let originalAppearance: IosTheme | undefined
// renderDir, once this run's render wrote an iOS render.json there
let iosRenderDir: string | undefined

const node = nodeArgs(sharedDir)

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
  const isMetro = pgids.size ? metroGroups() : () => false
  for (const pgid of pgids) {
    if (!isMetro(pgid)) {
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
  if (udid && originalAppearance) {
    try {
      runSync('xcrun', ['simctl', 'ui', udid, 'appearance', originalAppearance], 60_000)
    } catch (e) {
      ok = false
      log(`could not put the simulator's appearance back to ${originalAppearance}: ${errText(e)}`)
    }
  }
  return ok
}

// ---------------------------------------------------------------- preflight

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

const preflight = async (): Promise<{env: E2EEnv; problems: Array<string>}> => {
  const env = loadE2EEnv()
  const notChecked = {booted: false, visible: false}
  try {
    run.acquireLock(`yarn test:e2e:ios:release (run ${process.env['KB_E2E_RUN_ID'] ?? '?'})`)
  } catch (e) {
    const releaseLockHeld = errText(e)
    return {env, problems: iosPreflightProblems({device, hostWhoami: {error: 'not checked', ok: false}, ports: [], releaseLockHeld, simulator: notChecked, secondUser: env.secondUser, smokeUser: env.smokeUser})}
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
    secondUser: env.secondUser, smokeUser: env.smokeUser,
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

// ---------------------------------------------------------------- the run

const main = async () => {
  const runId = newRunId(runStart)
  process.env['KB_E2E_RUN_ID'] = runId
  // the flows it starts record the names of the paper keys they make, for its secret scan
  process.env[SCAN_PAPER_KEY_NAMES_VAR] = '1'
  // and the team invite links they make
  process.env[SCAN_INVITE_LINKS_VAR] = '1'
  log(`run ${runId} on ${device}${only ? `, only flows matching ${JSON.stringify(only)} and settings/* tour entries` : ''}`)

  const e2eEnv = await preflightPhase(run, '[ios-release]', preflight)
  if (!e2eEnv || !udid) return endRun(1)
  const id = udid
  // the scan at the end looks for every second-account password the env file held during the run
  secretWatch = watchEnvSecrets()
  // children that read the accounts from the environment alone see the ones preflight checked
  // KB_IOS_UDID: what changes the phone beyond the app (gate/device.ts) runs only against the
  // simulator preflight proved booted
  Object.assign(process.env, childEnvVars(e2eEnv), {KB_IOS_DEVICE: device, KB_IOS_UDID: id})

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
    // the app reads the appearance when it starts, so it is set before the relaunch
    if (!originalAppearance) {
      const was = runSync('xcrun', ['simctl', 'ui', id, 'appearance'], 60_000).trim()
      if (was === 'light' || was === 'dark') originalAppearance = was
    }
    runSync('xcrun', ['simctl', 'ui', id, 'appearance', theme], 60_000)
    const goLogMark = goLogMarkFor(id)
    const launchedAt = Date.now()
    const account = await relaunchApp({device, log, udid: id})
    const problem =
      notSmokeProblem(account, e2eEnv) ??
      pushPermissionProblem(await appHasPushPermission(device), device) ??
      locationStartProblem(await appLocationPermission(device), device, id) ??
      pendingOutboxProblem(await appPendingOutbox(goLogMark, launchedAt), device) ??
      themeProblem(await appDrawsDark(device, dark), theme, device)
    if (problem) {
      console.error(`[ios-release] ${problem}`)
      return {line: problem, ok: false}
    }
    return {line: `Metro up (process group ${pgid}), the app on KB_SMOKE_USER`, ok: true}
  })
  if (!launched) return endRun(1)

  if (await sweepPhase(run, e2eEnv, runId, {logFile: logFile('sweep')})) return endRun(1, 'the sweep did not stop after its deadline; no flow runs beside it')

  // every flow ran to its end (no KB_E2E_RELEASE_ONLY, wdio not stopped at the deadline), so the
  // report may drop the cards of tests the suite no longer has
  let flowsFull = false
  await phase('flows', async () => {
    const start = Date.now()
    const r = await runChild('flows', path.join(sharedDir, 'node_modules/.bin/wdio'), ['run', 'tests/e2e/ios-appium/wdio.gate.conf.ts'], remainingMs(), {
      env: {...process.env, KB_IOS_DEVICE: device, ...(only ? {KB_E2E_RELEASE_ONLY: only} : {})},
      logFile: logFile('flows'),
    })
    // only a clean exit: wdio also exits 1 when the app or session dies, and its results then hold
    // only the tests that started
    flowsFull = !only && r.code === 0
    const summarize = () => summarizeFlows(JSON.parse(fs.readFileSync(out.results, 'utf8')) as PwReport, project, IOS_KNOWN_FAILURES.flows)
    const {line, ok, summary: s} = flowsPhaseResult(r, {path: out.results, ...mtime(out.results)}, start, summarize)
    if (s) {
      logTally(log, s, {listFile: 'gate/lists/known-failures.ts'})
      for (const n of flowProblems(s)) log(n)
    }
    return {line, ok}
  })

  await phase('render', async () => {
    if (dark) return {line: 'skipped: the visual tour renders light only', ok: true}
    const r = await runChild('render', 'node', node('tests/e2e/visual/cli.mts', 'render', '--ios', ...(only ? ['settings/*'] : [])), remainingMs(), {
      logFile: logFile('render'),
    })
    renderDir = /^render: (.+)$/m.exec(r.stdout)?.[1]?.trim()
    const file = renderDir && path.join(renderDir, 'render.json')
    if (!file || !fs.existsSync(file)) return {line: `visual render exited ${r.code} and wrote no render.json${logFailed(r)}`, ok: false}
    const rendered = JSON.parse(fs.readFileSync(file, 'utf8')) as {entries: Array<RenderResultRow>; platform?: string}
    const platformOk = rendered.platform === 'ios'
    if (platformOk) iosRenderDir = renderDir
    const t = summarizeRender(rendered.entries, IOS_KNOWN_FAILURES.render)
    logTally(log, t, {kind: 'render', listFile: 'gate/lists/known-failures.ts'})
    return {
      line: `${renderLine(t)}${r.code === 0 ? '' : ` (exited ${r.code})`}${platformOk ? '' : ' (render.json is not an iOS render)'}${logFailed(r)}`,
      ok: r.code === 0 && t.failed === 0 && platformOk && !r.logError,
    }
  })

  await phase('census', async () => {
    if (dark) return {line: 'skipped: it reads the light flows and render', ok: true}
    const start = Date.now()
    const dir = iosRenderDir
    const r = await runChild('census', 'node', node('tests/e2e/ios-appium/census.mts', ...(dir ? ['--render', dir] : ['--no-render'])), Math.min(5 * MIN, remainingMs()), {
      logFile: logFile('census'),
    })
    return censusPhaseResult(r, {path: out.censusJson, ...mtime(out.censusJson)}, start)
  })

  await phase('report', async () => {
    const start = Date.now()
    const dir = iosRenderDir
    const r = await runChild('report', 'node', node('tests/e2e/ios-appium/report.mts', ...(dir ? ['--render', dir] : []), ...(flowsFull ? ['--prune'] : [])), Math.min(5 * MIN, remainingMs()), {
      logFile: logFile('report'),
    })
    const p = reportPhaseResult(r, {path: out.report, ...mtime(out.report)}, start)
    reportWritten = p.ok
    return p
  })

  return endRun(releaseFailed(phases) ? 1 : 0)
}

main().catch(async (e: unknown) => endRun(1, `release crashed: ${errText(e)}`))
