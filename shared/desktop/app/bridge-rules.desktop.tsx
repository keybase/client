// What the main process accepts from renderer pages: which window may make which call, and the
// shape of the URLs and paths the bridge functions act on. No electron imports, so it unit tests.
import path from 'path'
import type {Action} from './ipctypes'
import type {RemoteComponentName} from '../remote/remote-component.desktop'

export type WindowKind = 'main' | RemoteComponentName

// A call is either an ipcMain channel, or a KBkeybase action named by its type
type Channel =
  | 'KBdispatchAction'
  | 'KBmenu'
  | 'KBsetupPreloadKB2'
  | 'engineDropLink'
  | 'engineRestartLink'
  | 'engineSend'
export type BridgeRequest = {channel: string} | {action: string}

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

type RemoteAllowed = {channels: ReadonlySet<string>; actions: ReadonlySet<string>}
const remoteChannels: ReadonlySet<string> = new Set<Channel>(['KBdispatchAction', 'KBsetupPreloadKB2'])
// Every remote window loads remote.html, picks its component from the query, then reads its props
const remoteActions = (...extra: Array<Action['type']>): RemoteAllowed => ({
  actions: new Set<Action['type']>(['closeWindow', 'getRemoteProps', 'showInactive', ...extra]),
  channels: remoteChannels,
})
const remoteAllowed: {[K in RemoteComponentName]: RemoteAllowed} = {
  menubar: remoteActions('ctlQuit', 'hideWindow', 'openURL'),
  pinentry: remoteActions(),
  tracker: remoteActions('openURL'),
  'unlock-folders': remoteActions(),
}

export const isRemoteKind = (component: string): component is RemoteComponentName =>
  Object.hasOwn(remoteAllowed, component)

// The main window may make every call; each remote window only the ones its component makes
export const isRequestAllowed = (kind: WindowKind, request: BridgeRequest) => {
  if (kind === 'main') return true
  const allowed = remoteAllowed[kind]
  return 'channel' in request ? allowed.channels.has(request.channel) : allowed.actions.has(request.action)
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
