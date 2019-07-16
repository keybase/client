// Helps deal with loading common things from remote.
import * as Electron from 'electron'

// Screen is a special case. There's lots of rules about what you can / can't do and when you can load it. see https://electronjs.org/docs/api/screen
export const getScreen = () => {
  let screen: Electron.Screen | null = null
  try {
    const isRenderer = process && process.type === 'renderer'
    if (isRenderer) {
      screen = getRemote().screen
    } else {
      screen = Electron.screen
    }
  } catch (_) {}
  if (!screen) {
    throw new Error('Incorrect screen load, MUST be after app is loaded')
  }
  return screen
}

// Main thread only, proxy through remote
export const getApp = () => {
  const app = Electron.app || getRemote().app
  if (!app) {
    throw new Error('Should be impossible')
  }
  return app
}

export const getIpcMain = () => {
  const ipcMain = Electron.ipcMain || getRemote().ipcMain
  if (!ipcMain) {
    throw new Error('Should be impossible')
  }
  return ipcMain
}

export const getSystemPreferences = () => {
  const systemPreferences = Electron.systemPreferences || getRemote().systemPreferences
  if (!systemPreferences) {
    throw new Error('Should be impossible')
  }
  return systemPreferences
}

export const getDialog = () => {
  const dialog = Electron.dialog || getRemote().dialog
  if (!dialog) {
    throw new Error('Should be impossible')
  }
  return dialog
}

export const getSession = () => {
  const session = Electron.session || getRemote().session
  if (!session) {
    throw new Error('Should be impossible')
  }
  return session
}

export const getGlobalShortcut = () => {
  const globalShortcut = Electron.globalShortcut || getRemote().globalShortcut
  if (!globalShortcut) {
    throw new Error('Should be impossible')
  }
  return globalShortcut
}

export const getPowerMonitor = () => {
  const powerMonitor = Electron.powerMonitor || getRemote().powerMonitor
  if (!powerMonitor) {
    throw new Error('Should be impossible')
  }
  return powerMonitor
}

// Render thread only
export const getIpcRenderer = () => {
  const ipcRenderer = Electron.ipcRenderer
  if (!ipcRenderer) {
    throw new Error('Incorrect electron import. IpcRenderer only available from render thread')
  }
  return ipcRenderer
}

export const getRemote = () => {
  const remote = Electron.remote
  if (!remote) {
    throw new Error('Incorrect electron import. remote only available from render thread')
  }
  return remote
}

export const getCurrentWindowFromRemote = () => {
  return getRemote().getCurrentWindow()
}

// Both
export const getShell = () => {
  const shell = Electron.shell
  if (!shell) {
    throw new Error('Should be impossible')
  }
  return shell
}

export const getClipboard = () => {
  const clipboard = Electron.clipboard
  if (!clipboard) {
    throw new Error('Should be impossible')
  }
  return clipboard
}

export const getCrashReporter = () => {
  const crashReporter = Electron.crashReporter
  if (!crashReporter) {
    throw new Error('Should be impossible')
  }
  return crashReporter
}

export const getPowerSaveBlocker = () => {
  const powerSaveBlocker = Electron.powerSaveBlocker
  if (!powerSaveBlocker) {
    throw new Error('Should be impossible')
  }
  return powerSaveBlocker
}

// Expose classes
const _BrowserWindow = Electron.BrowserWindow || (Electron.remote && Electron.remote.BrowserWindow)
if (!_BrowserWindow) {
  throw new Error('Should be impossible')
}
export const BrowserWindow = _BrowserWindow
const _Menu = Electron.Menu || (Electron.remote && Electron.remote.Menu)
if (!_Menu) {
  throw new Error('Should be impossible')
}
export const Menu = _Menu
export type BrowserWindowType = Electron.BrowserWindow
