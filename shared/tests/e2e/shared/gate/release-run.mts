// The plumbing of a release gate run: timed phases, children under a deadline, the release lock,
// the overall deadline and interrupts, and the summary and notification at the end. The platform's
// release command supplies what it launches and stops.
import {appendFileSync, existsSync, mkdirSync, statSync} from 'fs'
import {dirname} from 'path'
import {spawn, execFileSync, type ChildProcess} from 'child_process'
import {redactSecrets} from '../peer-service.ts'
import {acquireFileLock} from '../../visual/lock.mts'
import {fmtMs, summaryLines, writtenSince, type Phase} from './release-lib.ts'

const MIN = 60_000
const CLOSE_WAIT_MS = 2_000

export const errText = (e: unknown) => redactSecrets(e instanceof Error ? e.message : String(e))

// logError: the first failure writing opts.logFile; the child's own result is unaffected
export type ChildResult = {code: number | null; stdout: string; timedOut: boolean; logError?: string}

export type ChildOptions = {
  // stdout and stderr are also appended here as they arrive
  logFile?: string
  env?: NodeJS.ProcessEnv
  cwd?: string
}

export type ReleaseRun = {
  runStart: number
  log: (s: string) => void
  phase: (name: string, f: () => Promise<Omit<Phase, 'name' | 'ms'>>) => Promise<boolean>
  runChild: (name: string, cmd: string, args: ReadonlyArray<string>, timeoutMs: number, opts?: ChildOptions) => Promise<ChildResult>
  remainingMs: () => number
  // cleanup may add to it
  phases: Array<Phase>
  // throws naming the holder when another live run has it
  acquireLock: (holder: string) => void
  holdsLock: () => boolean
  finish: (code: number, why?: string) => Promise<void>
  // The run's own ending; an abort in progress ends it instead, with its reason and exit code.
  endRun: (code: number, why?: string) => Promise<void>
}

export type ReleaseRunOptions = {
  tag: string
  // where children run
  cwd: string
  lockPath: string
  deadlineMs: number
  notifyTitle: string
  // what the summary lists after the phase lines, by label, each marked when this run did not write it
  artifacts: () => ReadonlyArray<readonly [label: string, path: string]>
  // Runs first when the run ends, before the summary: may add phases and returns the exit code.
  cleanup?: (code: number) => Promise<number>
  notify?: (text: string) => void
  exit?: (code: number) => void
}

