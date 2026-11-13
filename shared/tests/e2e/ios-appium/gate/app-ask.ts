// Evals in the running app, and asks of the phone's own service. What lives only on the phone (its
// files settings, a folder's sync config, the emoji skin tone, remember-password, the proxy, the GUI
// config, the photo compress preference, the KBFS debug level, runtime stats, backup jobs) is read
// back and restored here, never through the host's main service, which holds the Mac's copy.
import {maskE2E} from '../../accounts/sweep-lib.ts'
import {GATEWAY_ERROR_RE} from '../../shared/chat-data.ts'
import {jsEval as jsEvalOnce, waitFor} from '../helpers/lifecycle'
import {isVdebugLevel} from './persisted-lib.ts'
import {withHarnessRpcs} from './recorder.ts'
import {ASSET_ID_RE, type AssetInfo} from './save-photos-lib.ts'

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
// `mine()` says whether `ask` is still the one the host waits on (askApp gives up a timed-out ask).
const appAskBody = (ask: string, body: string) => `
    const ask = ${JSON.stringify(ask)}
    ${APP_ASK_KEY} = {ask, state: 'pending'}
    const mine = () => !!${APP_ASK_KEY} && ${APP_ASK_KEY}.ask === ask
    const keep = r => { if (${APP_ASK_KEY} && ${APP_ASK_KEY}.ask === ask) ${APP_ASK_KEY} = {ask, ...r} }
    Promise.resolve()
      .then(() => ${body})
      .then(value => keep({state: 'answered', value}), e => keep({state: 'failed', error: String(e && e.message)}))
    return true
  `

// In a body of more than one RPC, each call after the first goes through this: once the host has
// given the ask up (it timed out, and the recorder runs again) or a newer ask has replaced it, the
// chain stops rather than send `call` unpaused.
const thenIfStillAsked = (call: string) =>
  `(mine() ? ${call} : Promise.reject(new Error('the ask was given up before its next call')))`

// Asks the phone's own service through `body` (an expression for a promise, evaluated in the app,
// that projects the answer to plain data), with the recorder paused for the eval and its wait, so
// the census never credits it. For read-backs of what lives only on the phone, and for restores.
// Bound: `timeout`, plus the pause and resume.
export const askApp = async <T,>(what: string, body: string, timeout = 20_000): Promise<T> => {
  // unique across runs too: the app's global outlives this process
  const ask = `${Date.now()}-${++appAsks}`
  const r = await withHarnessRpcs(what, async () => {
    await jsEval(appAskBody(ask, body), {once: true})
    try {
      return await waitFor(
        `the phone's service to answer ${what}`,
        async () => {
          const got = await jsEval<AppAnswer<T>>(`return ${APP_ASK_KEY} ?? {ask: '', state: 'pending'}`)
          return got.ask === ask && got.state !== 'pending' ? got : undefined
        },
        {interval: 250, timeout}
      )
    } catch (e) {
      // given up while the recorder is still paused, so a chain still running sends nothing more
      await jsEval(
        `if (${APP_ASK_KEY} && ${APP_ASK_KEY}.ask === ${JSON.stringify(ask)}) ${APP_ASK_KEY} = {ask: '', state: 'given up'}
         return true`,
        {once: true}
      ).catch(() => {})
      throw e
    }
  })
  if (r.state === 'failed') throw new Error(`${what}: the phone's service answered ${maskE2E(r.error)}`)
  return r.value
}

const RPC_GEN = `kbModule('constants/rpc/rpc-gen.tsx')`
const RPC_CHAT = `kbModule('constants/rpc/rpc-chat-gen.tsx')`
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
       .then(() => ${thenIfStillAsked(`${RPC_GEN}.SimpleFSSimpleFSSetSyncOnCellularRpcPromise({syncOnCellular: ${s.syncOnCellular ? 'true' : 'false'}})`)})
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

// -- remember-password, proxy, GUI config, photo compress, debug level, runtime stats ---------------

