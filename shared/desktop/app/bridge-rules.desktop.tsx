// What the main process accepts from renderer pages: which window may make which call, and the
// shape of the URLs and paths the bridge functions act on. No electron imports, so it unit tests.
import path from 'path'
import type {Action} from './ipctypes'
import * as RemoteGen from '@/constants/remote-actions'
import * as RPCTypes from '@/constants/rpc/rpc-gen'
import type {RemoteComponentName} from '../remote/remote-component.desktop'

export type WindowKind = 'main' | RemoteComponentName

// A call is an ipcMain channel, a KBkeybase action named by its type, or an action relayed to the
// main window over KBdispatchAction, named by its type
type Channel =
  | 'KBdispatchAction'
  | 'KBmenu'
  | 'KBsetupPreloadKB2'
  | 'engineDropLink'
  | 'engineRestartLink'
  | 'engineSend'
export type BridgeRequest = {channel: string} | {action: string} | {forward: string; payload?: unknown}

// file: URLs all share the opaque origin 'null', so compare scheme + host + path instead of origin.
// Paths compare case-insensitively, as Windows file paths can differ in case.
export const pageKey = (url: unknown) => {
  if (typeof url !== 'string') return undefined
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname.toLowerCase()}`
  } catch {
    return undefined
  }
}

// Same document as the page whose pageKey is given, ignoring query and hash
export const isSamePage = (url: unknown, key: string | undefined) => {
  const k = pageKey(url)
  return k !== undefined && k === key
}

type RemoteAllowed = {
  channels: ReadonlySet<string>
  actions: ReadonlySet<string>
  forwards: ReadonlySet<string>
}
type RemoteActionType = RemoteGen.Actions['type']
const remoteChannels: ReadonlySet<string> = new Set<Channel>(['KBsetupPreloadKB2'])
// Every remote window loads remote.html, picks its component from the query, then reads its props.
// forwards are the remote actions the window's component dispatches to the main window.
const remoteActions = (extra: Array<Action['type']>, forwards: Array<RemoteActionType>): RemoteAllowed => ({
  actions: new Set<Action['type']>(['closeWindow', 'getRemoteProps', 'showInactive', ...extra]),
  channels: remoteChannels,
  forwards: new Set<RemoteActionType>(forwards),
})
const remoteAllowed: {[K in RemoteComponentName]: RemoteAllowed} = {
  menubar: remoteActions(
    ['ctlQuit', 'hideWindow', 'openURL'],
    [
      RemoteGen.dumpLogs,
      RemoteGen.openChatFromWidget,
      RemoteGen.openFilesFromWidget,
      RemoteGen.openPathInSystemFileManager,
      RemoteGen.showMain,
      RemoteGen.stop,
      RemoteGen.switchTab,
      RemoteGen.updateNow,
    ]
  ),
  pinentry: remoteActions([], [RemoteGen.pinentryOnCancel, RemoteGen.pinentryOnSubmit]),
  tracker: remoteActions(
    ['openURL'],
    [
      RemoteGen.previewConversation,
      RemoteGen.showMain,
      RemoteGen.trackerChangeFollow,
      RemoteGen.trackerCloseTracker,
      RemoteGen.trackerIgnore,
      RemoteGen.trackerLoad,
    ]
  ),
  'unlock-folders': remoteActions([], [RemoteGen.closeUnlockFolders, RemoteGen.unlockFoldersSubmitPaperKey]),
}

// Forwarded payloads the main window would act on more broadly than the remote window needs are pinned
// to what the window sends: the menubar only opens the KBFS mount, quits cleanly and dumps logs on quit,
// and the tracker only follows
const payloadField = (payload: unknown, key: string): unknown =>
  typeof payload === 'object' && payload !== null && Object.hasOwn(payload, key)
    ? (payload as {[k: string]: unknown})[key]
    : undefined
const pinnedForwardPayloads = new Map<string, (payload: unknown) => boolean>([
  [RemoteGen.dumpLogs, p => payloadField(p, 'reason') === 'quitting through menu'],
  [RemoteGen.openPathInSystemFileManager, p => payloadField(p, 'path') === '/keybase'],
  [RemoteGen.stop, p => payloadField(p, 'exitCode') === RPCTypes.ExitCode.ok],
  [RemoteGen.trackerChangeFollow, p => payloadField(p, 'follow') === true],
])

export const remoteForwards = (kind: RemoteComponentName): ReadonlySet<string> => remoteAllowed[kind].forwards

export const isRemoteKind = (component: string): component is RemoteComponentName =>
  Object.hasOwn(remoteAllowed, component)

// The main window may make every call; each remote window only the ones its component makes
export const isRequestAllowed = (kind: WindowKind, request: BridgeRequest) => {
  if (kind === 'main') return true
  const allowed = remoteAllowed[kind]
  if ('channel' in request) return allowed.channels.has(request.channel)
  if ('forward' in request) {
    const pinned = pinnedForwardPayloads.get(request.forward)
    return allowed.forwards.has(request.forward) && (!pinned || pinned(request.payload))
  }
  return allowed.actions.has(request.action)
}

const knownChannels: ReadonlySet<string> = new Set<Channel>([
  'KBdispatchAction',
  'KBmenu',
  'KBsetupPreloadKB2',
  'engineDropLink',
  'engineRestartLink',
  'engineSend',
])
const knownActions: {[K in Action['type']]: true} = {
  DEVwriteMenuIcons: true, activeChanged: true, appStartedUp: true, closeRenderer: true, closeWindow: true,
  closeWindows: true, copyToClipboard: true, ctlQuit: true, darwinCopyToChatTempUploadFile: true,
  darwinCopyToKBFSTempUploadFile: true, dumpNodeLogger: true, exitApp: true, getPathType: true,
  getRemoteProps: true, hideWindow: true, installCachedDokan: true, isDirectory: true, makeRenderer: true,
  minimizeWindow: true, openPathInFinder: true, openURL: true, quitApp: true, readImageFromClipboard: true,
  relaunchApp: true, rendererNewProps: true, requestWindowsStartService: true,
  selectFilesToUploadDialog: true, setNativeTheme: true, setOpenAtLogin: true, showContextMenu: true,
  showInactive: true, showMainWindow: true, showOpenDialog: true, showSaveDialog: true,
  toggleMaximizeWindow: true, uninstallDokan: true, uninstallDokanDialog: true, uninstallKBFSDialog: true,
  winCheckRPCOwnership: true, windowsCheckMountFromOtherDokanInstall: true,
}
const knownForwards: ReadonlySet<unknown> = new Set(Object.values(RemoteGen).filter(v => typeof v === 'string'))

// How a refused request is named in the log: only names the app defines, anything else is 'unknown'
export const requestLogName = (request: BridgeRequest) => {
  if ('channel' in request) return `channel:${knownChannels.has(request.channel) ? request.channel : 'unknown'}`
  if ('forward' in request) return `forward:${knownForwards.has(request.forward) ? request.forward : 'unknown'}`
  return `action:${Object.hasOwn(knownActions, request.action) ? request.action : 'unknown'}`
}

const parseURL = (url: unknown) => {
  if (typeof url !== 'string') return undefined
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

// Opens http(s) and mailto links, and on macOS the System Settings links the files tab uses
export const isExternalURLAllowed = (url: unknown, platform: string) => {
  switch (parseURL(url)?.protocol) {
    case 'http:':
    case 'https:':
    case 'mailto:':
      return true
    case 'x-apple.systempreferences:':
      return platform === 'darwin'
    default:
      return false
  }
}

export const isBrowserURL = (url: unknown) => {
  const protocol = parseURL(url)?.protocol
  return protocol === 'http:' || protocol === 'https:'
}

// Subframes may only show the service's local http servers (file and attachment previews) and the
// built-in PDF viewer those previews open in
const pdfViewerID = 'mhjfbmdgcfjbbpaeojofohoefgiehjai'
export const isSubframeURLAllowed = (url: unknown) => {
  const u = parseURL(url)
  if (!u) return false
  if (u.href === 'about:blank') return true
  if (u.protocol === 'http:' && u.hostname === '127.0.0.1') return true
  return u.protocol === 'chrome-extension:' && u.host === pdfViewerID
}

// The Dokan bundle's registry UninstallString: a quoted (or space-free) path to the cached
// DokanSetup executable under the per-machine Package Cache, followed by switches
export const parseDokanUninstallCommand = (command: unknown, programData: string | undefined) => {
  if (typeof command !== 'string' || !programData) return undefined
  const w = path.win32
  const trimmed = command.trim()
  let file: string
  let rest: string
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1)
    if (end < 0) return undefined
    file = trimmed.slice(1, end)
    rest = trimmed.slice(end + 1)
  } else {
    const m = /^(\S+)(.*)$/s.exec(trimmed)
    if (!m) return undefined
    file = m[1] ?? ''
    rest = m[2] ?? ''
  }
  if (!w.isAbsolute(file) || !/^[a-zA-Z]:\\/.test(file)) return undefined
  file = w.normalize(file)
  if (!/^DokanSetup[\w.-]*\.exe$/i.test(w.basename(file))) return undefined
  const rel = w.relative(w.join(programData, 'Package Cache'), file)
  if (!rel || rel.startsWith('..') || w.isAbsolute(rel)) return undefined
  if (rest && !/^\s/.test(rest)) return undefined
  const args = rest.split(/\s+/).filter(Boolean)
  if (!args.every(a => /^[/-][a-zA-Z]+$/.test(a))) return undefined
  return {args, file}
}

// Drag-and-drop uploads on macOS copy into the service's temp dirs under the cache root:
// chat into uploadtemps[_vN]/<outboxID>/<name>, KBFS into uploads-<random>/<name>
export const isUploadTempPath = (dst: string, cacheRoot: string, kind: 'chat' | 'kbfs') => {
  if (!cacheRoot || !path.isAbsolute(cacheRoot) || !path.isAbsolute(dst)) return false
  const rel = path.relative(path.resolve(cacheRoot), path.resolve(dst))
  const parts = rel.split(path.sep)
  if (parts.some(p => !p || p === '..')) return false
  const [top = ''] = parts
  return kind === 'chat'
    ? parts.length === 3 && /^uploadtemps(_v\d+)?$/.test(top)
    : parts.length === 2 && /^uploads-./.test(top)
}
