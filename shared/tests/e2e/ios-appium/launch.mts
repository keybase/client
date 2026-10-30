// The iOS release run's Metro and app launch. Metro is started from the checkout under test (yarn
// rn:start, watch mode, in its own process group so a Ctrl-C in the terminal reaches only the release
// command), its output to a log the run scans for secrets, and its group recorded in a pidfile so a
// later run can tell it from anyone else's Metro. The app is relaunched so it loads that bundle.
import {spawn} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {groupAlive, stopAppGroup} from '../electron/app-pidfile.ts'
import {evalInPage, inspectorPageFor} from '../shared/metro-eval.ts'
import {assertServedFrom} from '../visual/served-tree.mts'
import {runSync} from './helpers/app.ts'
import {APP_ACCOUNT_BODY, type AppAccount} from './gate/app-account-lib.ts'

export const BUNDLE_ID = 'keybase.ios'
export const METRO_PORT = 8081
const METRO_PIDFILE = '/tmp/kb-e2e/ios-metro.json'
// Metro always starts with --clear, so its first bundle is slow: the app gets longer to connect.
const METRO_UP_MS = 3 * 60_000
const APP_UP_MS = 5 * 60_000

type MetroPidfile = {pgid: number; start: number}

export const readMetroPidfile = (): MetroPidfile | undefined => {
  try {
    const v = JSON.parse(fs.readFileSync(METRO_PIDFILE, 'utf8')) as Partial<MetroPidfile>
    return typeof v.pgid === 'number' && v.pgid > 1 ? {pgid: v.pgid, start: v.start ?? 0} : undefined
  } catch {
    return undefined
  }
}

// The Metro group an earlier release run recorded and that is still running, if any.
export const recordedMetroPgid = () => {
  const r = readMetroPidfile()
  return r && groupAlive(r.pgid) ? r.pgid : undefined
}

export const stopMetro = async (pgid: number) => {
  await stopAppGroup(pgid)
  if (readMetroPidfile()?.pgid === pgid) fs.rmSync(METRO_PIDFILE, {force: true})
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const until = async <T,>(what: string, ms: number, f: () => Promise<T | undefined>, last: () => string = () => '') => {
  const end = Date.now() + ms
  for (;;) {
    const v = await f()
    if (v !== undefined) return v
    if (Date.now() > end) throw new Error(`timed out after ${Math.round(ms / 1000)}s waiting for ${what}${last() ? ` (last: ${last()})` : ''}`)
    await sleep(1_000)
  }
}

const metroRunning = async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${METRO_PORT}/status`, {signal: AbortSignal.timeout(2_000)})
    return (await res.text()).includes('packager-status:running')
  } catch {
    return false
  }
}

// Starts Metro from `sharedDir` with its output truncated into `logFile`, records its group, and
// waits for it to answer. Returns the group id; `onStarted` gets it as soon as it exists, so an
// interrupt during the wait still stops it.
export const startMetro = async (o: {sharedDir: string; logFile: string; log: (s: string) => void; onStarted: (pgid: number) => void}) => {
  fs.mkdirSync(path.dirname(o.logFile), {recursive: true})
  const out = fs.openSync(o.logFile, 'w')
  // watch mode: CI=1 turns Metro's file watching off
  const env = {...process.env}
  delete env['CI']
  const child = spawn('yarn', ['rn:start'], {cwd: o.sharedDir, detached: true, env, stdio: ['ignore', out, out]})
  child.unref()
  fs.closeSync(out)
  const pgid = child.pid
  if (pgid === undefined) throw new Error('yarn rn:start did not start')
  fs.mkdirSync(path.dirname(METRO_PIDFILE), {recursive: true})
  fs.writeFileSync(METRO_PIDFILE, JSON.stringify({pgid, start: Date.now()} satisfies MetroPidfile))
  o.onStarted(pgid)
  o.log(`Metro: started from ${o.sharedDir} (process group ${pgid}), log ${o.logFile}`)
  await until(`Metro on port ${METRO_PORT}`, METRO_UP_MS, async () => {
    if (!groupAlive(pgid)) throw new Error(`Metro exited before answering; see ${o.logFile}`)
    return (await metroRunning()) ? true : undefined
  })
  assertServedFrom(METRO_PORT, o.sharedDir, 'Metro')
  return pgid
}

// Terminates and relaunches the app so it loads the bundle this run's Metro serves, then waits for
// its JS runtime to say who it is signed in as.
export const relaunchApp = async (o: {device: string; udid: string; log: (s: string) => void}): Promise<AppAccount> => {
  try {
    runSync('xcrun', ['simctl', 'terminate', o.udid, BUNDLE_ID], 30_000)
  } catch {}
  runSync('xcrun', ['simctl', 'launch', o.udid, BUNDLE_ID], 60_000)
  o.log(`relaunched ${BUNDLE_ID} on ${o.device}; waiting for its bundle`)
  let last = ''
  return until(
    'the app to load its bundle and report its account',
    APP_UP_MS,
    async () => {
      try {
        const a = await evalInPage<AppAccount>(await inspectorPageFor(o.device, BUNDLE_ID), APP_ACCOUNT_BODY)
        last = a.switching ? 'switching accounts' : ''
        return a.switching ? undefined : a
      } catch (e) {
        last = e instanceof Error ? e.message : String(e)
        return undefined
      }
    },
    () => last
  )
}
