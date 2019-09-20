// Helps deal with loading common things from remote.
const Electron = KB.__electron

// Main thread only, proxy through remote
export const getApp = () => {
  const app = Electron.app || Electron.remote.app
  if (!app) {
    throw new Error('Should be impossible')
  }
  return app
}

// Both
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