export const createReleaseRun = (o: ReleaseRunOptions): ReleaseRun => {
  const runStart = Date.now()
  const {deadlineMs} = o
  const exit = o.exit ?? ((code: number) => process.exit(code))
  const log = (s: string) => console.log(`${o.tag} ${s}`)
  const remainingMs = () => Math.max(0, runStart + deadlineMs - Date.now())

  const phases: Array<Phase> = []
  let currentPhase: string | undefined
  let currentChild: ChildProcess | undefined
  let finishing = false
  // set once an interrupt or the overall deadline stops the run: no further phase starts
  let aborted = false
  const isAborted = () => aborted
  // set once this run holds the release lock (released when the run finishes); until then the run touches nothing
  let holdsLock = false
  let releaseLock: (() => void) | undefined

  // Runs a child in `cwd` with its output passed through, under a deadline (SIGTERM, then SIGKILL
  // 10s later). Resolves with its exit code (null when killed) and its stdout. Once the run is aborted
  // it starts nothing and resolves at once as a child that timed out.
  const runChild = async (name: string, cmd: string, args: ReadonlyArray<string>, timeoutMs: number, opts: ChildOptions = {}) =>
    new Promise<ChildResult>(resolve => {
      if (isAborted()) {
        resolve({code: null, stdout: '', timedOut: true})
        return
      }
      const child = spawn(cmd, [...args], {cwd: opts.cwd ?? o.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe']})
      currentChild = child
      let logError: string | undefined
      const toFile = (d: Buffer) => {
        if (!opts.logFile || logError) return
        try {
          appendFileSync(opts.logFile, d)
        } catch (e) {
          logError = errText(e)
          log(`${name}: log write failed: ${logError}`)
        }
      }
      if (opts.logFile) {
        try {
          mkdirSync(dirname(opts.logFile), {recursive: true})
        } catch (e) {
          logError = errText(e)
          log(`${name}: log write failed: ${logError}`)
        }
      }
      let stdout = ''
      let timedOut = false
      let killTimer: ReturnType<typeof setTimeout> | undefined
      let closeTimer: ReturnType<typeof setTimeout> | undefined
      let done = false
      child.stdout.on('data', (d: Buffer) => {
        if (!done) stdout += d.toString()
        process.stdout.write(d)
        toFile(d)
      })
      child.stderr.on('data', (d: Buffer) => {
        process.stderr.write(d)
        toFile(d)
      })
      const timer = setTimeout(() => {
        timedOut = true
        log(`${name}: not done in ${Math.round(timeoutMs / 1000)}s; stopping it`)
        child.kill('SIGTERM')
        killTimer = setTimeout(() => child.kill('SIGKILL'), 10_000)
      }, timeoutMs)
      const settle = (r: ChildResult) => {
        if (done) return
        done = true
        clearTimeout(timer)
        clearTimeout(killTimer)
        clearTimeout(closeTimer)
        if (currentChild === child) currentChild = undefined
        resolve(r)
      }
      const result = (code: number | null, out = stdout) => ({code, stdout: out, timedOut, ...(logError ? {logError} : {})})
      child.on('close', code => settle(result(code)))
      // A grandchild that inherited the pipes (Appium, WebDriverAgent's xcodebuild) keeps them open after
      // the child exits, and 'close' only comes once it lets go: the child's exit settles it once its
      // output has had CLOSE_WAIT_MS to drain. The pipes stay open and keep passing the grandchild's
      // output through (closing them would kill it with SIGPIPE on its next write).
      child.on('exit', code => {
        closeTimer = setTimeout(() => settle(result(code)), CLOSE_WAIT_MS)
      })
      child.on('error', e => settle(result(null, `${stdout}\n${e.message}`)))
    })

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

  const acquireLock = (holder: string) => {
    releaseLock = acquireFileLock(o.lockPath, holder, 'release lock')
    holdsLock = true
  }

  // SIGTERM, then SIGKILL after 10s; resolves once the child has closed (or 2s after the SIGKILL).
  const stopChild = async (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) return
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()))
    // true once the child has closed, false after `ms`; the timer goes once either happens
    const closedWithin = async (ms: number) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<boolean>(resolve => {
        timer = setTimeout(() => resolve(false), ms)
      })
      try {
        return await Promise.race([closed.then(() => true), late])
      } finally {
        clearTimeout(timer)
      }
    }
    child.kill('SIGTERM')
    if (await closedWithin(10_000)) return
    child.kill('SIGKILL')
    await closedWithin(2_000)
  }

  const notify =
    o.notify ??
    ((text: string) => {
      try {
        execFileSync(
          'osascript',
          ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title (item 2 of argv)', '-e', 'end run', text, o.notifyTitle],
          {stdio: 'ignore', timeout: 10_000}
        )
      } catch (e) {
        log(`notification failed: ${errText(e)}`)
      }
    })

  const printResults = () => {
    for (const line of summaryLines(phases)) console.log(line)
    console.log(`total ${fmtMs(Date.now() - runStart)}, run id ${process.env['KB_E2E_RUN_ID'] ?? '(none)'}`)
    for (const [label, p] of o.artifacts()) {
      const fresh = writtenSince({path: p, ...(existsSync(p) ? {mtimeMs: statSync(p).mtimeMs} : {})}, runStart)
      console.log(`${label.padEnd(17)}${p}${fresh ? '' : ' (not written by this run)'}`)
    }
  }

  const finish = async (code: number, why?: string) => {
    if (finishing) return
    finishing = true
    // set before anything below can throw, and an error while finishing fails the run: no path out
    // of here exits 0 by accident
    process.exitCode = code
    try {
      if (o.cleanup) code = await o.cleanup(code)
      process.exitCode = code
      console.log('\n=== release summary ===')
      if (why) console.log(why)
      printResults()
      const failed = code !== 0
      notify(why ?? `${failed ? 'FAILED' : 'passed'} in ${fmtMs(Date.now() - runStart)}: ${phases.filter(p => !p.ok).map(p => p.name).join(', ') || 'all phases ok'}`)
    } catch (e) {
      if (code === 0) code = 1
      console.error(`${o.tag} finishing the run failed: ${errText(e)}`)
    } finally {
      clearTimeout(deadline)
      // after `finishing` is set, so a signal arriving during finish is still a no-op
      process.off('SIGINT', onSigint)
      process.off('SIGTERM', onSigterm)
      process.off('SIGHUP', onSighup)
      releaseLock?.()
      holdsLock = false
      exit(code)
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

  const endRun = async (code: number, why?: string) => (isAborted() ? undefined : finish(code, why))

  const onSigint = () => void abort('interrupted', 130)
  const onSigterm = () => void abort('terminated', 143)
  // the terminal or the shell that started the run went away
  const onSighup = () => void abort('hung up', 129)
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  process.on('SIGHUP', onSighup)
  const deadline = setTimeout(() => void abort(`overall deadline of ${deadlineMs / MIN} minutes (KB_E2E_RELEASE_TIMEOUT_MIN) reached`, 1), deadlineMs)

  return {
    acquireLock,
    endRun,
    finish,
    holdsLock: () => holdsLock,
    log,
    phase,
    phases,
    remainingMs,
    runChild,
    runStart,
  }
}
