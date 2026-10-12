// Registry of remote BrowserWindows and the last props sent to each.
// The main process is the source of truth: the main window pushes props here,
// and remote windows pull the cached value when they load (or reload), so no
// handshake back to the main window is needed.
import type * as Electron from 'electron'

const windows = new Map<string, Electron.BrowserWindow>()
const propsCache = new Map<string, string>()

const windowKey = (windowComponent: string, windowParam: string) => `${windowComponent}:${windowParam}`

export const registerRemoteWindow = (
  windowComponent: string,
  windowParam: string,
  win: Electron.BrowserWindow
) => {
  const key = windowKey(windowComponent, windowParam)
  windows.set(key, win)
  win.on('closed', () => {
    if (windows.get(key) === win) {
      windows.delete(key)
      propsCache.delete(key)
    }
  })
}

export const getRemoteWindow = (windowComponent: string, windowParam: string) =>
  windows.get(windowKey(windowComponent, windowParam))

export const cacheRemoteProps = (windowComponent: string, windowParam: string, propsStr: string) => {
  propsCache.set(windowKey(windowComponent, windowParam), propsStr)
}

export const getCachedRemoteProps = (windowComponent: string, windowParam: string) =>
  propsCache.get(windowKey(windowComponent, windowParam))
