// The iOS release gate's flow run: every attempt is recorded under tests/results/ios-report/attempts
// (gate/attempt.ts), and onComplete writes them as the Playwright json report the release summary
// and the census read. Every run, a direct `yarn test:e2e:ios:flows` too, then scans what it wrote
// for the env file's secrets, the names of the paper keys and the team invite links it made, and
// saltpack armor (the crypto flows): a file that holds one is deleted and named, and the run fails.
import * as fs from 'fs'
import * as path from 'path'
import {homedir} from 'os'
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'
import {escapeToTabs} from './helpers/navigate'
import {assertNotLocked} from '../visual/lock.mts'
import {attemptToken, iosReportDir, leaveBody, readAttempts, readRunErrors, requireCurrentAttempt, runAttempt} from './gate/attempt'
import {type Recorder, recorders} from './gate/recording'
import {PhoneRecording} from './gate/recorder'
import {buildPwReport} from './gate/results-lib'
import {beginErrorCapture} from './gate/errors'
import {finishAttempt, type TestResult} from './gate/finish'
import {noteProtocolResult} from './gate/hang'
import {scanHeldSecrets} from './gate/run-secrets'
import {forgetRunPaperKeyNames, SCAN_PAPER_KEY_NAMES_VAR, withPaperKeyNames} from '../accounts/paper-key-ledger'
import {
  envSecrets,
  forgetRunInviteLinks,
  runInviteLinkSecrets,
  SCAN_INVITE_LINKS_VAR,
  scanAndPurge,
  SECRET_SCAN_FILE,
  watchEnvSecrets,
  type SecretWatch,
} from '../shared/gate/secret-scan'
import {harnessSite, timed, timingOn, writeTiming} from '../shared/gate/timing.ts'
import {iosFlowProject} from './theme'
import {approveKeybaseLinks} from './helpers/sim-links.mts'
import {formFactorMismatch, readFormFactor, restartSimulator, screenshotDisplayOf} from './helpers/form-factor.mts'
import {appIsSplit, applyPosture, parseAnyPosture, postureFormFactor} from './helpers/split-view.mts'
import {sendClicksAsElementTaps, sendPointerActionsAsWindowGestures} from './gate/window-gestures.ts'
import {FIND_COMMANDS, notePresented, readsFrames, recordFrameShown, shownFind} from './gate/shown-lib.ts'

// KB_IOS_POSTURE=folded|unfolded|split-left|split-right puts an iPhone Duo in that posture before the
// run. The run's form factor (iphone, duo-folded, duo-split-left, …) is set in onPrepare and handed to
// the workers as KB_IOS_FORM_FACTOR; it names the run's project, so the report keeps each form factor's
// cards apart.
const posture = parseAnyPosture(process.env['KB_IOS_POSTURE'])
const device = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const runFormFactor = () => process.env['KB_IOS_FORM_FACTOR'] ?? 'iphone'

// The xcuitest driver is installed under ~/.appium; the appium service spawns
// its own appium process, so point it at that home or it won't find the driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const udid = process.env['KB_IOS_UDID'] ?? udidForName(process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest')

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const commandStarts: Array<{name: string; site: string; start: number}> = []
let testStart = 0

// started in onPrepare: every value the env file's secrets held during the run
let secretWatch: SecretWatch | undefined
// A run the iOS release started leaves the paper key names and invite links to the release's own
// scan, which deletes them; a direct run deletes them after its scan.
const scansOwnRecords = process.env[SCAN_PAPER_KEY_NAMES_VAR] !== '1'

const scanResults = () => {
  const watch = secretWatch
  const runId = process.env['KB_E2E_RUN_ID'] ?? ''
  const scan = scanAndPurge([iosReportDir()], [...withPaperKeyNames(watch ? watch.secrets() : envSecrets(), runId), ...runInviteLinkSecrets(runId)], {armor: true})
  watch?.stop()
  for (const f of scan.hits) console.error(`[ios gate] secret found, deleted: ${f}`)
  console.log(`[ios gate] secrets: ${scan.line}`)
  fs.mkdirSync(iosReportDir(), {recursive: true})
  fs.writeFileSync(path.join(iosReportDir(), SECRET_SCAN_FILE), JSON.stringify({line: scan.line, ok: !scan.hits.length}))
  if (scan.hits.length) throw new Error(`the secret scan deleted ${scan.hits.length} file(s) that held a secret`)
}

