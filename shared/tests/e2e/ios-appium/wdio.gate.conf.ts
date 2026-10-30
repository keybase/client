// The iOS release gate's flow run: every attempt is recorded under tests/results/ios-report/attempts
// (gate/attempt.ts), and onComplete writes them as the Playwright json report the release summary
// and the census read. Every run, a direct `yarn test:e2e:ios:flows` too, then scans what it wrote
// for the env file's secrets and the names of the paper keys it made: a file that holds one is
// deleted and named, and the run fails.
import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {escapeToTabs} from './helpers/navigate'
import {attemptToken, iosReportDir, leaveBody, readAttempts, readRunErrors, requireCurrentAttempt, runAttempt} from './gate/attempt'
import {type Recorder, recorders} from './gate/recording'
import {PhoneRecording} from './gate/recorder'
import {buildPwReport} from './gate/results-lib'
import {beginErrorCapture} from './gate/errors'
import {finishAttempt, type TestResult} from './gate/finish'
import {noteProtocolResult} from './gate/hang'
import {scanHeldSecrets} from './gate/run-secrets'
import {forgetRunPaperKeyNames, SCAN_PAPER_KEY_NAMES_VAR, withPaperKeyNames} from '../accounts/paper-key-ledger'
import {envSecrets, scanAndPurge, SECRET_SCAN_FILE, watchEnvSecrets, type SecretWatch} from '../shared/gate/secret-scan'

const PROJECT = 'ios-flows'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// started in onPrepare: every value the env file's secrets held during the run
let secretWatch: SecretWatch | undefined
// A run the iOS release started leaves the paper key names to the release's own scan, which deletes
// them; a direct run deletes them after its scan.
const scansOwnNames = process.env[SCAN_PAPER_KEY_NAMES_VAR] !== '1'

const scanResults = () => {
  const watch = secretWatch
  const scan = scanAndPurge([iosReportDir()], withPaperKeyNames(watch ? watch.secrets() : envSecrets(), process.env['KB_E2E_RUN_ID'] ?? ''))
  watch?.stop()
  for (const f of scan.hits) console.error(`[ios gate] secret found, deleted: ${f}`)
  console.log(`[ios gate] secrets: ${scan.line}`)
  fs.mkdirSync(iosReportDir(), {recursive: true})
  fs.writeFileSync(path.join(iosReportDir(), SECRET_SCAN_FILE), JSON.stringify({line: scan.line, ok: !scan.hits.length}))
  if (scan.hits.length) throw new Error(`the secret scan deleted ${scan.hits.length} file(s) that held a secret`)
}

const writeResults = (exitCode: number) => {
  const attempts = readAttempts()
  const report = buildPwReport(attempts, PROJECT)
  report.errors.push(...readRunErrors())
  // a hook or worker failure leaves no failed attempt behind it
  if (exitCode !== 0 && !attempts.some(a => a.status === 'failed')) {
    report.errors.push(`wdio exited ${exitCode} with no failed test attempt`)
  }
  fs.mkdirSync(iosReportDir(), {recursive: true})
  fs.writeFileSync(path.join(iosReportDir(), 'results.json'), JSON.stringify(report, null, 2))
}

export const config: WebdriverIO.Config = {
  ...base,
  specs: ['./gate.test.ts'],
  mochaOpts: {...base.mochaOpts, grep: process.env['KB_E2E_RELEASE_ONLY'], retries: 1},
  // a results.json never mixes runs
  onPrepare: [
    ...[base.onPrepare ?? []].flat(),
    () => {
      fs.rmSync(iosReportDir(), {force: true, recursive: true})
      secretWatch = watchEnvSecrets()
      // the flows record the names of the paper keys they make, for the scan
      process.env[SCAN_PAPER_KEY_NAMES_VAR] = '1'
    },
  ],
  // wdio only logs a beforeTest error and runs the test anyway, so nothing here throws: what failed
  // is kept on the attempt's recorder for afterTest to report. The account was checked before this
  // (gate/hooks.ts).
  before: [
    ...[base.before ?? []].flat(),
    // what the app-hang watch counts: WebDriver requests that got a successful answer
    () => {
      browser.on('result', (event: {result?: unknown}) => {
        noteProtocolResult(event.result)
      })
    },
  ],
  // the secrets a flow handed the app that only the worker knows
  after: [
    ...[base.after ?? []].flat(),
    () => {
      for (const f of scanHeldSecrets()) console.error(`[ios gate] one-time secret found, deleted: ${f}`)
    },
  ],
  beforeTest: async () => {
    const rec: Recorder = {}
    recorders.set(attemptToken(), rec)
    await escapeToTabs().catch((e: unknown) => {
      rec.error = `resetting to the tab root: ${message(e)}`
    })
    await beginErrorCapture().catch((e: unknown) => {
      rec.captureError = `starting the error capture: ${message(e)}`
    })
    const r = new PhoneRecording()
    await r.begin().then(
      () => {
        rec.recording = r
      },
      (e: unknown) => {
        rec.error ??= `starting the recorder: ${message(e)}`
      }
    )
  },
  // The body may still be running (wdio's timer gave up on it): it is stopped first, and the failure
  // capture runs as a hook, bound to the attempt but to no body.
  afterTest: async (_test, _context, result: TestResult) => {
    const token = leaveBody()
    await runAttempt(token, async () => finishAttempt(result))
  },
  // Every wdio command (browser or element) builds its WebDriver request here once, in its caller's async
  // context, before sending it: a test body that is over is refused here. A request already sent, its
  // connection retries included, still completes.
  transformRequest: requestOptions => {
    requireCurrentAttempt()
    return requestOptions
  },
  onComplete: (exitCode: number) => {
    try {
      writeResults(exitCode)
    } finally {
      try {
        scanResults()
      } finally {
        if (scansOwnNames) forgetRunPaperKeyNames(process.env['KB_E2E_RUN_ID'] ?? '')
      }
    }
  },
}
