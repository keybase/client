// The KBFS entries the files flows make, and the host CLI's view of them. Every entry a flow makes or
// deletes is run-stamped (e2e-<runid>-<label>) and sits directly in the smoke account's private
// folder or the smoke+second folder; a write targets one exact such path of this run (or something
// inside it) and nothing else. Framework-free: shared by the desktop and iOS flows.
import {randomBytes} from 'crypto'
import {loadE2EAccounts} from '../accounts/env.ts'
import {parseStampedName} from '../accounts/run-id.ts'
import {maskE2E} from '../accounts/sweep-lib.ts'
import {waitFor} from './deadline.ts'
import {pairFolder} from './favorites.ts'
import {requireMainIsSmoke, runKeybase} from './peer-service.ts'
import {e2eRunId} from './run-marker.ts'

export const smokeFolder = () => `/keybase/private/${loadE2EAccounts().smokeUser}`

// e2e-<runid>-<label>, the name of an entry a flow makes.
export const stampedEntry = (label: string) => {
  const name = `e2e-${e2eRunId()}-${label}`
  if (parseStampedName(name, 'dashed')?.runId !== e2eRunId()) throw new Error(`the label ${JSON.stringify(label)} makes no stamped name of this run`)
  return name
}

const safeName = /^[A-Za-z0-9_.-]+$/

// `path`, when it is an entry this run made in one of the two folders flows write to, or something
// inside one; throws otherwise, naming no folder or entry. `keybase fs` expands globs, so every name
// in it must be plain.
export const requireOwnPath = (path: string) => {
  const root = [smokeFolder(), pairFolder()].find(r => path.startsWith(`${r}/`))
  if (!root) throw new Error("refusing a path outside the smoke account's own and smoke+second folders")
  const parts = path.slice(root.length + 1).split('/')
  if (!parts.every(p => safeName.test(p) && p !== '.' && p !== '..')) throw new Error('refusing a path that is not plain')
  if (parseStampedName(parts[0] ?? '', 'dashed')?.runId !== e2eRunId()) throw new Error('refusing a path not under an entry of this run')
  return path
}

const kbfsTimeoutMs = 60_000

export type KbfsEntry = {name: string; isDir: boolean; size: number}

// `keybase fs ls -w` lines (tab-separated, so a name may hold spaces): `<time>\t<DIR>\t\t<name>` for
// a directory, `<time>\t<size>\t<name>` for a file.
export const kbfsList = async (dir: string): Promise<Array<KbfsEntry>> => {
  if (dir !== smokeFolder() && dir !== pairFolder()) requireOwnPath(dir)
  const out = await runKeybase(['fs', 'ls', '-w', '-a', '--nocolor', dir], {timeoutMs: kbfsTimeoutMs})
  return out
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const fields = l.split('\t')
      const isDir = fields[1] === '<DIR>'
      return {isDir, name: fields[fields.length - 1] ?? '', size: isDir ? 0 : Number(fields[1])}
    })
    .filter(e => e.name !== '.' && e.name !== '..')
}

export const kbfsEntry = async (dir: string, name: string) => (await kbfsList(dir)).find(e => e.name === name)

export const kbfsMkdir = async (path: string) => {
  await runKeybase(['fs', 'mkdir', requireOwnPath(path)], {timeoutMs: kbfsTimeoutMs})
}

// Copies a local file in as `path` (setup only: flows never count it as coverage).
export const kbfsCopyIn = async (localFile: string, path: string) => {
  await runKeybase(['fs', 'cp', localFile, requireOwnPath(path)], {timeoutMs: kbfsTimeoutMs})
}

export const leaf = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'))

// Removes `path` (with what is in it) when it is there, and reads back that it is gone.
export const removeOwnKbfs = async (path: string) => {
  requireOwnPath(path)
  const dir = parentOf(path)
  const name = leaf(path)
  if (!(await kbfsEntry(dir, name))) return
  // a recursive delete runs as whoever the main service is signed in as: checked right before it
  await requireMainIsSmoke(loadE2EAccounts())
  await runKeybase(['fs', 'rm', '-r', path], {timeoutMs: kbfsTimeoutMs})
  if (await kbfsEntry(dir, name)) throw new Error('the entry is still there after keybase fs rm')
}

// A new folder for one test to work in: each test, and each repeat of it, has its own.
export const newWorkFolder = () => `${smokeFolder()}/${stampedEntry(`files-${randomBytes(2).toString('hex')}`)}`

// What a read-back waits for an entry to be: gone, a directory, a file, or a file of that size.
export type KbfsWant = 'absent' | 'dir' | 'file' | {size: number}

const isWanted = (e: KbfsEntry | undefined, want: KbfsWant) =>
  want === 'absent' ? !e : !!e && (want === 'dir' ? e.isDir : !e.isDir && (want === 'file' || e.size === want.size))

// What the phone writes reaches the host only once the phone's KBFS journal has flushed it to the
// server: the default bound covers that flush on top of the host's own 30-60s.
const PHONE_FLUSH_MS = 120_000

// Polls the host's listing until `path` (one of this run's entries) is as `want` says, and returns
// its entry (undefined for 'absent'). Bound: `boundMs`, plus one listing (60s) under way at its end.
export const waitForKbfs = async (path: string, want: KbfsWant, boundMs = PHONE_FLUSH_MS) => {
  requireOwnPath(path)
  const dir = parentOf(path)
  const name = leaf(path)
  const what = want === 'absent' ? 'the entry to be gone' : 'the entry'
  const got = await waitFor(
    `${what} on the host`,
    async () => {
      const e = await kbfsEntry(dir, name).catch((err: unknown) => {
        // the CLI's error holds the path, and with it the account names
        const msg = (err instanceof Error ? err.message : String(err)).split(dir).join('<folder>').split(name).join('<entry>')
        throw new Error(maskE2E(msg))
      })
      return isWanted(e, want) ? {e} : undefined
    },
    {interval: 2_000, timeout: boundMs}
  )
  return got.e
}