// "Always stay logged in" (Settings > Advanced), as the phone's service keeps it.
export const rememberPassphrase = async () =>
  askApp<boolean>("the phone's remember-password setting", `${RPC_GEN}.configGetRememberPassphraseRpcPromise().then(r => !!r)`)

// a restore only: the UI's change is what counts
export const setRememberPassphrase = async (remember: boolean) =>
  askApp<boolean>(
    'restoring the remember-password setting',
    `${RPC_GEN}.configSetRememberPassphraseRpcPromise({remember: ${remember ? 'true' : 'false'}}).then(() => true)`
  )

// ProxyType: 0 none, 1 HTTP connect, 2 SOCKS
export type ProxyData = {addressWithPort: string; certPinning: boolean; proxyType: 0 | 1 | 2}

export const proxyData = async () =>
  askApp<ProxyData>(
    "the phone's proxy settings",
    `${RPC_GEN}.configGetProxyDataRpcPromise().then(p => ({addressWithPort: p.addressWithPort, certPinning: !!p.certPinning, proxyType: p.proxyType}))`
  )

const plainAddress = /^[A-Za-z0-9.:[\]_-]*$/

// Puts the phone's proxy settings to `d` (a restore only).
export const setProxyData = async (d: ProxyData) => {
  if (![0, 1, 2].includes(d.proxyType) || !plainAddress.test(d.addressWithPort)) throw new Error('refusing proxy settings that are not plain')
  const data = {addressWithPort: d.addressWithPort, certPinning: !!d.certPinning, proxyType: d.proxyType}
  await askApp<boolean>('restoring the proxy settings', `${RPC_GEN}.configSetProxyDataRpcPromise({proxyData: ${JSON.stringify(data)}}).then(() => true)`)
}

export type GuiValue = {isNull: boolean; b?: boolean | null; i?: number | null; f?: number | null; s?: string | null; o?: string | null}

const plainKey = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/
const requirePlainKey = (key: string) => {
  if (!plainKey.test(key)) throw new Error('refusing a GUI config key that is not plain')
  return key
}

// What the phone's GUI config holds at `key` (ui.darkMode, ...), or undefined when nothing is set there.
export const guiValue = async (key: string): Promise<GuiValue | undefined> =>
  (await askApp<GuiValue | null>(
    "the phone's GUI config value",
    `${RPC_GEN}.configGuiGetValueRpcPromise({path: ${JSON.stringify(requirePlainKey(key))}}).then(
       v => (v.isNull ? null : v),
       e => (/no such key/i.test(String(e && e.message)) ? null : Promise.reject(e))
     )`
  )) ?? undefined

const plainValue = /^[A-Za-z0-9_.:-]*$/

// Puts `value` at `key` in the phone's GUI config (a restore only).
export const guiSetValue = async (key: string, value: GuiValue) => {
  for (const v of [value.s, value.o]) if (typeof v === 'string' && !plainValue.test(v)) throw new Error('refusing a GUI config value that is not plain')
  const v = {
    isNull: !!value.isNull,
    ...Object.fromEntries((['b', 'i', 'f', 's', 'o'] as const).flatMap(k => (value[k] === undefined ? [] : [[k, value[k]]]))),
  }
  await askApp<boolean>(
    'restoring a GUI config value',
    `${RPC_GEN}.configGuiSetValueRpcPromise({path: ${JSON.stringify(requirePlainKey(key))}, value: ${JSON.stringify(v)}}).then(() => true)`
  )
}

// Clears `key` in the phone's GUI config (a restore of a key that was never set). The app has no
// generated call for it, so this goes through the engine's call port.
export const guiClearValue = async (key: string) => {
  const path = JSON.stringify(requirePlainKey(key))
  await askApp<boolean>(
    'clearing a GUI config value',
    `new Promise((resolve, reject) =>
       kbModule('engine/call-port.tsx').getCallPort().call({
         callback: e => (e ? reject(e) : resolve(true)),
         method: 'keybase.1.config.guiClearValue',
         params: {path: ${path}},
       })
     )`
  )
}

