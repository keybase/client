// The plumbing of a release gate run: timed phases, children under a deadline, the release lock,
// the overall deadline and interrupts, and the summary and notification at the end. The platform's
// release command supplies what it launches and stops.
import {spawn, execFileSync, type ChildProcess} from 'child_process'
import {redactSecrets} from '../peer-service.ts'
import {acquireFileLock} from '../../visual/lock.mts'
import {fmtMs, summaryLines, type Phase} from './release-lib.ts'

const MIN = 60_000

export const errText = (e: unknown) => redactSecrets(e instanceof Error ? e.message : String(e))

export type ChildResult = {code: number | null; stdout: string; timedOut: boolean}

export type ReleaseRun = {
  runStart: number
  log: (s: string) => void
  phase: (name: string, f: () => Promise<Omit<Phase, 'name' | 'ms'>>) => Promise<boolean>
  runChild: (name: string, cmd: string, args: ReadonlyArray<string>, timeoutMs: number) => Promise<ChildResult>
  remainingMs: () => number
  isAborted: () => boolean
  // cleanup may add to it
  phases: Array<Phase>
  // throws naming the holder when another live run has it
  acquireLock: (holder: string) => void
  holdsLock: () => boolean
  notify: (text: string) => void
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
  // what the summary shows after the phase lines
  printResults: () => void
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
  // set once this run holds the release lock (released on exit); until then the run touches nothing
  let holdsLock = false

  // Runs a child in `cwd` with its output passed through, under a deadline (SIGTERM, then SIGKILL
  // 10s later). Resolves with its exit code (null when killed) and its stdout.
  const runChild = async (name: string, cmd: string, args: ReadonlyArray<string>, timeoutMs: number) =>
    new Promise<ChildResult>(resolve => {
      const child = spawn(cmd, [...args], {cwd: o.cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe']})
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
    acquireFileLock(o.lockPath, holder, 'release lock')
    holdsLock = true
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
    o.printResults()
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

  process.on('SIGINT', () => void abort('interrupted', 130))
  process.on('SIGTERM', () => void abort('terminated', 143))
  // the terminal or the shell that started the run went away
  process.on('SIGHUP', () => void abort('hung up', 129))
  const deadline = setTimeout(() => void abort(`overall deadline of ${deadlineMs / MIN} minutes (KB_E2E_RELEASE_TIMEOUT_MIN) reached`, 1), deadlineMs)

  return {
    acquireLock,
    endRun,
    finish,
    holdsLock: () => holdsLock,
    isAborted,
    log,
    notify,
    phase,
    phases,
    remainingMs,
    runChild,
    runStart,
  }
}
