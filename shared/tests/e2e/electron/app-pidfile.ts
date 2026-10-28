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

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Stops every process of the group (SIGTERM, then SIGKILL after 10s) and removes the pidfile.
export const stopAppGroup = async (pgid: number) => {
  if (pgid <= 1) throw new Error(`refusing to signal process group ${pgid}`)
  const signal = (sig: NodeJS.Signals) => {
    try {
      process.kill(-pgid, sig)
    } catch {}
  }
  signal('SIGTERM')
  for (let waited = 0; waited < 10_000 && groupAlive(pgid); waited += 250) await sleep(250)
  if (groupAlive(pgid)) signal('SIGKILL')
  for (let waited = 0; waited < 5_000 && groupAlive(pgid); waited += 250) await sleep(250)
  if (groupAlive(pgid)) throw new Error(`process group ${pgid} is still running after SIGKILL`)
  if (readAppPidfile()?.pgid === pgid) removeAppPidfile()
}
