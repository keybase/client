// @flow
// Helps deal with loading common things from remote.
import * as Electron from 'electron'

// Screen is a special case. There's lots of rules about what you can / can't do and when you can load it. see https://electronjs.org/docs/api/screen
export const getScreen = () => {
  let screen
  try {
    screen = Electron.screen
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

// Expose classes
export const BrowserWindow = Electron.BrowserWindow || Electron.remote.BrowserWindow
export const Menu = Electron.Menu || Electron.remote.Menu
export type BrowserWindowType = electron$BrowserWindow
