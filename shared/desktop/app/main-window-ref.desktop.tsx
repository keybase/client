// No runtime imports: the preload bundle includes this module, and the sandbox has no node builtins
import type * as Electron from 'electron'

let mainWindow: Electron.BrowserWindow | undefined

export const setMainWindow = (w: Electron.BrowserWindow) => {
  mainWindow = w
}

export const getMainWindow = (): Electron.BrowserWindow | undefined =>
  mainWindow?.isDestroyed() ? undefined : mainWindow
