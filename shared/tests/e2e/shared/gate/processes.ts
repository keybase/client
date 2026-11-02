// Process and session checks both release gates use: whether a process or group lives, stopping one,
// whether the macOS session is locked, and how the gates start KBFS.
import {execFileSync} from 'child_process'

export const KBFS_START_COMMAND = '~/go/bin/kbfsfuse -debug -log-file /tmp/kb-e2e/kbfs.log /Volumes/Keybase &'

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

// EPERM: the group exists, owned by someone this process may not signal
export const groupAlive = (pgid: number) => {
  try {
    process.kill(-pgid, 0)
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

// Stops every process of the group (SIGTERM, then SIGKILL after 10s); throws when it outlives that.
export const stopGroup = async (pgid: number) => {
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
}

// Whether the macOS console session is locked, from `ioreg -n Root -d1`. A locked session refuses
// a window's native fullscreen (the window starts entering and drops back at once) and throttles
// the simulator.
export const consoleLocked = (ioreg: string): boolean => {
  const m = /"IOConsoleLocked" = (Yes|No)\b/.exec(ioreg)
  if (!m) throw new Error('ioreg -n Root -d1 does not report IOConsoleLocked')
  return m[1] === 'Yes'
}

export const sessionLocked = () => consoleLocked(execFileSync('ioreg', ['-n', 'Root', '-d1'], {encoding: 'utf8', timeout: 10_000}))
