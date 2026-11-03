// One visual-gate run at a time: the gate drives the one dev app and simulator, so a regular e2e run
// (or a second gate run) overlapping it would corrupt the screenshots. acquireFileLock is the same
// lock on another file, for the release command.
import * as fs from 'fs'

export const LOCK_PATH = '/tmp/kb-visual-gate.lock'

type LockInfo = {pid: number; cmd: string; start: number}

const lockPath = () => process.env['KB_VISUAL_LOCK'] ?? LOCK_PATH
const VISUAL_LABEL = 'visual gate lock'

const readLockAt = (file: string): LockInfo | undefined => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as LockInfo
  } catch {
    return undefined
  }
}
const readLock = () => readLockAt(lockPath())

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: the process exists but belongs to someone else
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const heldMessage = (label: string, info: LockInfo) =>
  `${label} held by pid ${info.pid} (${info.cmd}) since ${new Date(info.start).toISOString()}`

// What to do about a lock file that is already there: a live holder (this process included)
// refuses; a dead holder, or a file that cannot be read, is stale and cleared.
export const lockDecision = (held: LockInfo | undefined, alive: (pid: number) => boolean): 'refuse' | 'clear' =>
  held && alive(held.pid) ? 'refuse' : 'clear'

const tryLink = (file: string, info: LockInfo): boolean => {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(info))
  try {
    fs.linkSync(tmp, file)
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw e
  } finally {
    fs.rmSync(tmp, {force: true})
  }
}

// Moves the lock aside (atomic) and removes it only if it is still the stale one seen: another
// run may have cleared it and taken the lock in between, and that fresh lock is put back.
const clearStaleAt = (file: string, label: string, stale: LockInfo | undefined) => {
  const aside = `${file}.${process.pid}.stale`
  try {
    fs.renameSync(file, aside)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return
    throw e
  }
  try {
    let moved: LockInfo | undefined
    try {
      moved = JSON.parse(fs.readFileSync(aside, 'utf8')) as LockInfo
    } catch {}
    if (moved && moved.pid !== stale?.pid) {
      try {
        fs.linkSync(aside, file)
      } catch {}
      throw new Error(heldMessage(label, moved))
    }
  } finally {
    fs.rmSync(aside, {force: true})
  }
}

export const clearStale = (stale: LockInfo | undefined) => clearStaleAt(lockPath(), VISUAL_LABEL, stale)

// Takes the lock at `file` for this process or throws naming its live holder, clearing a stale
// one first. It is released on exit; the caller's own signal handling must end in process.exit.
// The returned release removes the file only while this process still holds it.
export const acquireFileLock = (file: string, cmd: string, label: string): (() => void) => {
  const info: LockInfo = {cmd, pid: process.pid, start: Date.now()}
  if (!tryLink(file, info)) {
    const held = readLockAt(file)
    if (lockDecision(held, isAlive) === 'refuse' && held) throw new Error(heldMessage(label, held))
    clearStaleAt(file, label, held)
    console.log(`cleared stale ${label} from pid ${held?.pid ?? 'unknown'}`)
    const won = tryLink(file, info)
    const owner = readLockAt(file)
    if (!won || owner?.pid !== process.pid) throw new Error(owner ? heldMessage(label, owner) : `${label} contended`)
  }
  let released = false
  const release = () => {
    if (released) return
    released = true
    if (readLockAt(file)?.pid === process.pid) fs.rmSync(file, {force: true})
  }
  process.on('exit', release)
  return release
}

export const acquireLock = (cmd: string): (() => void) => {
  const release = acquireFileLock(lockPath(), cmd, VISUAL_LABEL)
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
  if (held && isAlive(held.pid)) throw new Error(`${what} refused: ${heldMessage(VISUAL_LABEL, held)}`)
}