// The iOS photos and videos setting (Settings > Chat): compress, or keep full size.
export type CompressPreference = 'compressed' | 'original'

export const compressPreference = async () =>
  askApp<CompressPreference>(
    "the phone's photo compress preference",
    `${RPC_GEN}.incomingShareGetPreferenceRpcPromise().then(p =>
       p.compressPreference === ${RPC_GEN}.IncomingShareCompressPreference.original ? 'original' : 'compressed')`
  )

// a restore only
export const setCompressPreference = async (p: CompressPreference) =>
  askApp<boolean>(
    'restoring the photo compress preference',
    `${RPC_GEN}.incomingShareSetPreferenceRpcPromise({
       preference: {compressPreference: ${RPC_GEN}.IncomingShareCompressPreference.${p === 'original' ? 'original' : 'compressed'}},
     }).then(() => true)`
  )

// Whether the signed-in account has no password of its own (it signed up without one): its
// delete-account confirm would then delete at once.
export const randomPW = async () =>
  askApp<boolean>(
    "the phone's passphrase state",
    `${RPC_GEN}.userLoadPassphraseStateRpcPromise().then(s => s === ${RPC_GEN}.PassphraseState.random)`
  )

// Sets the phone's KBFS debug level (a restore of "Enable Detailed Logging").
export const setDebugLevel = async (level: string) => {
  if (!isVdebugLevel(level)) throw new Error('refusing a KBFS debug level that is not a comma list of VDebugLog directives')
  await askApp<boolean>('restoring the KBFS debug level', `${RPC_GEN}.SimpleFSSimpleFSSetDebugLevelRpcPromise({level: ${JSON.stringify(level)}}).then(() => true)`)
}

// The identify state the app holds for `username`'s profile ('valid', 'checking', ...), or undefined
// when it holds none: a read of the tracker's session, no RPC. The name is plain and goes only into
// the eval.
export const trackerState = async (username: string) => {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) throw new Error('refusing a username that is not plain')
  return askApp<string | null>(
    "the profile's identify state",
    `Promise.resolve(kbModule('tracker/identify-session.tsx').getProfileDetails(${JSON.stringify(username)})?.state ?? null)`
  )
}

// Toggles the phone's runtime stats (a restore: read runtimeStatsEnabled first).
export const toggleRuntimeStats = async () =>
  askApp<boolean>('toggling the runtime stats', `${RPC_GEN}.configToggleRuntimeStatsRpcPromise().then(() => true)`)

// Whether the phone's service config has runtime stats on (the flag Toggle Runtime Stats flips and
// a relaunch keeps): the truth even before the first stats arrive or after the last one. The app
// has no generated call for it, so this goes through the engine's call port.
export const runtimeStatsEnabled = async () =>
  askApp<boolean>(
    "the phone's runtime stats setting",
    `new Promise((resolve, reject) =>
       kbModule('engine/call-port.tsx').getCallPort().call({
         callback: (e, v) =>
           e ? (/no such key/i.test(String(e && e.message)) ? resolve(false) : reject(e)) : resolve(!!(v && !v.isNull && v.b)),
         method: 'keybase.1.config.getValue',
         params: {path: 'runtime_stats_enabled'},
       })
     )`
  )

const reachOnce = async (timeout: number) =>
  askApp<boolean>(
    "the phone's service reaching the server",
    `${RPC_GEN}.apiserverGetWithSessionRpcPromise({args: [], endpoint: 'account/subscriptions'}).then(r => !!(r && r.body))`,
    timeout
  )

// A gateway error is the server's gateway failing for a moment (as seen mid-run), or a broken proxy;
// only one that lasts says the phone is cut off.
const REACH_WAITS_MS = [5_000, 10_000]

