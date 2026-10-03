// One visual-gate run at a time: the gate drives the one dev app and simulator, so a regular e2e run
// (or a second gate run) overlapping it would corrupt the screenshots.
import * as fs from 'fs'

export const LOCK_PATH = '/tmp/kb-visual-gate.lock'

type LockInfo = {pid: number; cmd: string; start: number}

const lockPath = () => process.env['KB_VISUAL_LOCK'] ?? LOCK_PATH

const readLock = (): LockInfo | undefined => {
  try {
    return JSON.parse(fs.readFileSync(lockPath(), 'utf8')) as LockInfo
  } catch {
    return undefined
  }
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: the process exists but belongs to someone else
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const heldMessage = (info: LockInfo) =>
  `visual gate lock held by pid ${info.pid} (${info.cmd}) since ${new Date(info.start).toISOString()}`

const tryLink = (info: LockInfo): boolean => {
  const tmp = `${lockPath()}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(info))
  try {
    fs.linkSync(tmp, lockPath())
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw e
  } finally {
    fs.rmSync(tmp, {force: true})
  }
}

export const acquireLock = (cmd: string): (() => void) => {
  const info: LockInfo = {cmd, pid: process.pid, start: Date.now()}
  if (!tryLink(info)) {
    const held = readLock()
    if (held && isAlive(held.pid)) throw new Error(heldMessage(held))
    console.log(`cleared stale lock from pid ${held?.pid ?? 'unknown'}`)
    fs.rmSync(lockPath(), {force: true})
    if (!tryLink(info)) {
      const winner = readLock()
      throw new Error(winner ? heldMessage(winner) : 'visual gate lock contended')
    }
  }
  let released = false
  const release = () => {
    if (released) return
    released = true
    if (readLock()?.pid === process.pid) fs.rmSync(lockPath(), {force: true})
  }
  process.on('exit', release)
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      release()
      process.exit(128 + (sig === 'SIGINT' ? 2 : 15))
    })
  }
  return release
}

// The gate's own runs set KB_VISUAL_RUN=1 and pass; any other run refuses while a live pid holds the lock.
export const assertNotLocked = (what: string): void => {
  if (process.env['KB_VISUAL_RUN'] === '1') return
  const held = readLock()
  if (held && isAlive(held.pid)) throw new Error(`${what} refused: ${heldMessage(held)}`)
}