const writeResults = (exitCode: number) => {
  const attempts = readAttempts()
  const report = buildPwReport(attempts, iosFlowProject(runFormFactor()))
  report.errors.push(...readRunErrors())
  // a hook or worker failure leaves no failed attempt behind it
  if (exitCode !== 0 && !attempts.some(a => a.status === 'failed')) {
    report.errors.push(`wdio exited ${exitCode} with no failed test attempt`)
  }
  fs.mkdirSync(iosReportDir(), {recursive: true})
  fs.writeFileSync(path.join(iosReportDir(), 'results.json'), JSON.stringify(report, null, 2))
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  path: '/',
  specs: ['./gate.test.ts'],
  maxInstances: 1,
  capabilities: [iosCapabilities(udid)],
  logLevel: 'warn',
  // Selectors and helpers rely on $() taking the first match (e.g. `~More` matches several
  // elements), so don't throw on multiple matches.
  strictSelectors: false,
  framework: 'mocha',
  mochaOpts: {ui: 'bdd', timeout: 120000, grep: process.env['KB_E2E_RELEASE_ONLY'], retries: 1},
  reporters: ['spec'],
  services: [['appium', {args: {basePath: '/'}}]],
  onPrepare: () => {
    assertNotLocked('iOS e2e')
    // a results.json never mixes runs
    fs.rmSync(iosReportDir(), {force: true, recursive: true})
    secretWatch = watchEnvSecrets()
    approveKeybaseLinks(udid)
    // the run's form factor comes from its posture: WebDriverAgent's launch (in the worker, after
    // this) folds a Duo, so the worker applies the posture once its session is open
    const found = readFormFactor(udid)
    if (found.startsWith('duo-') && !posture) throw new Error('an iPhone Duo run needs KB_IOS_POSTURE (folded, unfolded, split-left or split-right)')
    // a Split View run starts from a restarted simulator (an earlier split leaves its pair behind)
    if (posture?.startsWith('split-')) restartSimulator(udid)
    // the workers start after this, with this env
    process.env['KB_IOS_FORM_FACTOR'] = posture ? postureFormFactor(posture) : found
    // the flows record the names of the paper keys and the invite links they make, for the scan
    process.env[SCAN_PAPER_KEY_NAMES_VAR] = '1'
    process.env[SCAN_INVITE_LINKS_VAR] = '1'
  },
  // wdio only logs a beforeTest error and runs the test anyway, so nothing here throws: what failed
  // is kept on the attempt's recorder for afterTest to report. The account was checked before this
  // (gate/hooks.ts).
  // what the app-hang watch counts: WebDriver requests that got a successful answer
  // the posture is applied here, once the session (and WebDriverAgent's launch, which folds a Duo) is
  // up; a Duo is then captured on its lit screen
  before: async () => {
    browser.on('result', (event: {command?: string; result?: unknown}) => {
      noteProtocolResult(event)
    })
    if (!posture) return
    const got = await applyPosture(udid, device, posture)
    if (got !== runFormFactor()) throw new Error(`KB_IOS_POSTURE=${posture} left the device ${got}, not ${runFormFactor()}`)
    // unfolded or split, the base screens' elements read visible=false: "shown" is read off frames
    if (got !== 'duo-folded') {
      recordFrameShown(await browser.getWindowRect())
      // and a W3C pointer there touches nothing, and an element's click misses now and then: pointer
      // actions go as window-relative gestures, clicks as taps relative to the element
      sendPointerActionsAsWindowGestures()
      sendClicksAsElementTaps()
    }
    const display = screenshotDisplayOf(udid)
    if (display !== undefined) process.env['KB_IOS_SCREEN'] = `${udid}:${display}`
  },
  // timing (shared/gate/timing.ts): each WebDriver command, its end paired with the latest start of
  // the same name (commands nest, and a Promise.all runs several at once)
  // On a run that reads "shown" off frames, each find first reads whether a modal is up (for
  // transformRequest's shownFind); finds that start together share one read, and that read's own find
  // is not read for (notePresented).
  beforeCommand: async (name: string) => {
    if (timingOn()) commandStarts.push({name, site: harnessSite(), start: Date.now()})
    if (readsFrames() && FIND_COMMANDS.includes(name)) await notePresented()
  },
  afterCommand: (name: string) => {
    if (!timingOn()) return
    const i = commandStarts.findLastIndex(c => c.name === name)
    if (i < 0) return
    const [c] = commandStarts.splice(i, 1)
    writeTiming({end: Date.now(), kind: 'command', name, site: c!.site, start: c!.start})
  },
  beforeTest: async () => {
    testStart = Date.now()
    const rec: Recorder = {}
    recorders.set(attemptToken(), rec)
    // only a Duo can change form factor mid-run: its hinge (an Appium session's launch can move it), or
    // (split) an app relaunch ends Split View. It is put back once; one still moved fails the attempt.
    if (runFormFactor().startsWith('duo-')) {
      const moved = async () =>
        formFactorMismatch(runFormFactor(), readFormFactor(udid)) ??
        (runFormFactor().startsWith('duo-split-') && !(await appIsSplit(device))
          ? `the app left Split View during the run (an app relaunch ends it); this run is ${runFormFactor()}`
          : undefined)
      try {
        let why = await moved()
        if (why && posture) {
          await applyPosture(udid, device, posture)
          why = await moved()
        }
        if (why) rec.error = why
      } catch (e) {
        rec.error = `reading or restoring the device's form factor: ${message(e)}`
      }
    }
    await escapeToTabs().catch((e: unknown) => {
      rec.error = `resetting to the tab root: ${message(e)}`
    })
    await beginErrorCapture().catch((e: unknown) => {
      rec.captureError = `starting the error capture: ${message(e)}`
    })
    const r = new PhoneRecording()
    await timed('command', 'gate: beforeTest, the recording begun', async () => r.begin()).then(
      () => {
        rec.recording = r
      },
      (e: unknown) => {
        rec.error ??= `starting the recorder: ${message(e)}`
      }
    )
  },
  // Tests deliberately END on the state they capture (often an open modal), so park the app back at
  // the tab root when the session closes. Then the secrets a flow handed the app that only the worker
  // knows are looked for in what the run wrote.
  after: async () => {
    await escapeToTabs().catch(() => {})
    for (const f of scanHeldSecrets()) console.error(`[ios gate] one-time secret found, deleted: ${f}`)
  },
  // The body may still be running (wdio's timer gave up on it): it is stopped first, and the failure
  // capture runs as a hook, bound to the attempt but to no body.
  afterTest: async (test, _context, result: TestResult) => {
    const token = leaveBody()
    await timed('command', 'gate: afterTest, the attempt finished', async () => runAttempt(token, async () => finishAttempt(result)))
    writeTiming({end: Date.now(), kind: 'test', name: [test.parent, test.title].filter(Boolean).join(' > '), start: testStart, status: result.passed ? 'passed' : 'failed'})
  },
  // Every wdio command (browser or element) builds its WebDriver request here once, in its caller's async
  // context, before sending it: a test body that is over is refused here. A request already sent, its
  // connection retries included, still completes.
  // On a run that reads "shown" off frames, a find that asks for `visible == 1` is sent as shownFind
  // reads it (gate/shown-lib.ts).
  transformRequest: requestOptions => {
    requireCurrentAttempt()
    if (!readsFrames() || typeof requestOptions.body !== 'string' || !requestOptions.body.includes('visible == 1')) return requestOptions
    const body = JSON.parse(requestOptions.body) as Record<string, unknown>
    if (typeof body['using'] !== 'string' || typeof body['value'] !== 'string') return requestOptions
    return {...requestOptions, body: JSON.stringify({...body, ...shownFind(body['using'], body['value'])})}
  },
  onComplete: (exitCode: number) => {
    try {
      writeResults(exitCode)
    } finally {
      try {
        scanResults()
      } finally {
        if (scansOwnRecords) {
          forgetRunPaperKeyNames(process.env['KB_E2E_RUN_ID'] ?? '')
          forgetRunInviteLinks(process.env['KB_E2E_RUN_ID'] ?? '')
        }
      }
    }
  },
}