// Whether the phone's service reaches the API server: one cheap authenticated read answers (its body
// is not kept), tried again after a gateway error. Bound: 3 x (`timeout` plus the pause and resume),
// plus the waits 15: 111 at the default.
export const phoneReachesServer = async (timeout = 30_000) => {
  for (let tries = 0; ; tries++) {
    try {
      return await reachOnce(timeout)
    } catch (e) {
      const wait = REACH_WAITS_MS[tries]
      if (wait === undefined || !GATEWAY_ERROR_RE.test(e instanceof Error ? e.message : String(e))) throw e
      await sleep(wait)
    }
  }
}

// The app's theme state (no RPC): the preference it shows, whether "Respect system settings" is
// offered, and whether the system is dark.
export type DarkModeState = {preference: string; supported: boolean; systemDark: boolean}

export const darkModeState = async () =>
  askApp<DarkModeState>(
    "the app's theme state",
    `Promise.resolve(kbModule('stores/darkmode.tsx').useDarkModeState.getState()).then(s => ({
       preference: s.darkModePreference,
       supported: !!s.supported,
       systemDark: !!s.systemDarkMode,
     }))`
  )

// -- backup jobs -------------------------------------------------------------------------------------

// The ids of backup jobs on the phone: chat (archiveChatList) and files (simpleFSGetArchiveStatus).
export type ArchiveJobs = {chat: Array<string>; kbfs: Array<string>}

// The phone's backup jobs with what each is doing: a chat job's status (ArchiveChatJobStatus) and
// the directory it writes (its compressed output is that path with .tar.gzip after it), a files job's
// phase (SimpleFSArchiveJobPhase) and its staging directory and zip. The paths are the phone's own
// (in the simulator, paths on this Mac that hold the account's name): they stay in memory, never in
// a step, an error or a log.
export type ArchiveJobStates = {
  chat: Array<{id: string; outputPath: string; status: number}>
  kbfs: Array<{id: string; phase: number; stagingPath: string; zipFilePath: string}>
}

export const archiveJobStates = async () =>
  askApp<ArchiveJobStates>(
    "the phone's backup jobs and their states",
    `${RPC_CHAT}.localArchiveChatListRpcPromise({identifyBehavior: ${RPC_GEN}.TLFIdentifyBehavior.unset})
       .then(c => ${thenIfStillAsked(`${RPC_GEN}.SimpleFSSimpleFSGetArchiveStatusRpcPromise()`)}
         .then(k => ({
           chat: (c.jobs || []).map(j => ({id: j.request.jobID, outputPath: j.request.outputPath, status: j.status})),
           kbfs: (k.jobs || []).map(j => ({id: j.desc.jobID, phase: j.phase, stagingPath: j.desc.stagingPath, zipFilePath: j.desc.zipFilePath})),
         })))`
  )

// The ids of `states`' jobs.
export const archiveJobIDs = (states: ArchiveJobStates): ArchiveJobs => ({
  chat: states.chat.map(j => j.id),
  kbfs: states.kbfs.map(j => j.id),
})

const plainJobID = /^[A-Za-z0-9_.:-]+$/

// Removes backup jobs a flow made on the phone: a chat job with its output (archiveChatDelete
// deleteOutputPath), a files job cancelled or dismissed. Refuses, before any eval, a job in `before`
// (the flow's snapshot of the jobs there before it ran): those are never touched.
export const removeArchiveJobs = async (ids: ArchiveJobs, before: ArchiveJobs) => {
  const old = new Set([...before.chat, ...before.kbfs])
  const all = [...ids.chat, ...ids.kbfs]
  if (all.some(id => !plainJobID.test(id))) throw new Error('refusing a backup job id that is not plain')
  if (all.some(id => old.has(id))) throw new Error('refusing to remove a backup job that was there before the flow')
  if (!all.length) return
  const calls = [
    ...ids.chat.map(
      id => `${RPC_CHAT}.localArchiveChatDeleteRpcPromise({deleteOutputPath: true, identifyBehavior: ${RPC_GEN}.TLFIdentifyBehavior.unset, jobID: ${JSON.stringify(id)}})`
    ),
    ...ids.kbfs.map(id => `${RPC_GEN}.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise({jobID: ${JSON.stringify(id)}})`),
  ]
  await askApp<boolean>(
    "removing the flow's backup jobs",
    `Promise.resolve()${calls.map(c => `.then(() => ${thenIfStillAsked(c)})`).join('')}.then(() => true)`
  )
}

