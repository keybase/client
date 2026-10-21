import * as Electron from 'electron'
import logger from '@/logger'
import {htmlURL} from './html-root.desktop'
import {getMainWindow} from './main-window-ref.desktop'
import {getRemoteWindowComponent} from './remote-windows.desktop'
import {
  isRemoteKind,
  isRequestAllowed,
  isSamePage,
  pageKey,
  type BridgeRequest,
  type WindowKind,
} from './bridge-rules.desktop'

const mainPage = pageKey(htmlURL('main'))
const remotePage = pageKey(htmlURL('remote'))

const windowKind = (contents: Electron.WebContents): WindowKind | undefined => {
  if (getMainWindow()?.webContents === contents) return 'main'
  const component = getRemoteWindowComponent(contents)
  return component !== undefined && isRemoteKind(component) ? component : undefined
}

// The sender must be the top frame of its window, still attached, showing that window's own page
const isWindowPage = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent, kind: WindowKind) => {
  try {
    const frame = event.senderFrame
    if (!frame || frame.detached || frame.parent) return false
    const top = event.sender.mainFrame
    if (frame.processId !== top.processId || frame.frameToken !== top.frameToken) return false
    return isSamePage(frame.url, kind === 'main' ? mainPage : remotePage)
  } catch {
    return false
  }
}

const warned = new Set<string>()

// Only the app's own pages may call into the main process, and each window only with the calls it makes
const isSenderAllowed = (
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  request: BridgeRequest
) => {
  const kind = windowKind(event.sender)
  if (kind && isWindowPage(event, kind) && isRequestAllowed(kind, request)) return true
  const name = 'channel' in request ? `channel:${request.channel}` : `action:${request.action}`
  const key = `${kind ?? 'unknown'}:${name.slice(0, 64)}`
  if (!warned.has(key) && warned.size < 100) {
    warned.add(key)
    logger.warn(`IPC: refused ${key}`)
  }
  return false
}

type InvokeEvent = Electron.IpcMainInvokeEvent
type SendEvent = Electron.IpcMainEvent

// Every ipcMain registration goes through these, so each call is checked against its sender.
// The request checked is the channel, or the action requestOf derives from the arguments.
export const handleFromApp = <A extends Array<unknown>>(
  channel: string,
  fn: (event: InvokeEvent, ...args: A) => unknown,
  requestOf: (...args: A) => BridgeRequest | undefined = () => ({channel})
) => {
  Electron.ipcMain.handle(channel, (event, ...args: Array<unknown>) => {
    const request = requestOf(...(args as A))
    if (!request || !isSenderAllowed(event, request)) return undefined
    return fn(event, ...(args as A))
  })
}

export const onFromApp = <A extends Array<unknown>>(channel: string, fn: (event: SendEvent, ...args: A) => void) => {
  Electron.ipcMain.on(channel, (event, ...args: Array<unknown>) => {
    if (!isSenderAllowed(event, {channel})) return
    fn(event, ...(args as A))
  })
}

// For sendSync: a refused caller gets undefined back rather than hanging
export const onSyncFromApp = (channel: string, fn: (event: SendEvent) => unknown) => {
  Electron.ipcMain.on(channel, (event: SendEvent) => {
    event.returnValue = isSenderAllowed(event, {channel}) ? fn(event) : undefined
  })
}
