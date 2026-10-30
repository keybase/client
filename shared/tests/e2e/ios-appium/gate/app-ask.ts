// Evals in the running app, and asks of the phone's own service. What lives only on the phone (its
// files settings, a folder's sync config, the emoji skin tone) is read back and restored here, never
// through the host's main service, which holds the Mac's copy.
import {jsEval as jsEvalOnce, waitFor} from '../helpers/lifecycle'
import {withHarnessRpcs} from './recorder.ts'

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Metro's inspector connection to the app drops now and then for a moment (the app keeps running);
// an eval that fails to connect is tried again for a few seconds before it counts. A body that
// changes the app (calls a handler, dispatches, sets or takes a global) passes {once: true}: after a
// timeout or a dropped connection it may already have run, so only a failed page lookup, before
// anything was sent, is tried again. Retried bodies are reads only.
const READ_TRANSIENT = /no Metro inspector page|inspector connection failed|inspector evaluate timed out/
const UNSENT = /no Metro inspector page/
export const jsEval = async <R>(body: string, opts?: {once?: boolean}): Promise<R> => {
  const end = Date.now() + 10_000
  const transient = opts?.once ? UNSENT : READ_TRANSIENT
  for (;;) {
    try {
      return await jsEvalOnce<R>(body)
    } catch (e) {
      if (!(e instanceof Error && transient.test(e.message)) || Date.now() > end) throw e
      await sleep(500)
    }
  }
}

// Where an ask's answer waits for the evals that poll it (an eval returns before an RPC answers).
const APP_ASK_KEY = 'globalThis.__kbE2EAppAsk'
let appAsks = 0
type AppAnswer<R> = {ask: string} & ({state: 'pending'} | {state: 'answered'; value: R} | {state: 'failed'; error: string})

// A function body for jsEval that runs `body` (an expression for a promise, evaluated in the app) and
// keeps what it answers under `ask`, so an earlier ask answering late cannot replace a newer one's.
const appAskBody = (ask: string, body: string) => `
    const ask = ${JSON.stringify(ask)}
    ${APP_ASK_KEY} = {ask, state: 'pending'}
    const keep = r => { if (${APP_ASK_KEY} && ${APP_ASK_KEY}.ask === ask) ${APP_ASK_KEY} = {ask, ...r} }
    Promise.resolve()
      .then(() => ${body})
      .then(value => keep({state: 'answered', value}), e => keep({state: 'failed', error: String(e && e.message)}))
    return true
  `

// Asks the phone's own service through `body` (an expression for a promise, evaluated in the app,
// that projects the answer to plain data), with the recorder paused for the eval and its wait, so
// the census never credits it. For read-backs of what lives only on the phone, and for restores.
// Bound: `timeout`, plus the pause and resume.
export const askApp = async <T,>(what: string, body: string, timeout = 20_000): Promise<T> => {
  // unique across runs too: the app's global outlives this process
  const ask = `${Date.now()}-${++appAsks}`
  const r = await withHarnessRpcs(what, async () => {
    await jsEval(appAskBody(ask, body), {once: true})
    return waitFor(
      `the phone's service to answer ${what}`,
      async () => {
        const got = await jsEval<AppAnswer<T>>(`return ${APP_ASK_KEY} ?? {ask: '', state: 'pending'}`)
        return got.ask === ask && got.state !== 'pending' ? got : undefined
      },
      {interval: 250, timeout}
    )
  })
  if (r.state === 'failed') throw new Error(`${what}: the phone's service answered ${r.error}`)
  return r.value
}

const RPC_GEN = `kbModule('constants/rpc/rpc-gen.tsx')`
const FS = `kbModule('constants/fs.tsx')`

// The phone's files settings (Settings > Files): the low-space warning's threshold in bytes (0: the
// warning is off) and whether files sync over the mobile network.
export type FilesSettings = {spaceAvailableNotificationThreshold: number; syncOnCellular: boolean}

export const filesSettings = async () =>
  askApp<FilesSettings>(
    "the phone's files settings",
    `${RPC_GEN}.SimpleFSSimpleFSSettingsRpcPromise().then(s => ({
       spaceAvailableNotificationThreshold: s.spaceAvailableNotificationThreshold,
       syncOnCellular: !!s.syncOnCellular,
     }))`
  )

// Puts the phone's files settings to `s` through its service (a restore only: the UI's change is what
// counts).
export const setFilesSettings = async (s: FilesSettings) => {
  const threshold = s.spaceAvailableNotificationThreshold
  if (!Number.isSafeInteger(threshold) || threshold < 0) throw new Error('refusing a files threshold that is not a byte count')
  await askApp<boolean>(
    'restoring the files settings',
    `${RPC_GEN}.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({threshold: ${threshold}})
       .then(() => ${RPC_GEN}.SimpleFSSimpleFSSetSyncOnCellularRpcPromise({syncOnCellular: ${s.syncOnCellular ? 'true' : 'false'}}))
       .then(() => true)`
  )
}

// A folder's "Sync on this device" config on the phone (FolderSyncMode), with the paths a partial sync
// keeps.
export type FolderSyncConfig = {mode: 'disabled' | 'enabled' | 'partial'; paths: Array<string>}
const SYNC_MODES: ReadonlyArray<FolderSyncConfig['mode']> = ['disabled', 'enabled', 'partial']

const plainFolder = /^\/keybase\/(?:private|public|team)\/[A-Za-z0-9_.,-]+(?:\/[A-Za-z0-9_.-]+)*$/
const requirePlainFolder = (path: string) => {
  if (!plainFolder.test(path) || path.split('/').some(p => p === '.' || p === '..')) throw new Error('refusing a folder path that is not plain')
  return path
}
// a partial sync keeps paths inside the folder
const plainSubpath = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/
const requirePlainSubpath = (p: string) => {
  if (!plainSubpath.test(p) || p.split('/').some(s => s === '.' || s === '..')) throw new Error('refusing a synced path that is not plain')
  return p
}

export const folderSyncConfig = async (path: string) =>
  askApp<FolderSyncConfig>(
    "the folder's sync config on the phone",
    `${RPC_GEN}.SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise({path: ${FS}.pathToRPCPath(${JSON.stringify(requirePlainFolder(path))})})
       .then(r => ({mode: ${JSON.stringify(SYNC_MODES)}[r.config.mode], paths: [...(r.config.paths || [])]}))`
  )

// Puts a folder's sync config on the phone to `c` through its service (a restore only).
export const setFolderSyncConfig = async (path: string, c: FolderSyncConfig) => {
  const mode = SYNC_MODES.indexOf(c.mode)
  if (mode < 0) throw new Error('refusing an unknown folder sync mode')
  const config = {mode, paths: c.paths.map(requirePlainSubpath)}
  await askApp<boolean>(
    "restoring the folder's sync config",
    `${RPC_GEN}.SimpleFSSimpleFSSetFolderSyncConfigRpcPromise({
       config: ${JSON.stringify(config)},
       path: ${FS}.pathToRPCPath(${JSON.stringify(requirePlainFolder(path))}),
     }).then(() => true)`
  )
}
