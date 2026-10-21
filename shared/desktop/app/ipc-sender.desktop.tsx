import type * as Electron from 'electron'
import logger from '@/logger'
import {htmlURL} from './html-root.desktop'
import {getMainWindow} from './main-window-ref.desktop'
import {getRemoteWindowComponent} from './remote-windows.desktop'
import {isRemoteKind, isRequestAllowed, isSamePage, type WindowKind} from './bridge-rules.desktop'

const mainPage = htmlURL('main')
const remotePage = htmlURL('remote')

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
export const isSenderAllowed = (
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  request: string
) => {
  const kind = windowKind(event.sender)
  if (kind && isWindowPage(event, kind) && isRequestAllowed(kind, request)) return true
  const key = `${kind ?? 'unknown'}:${request.slice(0, 64)}`
  if (!warned.has(key) && warned.size < 100) {
    warned.add(key)
    logger.warn(`IPC: refused ${key}`)
  }
  return false
}
