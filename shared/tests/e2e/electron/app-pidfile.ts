// The dev app launch-app.mts started: it spawns `yarn desktop:start:hot:e2e` detached, so that
// yarn process leads a process group holding the dev server and Electron. The group id is written
// here, so the release command can tell its own app on ports 4000/9222 from anyone else's.
import * as fs from 'fs'
import * as path from 'path'

export const APP_PIDFILE = '/tmp/kb-e2e/app.json'

export type AppPidfile = {pgid: number; start: number}

export const writeAppPidfile = (pgid: number) => {
  const file = APP_PIDFILE
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, JSON.stringify({pgid, start: Date.now()} satisfies AppPidfile))
}

export const readAppPidfile = (): AppPidfile | undefined => {
  try {
    const v = JSON.parse(fs.readFileSync(APP_PIDFILE, 'utf8')) as Partial<AppPidfile>
    return typeof v.pgid === 'number' && v.pgid > 1 ? {pgid: v.pgid, start: v.start ?? 0} : undefined
  } catch {
    return undefined
  }
}

export const removeAppPidfile = () => fs.rmSync(APP_PIDFILE, {force: true})

// EPERM: the group exists, owned by someone this process may not signal
export const groupAlive = (pgid: number) => {
  try {
    process.kill(-pgid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// EPERM: the process exists, owned by someone this process may not signal
export const pidAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// SIGTERM, then SIGKILL after 10s; true once `running` says they are gone.
const terminate = async (signal: (sig: NodeJS.Signals) => void, running: () => boolean) => {
  signal('SIGTERM')
  for (let waited = 0; waited < 10_000 && running(); waited += 250) await sleep(250)
  if (running()) signal('SIGKILL')
  for (let waited = 0; waited < 5_000 && running(); waited += 250) await sleep(250)
  return !running()
}

// Stops every process of the list (SIGTERM, then SIGKILL after 10s); true once all are gone.
export const stopPids = async (pids: ReadonlyArray<number>) =>
  terminate(
    sig => {
      for (const pid of pids) {
        try {
          process.kill(pid, sig)
        } catch {}
      }
    },
    () => pids.some(pidAlive)
  )

// Stops every process of the group (SIGTERM, then SIGKILL after 10s) and removes the pidfile.
export const stopAppGroup = async (pgid: number) => {
  if (pgid <= 1) throw new Error(`refusing to signal process group ${pgid}`)
  const stopped = await terminate(
    sig => {
      try {
        process.kill(-pgid, sig)
      } catch {}
    },
    () => groupAlive(pgid)
  )
  if (!stopped) throw new Error(`process group ${pgid} is still running after SIGKILL`)
  if (readAppPidfile()?.pgid === pgid) removeAppPidfile()
}
