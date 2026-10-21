// What the main process accepts from renderer pages: which window may make which call. No electron
// imports, so it unit tests.
import type {Action} from './ipctypes'
import type {RemoteComponentName} from '../remote/remote-component.desktop'

export type WindowKind = 'main' | RemoteComponentName

// KBkeybase action types plus the other ipcMain channels
type BridgeRequest =
  | Action['type']
  | 'KBdispatchAction'
  | 'KBmenu'
  | 'KBsetupPreloadKB2'
  | 'engineDropLink'
  | 'engineRestartLink'
  | 'engineSend'

// file: URLs all share the opaque origin 'null', so compare scheme + host + path instead of origin.
// Paths compare case-insensitively, as Windows file paths can differ in case.
const pageKey = (url: string) => {
  const u = new URL(url)
  return `${u.protocol}//${u.host}${u.pathname.toLowerCase()}`
}

// Same document, ignoring query and hash
export const isSamePage = (url: unknown, page: string) => {
  if (typeof url !== 'string') return false
  try {
    return pageKey(url) === pageKey(page)
  } catch {
    return false
  }
}

// Every remote window loads remote.html, picks its component from the query, then reads its props
const remoteCommon: ReadonlyArray<BridgeRequest> = [
  'KBdispatchAction',
  'KBsetupPreloadKB2',
  'closeWindow',
  'getRemoteProps',
  'showInactive',
]
const remoteAllowed: {[K in RemoteComponentName]: ReadonlySet<string>} = {
  menubar: new Set<BridgeRequest>([...remoteCommon, 'ctlQuit', 'hideWindow', 'openURL']),
  pinentry: new Set<BridgeRequest>(remoteCommon),
  tracker: new Set<BridgeRequest>([...remoteCommon, 'openURL']),
  'unlock-folders': new Set<BridgeRequest>(remoteCommon),
}

export const isRemoteKind = (component: string): component is RemoteComponentName =>
  Object.hasOwn(remoteAllowed, component)

// The main window may make every call; each remote window only the ones its component makes
export const isRequestAllowed = (kind: WindowKind, request: string) =>
  kind === 'main' || remoteAllowed[kind].has(request)