// -- native permissions and the photo library --------------------------------------------------------

const MEDIA = `kbModule('node_modules/expo-media-library/build/index.js')`

// The photo library permission as the app reads it (expo-media-library; native, no RPC): adding
// (photos-add) and reading (photos), with how much of the library a read may see.
export type MediaPermission = {add: string; read: string; readAccess: string}

export const mediaPermission = async () =>
  askApp<MediaPermission>(
    "the app's photo library permission",
    `${MEDIA}.getPermissionsAsync(false)
       .then(r => ${MEDIA}.getPermissionsAsync(true).then(a => ({add: a.status, read: r.status, readAccess: r.accessPrivileges ?? 'none'})))`
  )

export type {AssetInfo}

// The ids of every asset in the phone's photo library: the read-back of what a save added is the id
// that was not there before. It needs full photo access (requestFullPhotoAccess): without it the
// library reads empty.
export const libraryAssetIds = async () =>
  askApp<Array<string>>('the photo library asset ids', `new (${MEDIA}.Query)().exe().then(all => all.map(a => a.id))`)

const requireAssetId = (id: string) => {
  if (!ASSET_ID_RE.test(id)) throw new Error('refusing a photo library asset id that is not one')
  return id
}

// The kind and pixel size of the asset `id`.
export const assetInfo = async (id: string) =>
  askApp<AssetInfo>(
    'a photo library asset',
    `new (${MEDIA}.Asset)(${JSON.stringify(requireAssetId(id))}).getInfo().then(i => ({height: i.height, mediaType: i.mediaType, width: i.width}))`
  )

// Asks iOS for full photo access through the app (no RPC). A simctl photos grant is not what PhotoKit
// reads, so the system asks: the caller accepts that prompt (system-ui.ts grantFullPhotoAccess) while
// this waits. Answers the photo permission as the app then reads it.
export const requestFullPhotoAccess = async (timeout = 30_000) =>
  askApp<{granted: boolean; readAccess: string}>(
    'full photo access',
    `${MEDIA}.requestPermissionsAsync(false).then(r => ({granted: !!r.granted, readAccess: r.accessPrivileges ?? 'none'}))`,
    timeout
  )

// Deletes the asset `id`, one the test saved: refused, before any eval, for an id in `before` (the
// library's ids before the test saved anything), so nothing else in the library is ever touched. iOS
// asks to confirm, so the flow taps the system prompt while this waits (`timeout`; system-ui.ts
// deleteSavedPhoto).
export const deleteSavedAsset = async (id: string, before: ReadonlySet<string>, timeout = 30_000) => {
  requireAssetId(id)
  if (before.has(id)) throw new Error('refusing to delete a photo library asset that was there before the test saved')
  await askApp<boolean>("deleting the test's saved asset", `new (${MEDIA}.Asset)(${JSON.stringify(id)}).delete().then(() => true)`, timeout)
}

// Whether the photo library still holds the asset `id` (a read over the whole library).
export const libraryHasAsset = async (id: string) => {
  requireAssetId(id)
  return askApp<boolean>('the photo library holding an asset', `new (${MEDIA}.Query)().exe().then(all => all.some(a => a.id === ${JSON.stringify(id)}))`)
}

// The downloads the phone's service holds (a Save to Photos one included): each id, and whether it is
// done or cancelled. A dismissed download is gone from it.
export type PhoneDownload = {canceled: boolean; done: boolean; downloadID: string}

export const phoneDownloads = async () =>
  askApp<Array<PhoneDownload>>(
    "the phone's downloads",
    `${RPC_GEN}.SimpleFSSimpleFSGetDownloadStatusRpcPromise().then(s =>
       (s.states || []).map(d => ({canceled: !!d.canceled, done: !!d.done, downloadID: d.downloadID})))`
  )
